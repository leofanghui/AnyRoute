import { NextResponse } from "next/server";
import { z } from "zod";

import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getAuditRequestContext, logAuditEvent } from "@/lib/compliance/index";
import {
  getProviderAuditTarget,
  summarizeProviderConnectionForAudit,
} from "@/lib/compliance/providerAudit";
import { parseAllApiHubJson, type AllApiHubProvider } from "@/lib/import/allApiHubParser";
import { createProviderConnection, createProviderNode, getProviderNodes } from "@/models";
import { OPENAI_COMPATIBLE_PREFIX } from "@/shared/constants/providers";
import { generateId } from "@/shared/utils";
import { buildErrorBody, sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";

const JSON_BODY_LIMIT = 11 * 1024 * 1024;

const importSchema = z.object({
  json: z.string().max(JSON_BODY_LIMIT),
  selectedIds: z.array(z.string().min(1).max(200)).min(1).max(200),
});

function sanitizeBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(?:chat\/completions|responses|completions|models)(?:\?[^#]*)?$/i, "");
}

function derivePrefix(name: string, baseUrl: string): string {
  let host = "";
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    host = name;
  }

  const slug =
    host
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "imported";
  return `allapi-${slug}`.slice(0, 48);
}

async function findExistingOpenAiNode(baseUrl: string): Promise<Record<string, unknown> | null> {
  const nodes = await getProviderNodes({ type: "openai-compatible" });
  const normalized = sanitizeBaseUrl(baseUrl).toLowerCase();
  for (const node of nodes) {
    const record = node as Record<string, unknown>;
    const nodeUrl = String(record.baseUrl || "")
      .trim()
      .replace(/\/+$/, "")
      .toLowerCase();
    const apiType = String(record.apiType || "chat");
    const chatPath = String(record.chatPath || "");
    const modelsPath = String(record.modelsPath || "");
    if (nodeUrl === normalized && apiType === "chat" && !chatPath && !modelsPath) {
      return record;
    }
  }
  return null;
}

async function createNodeForProvider(
  provider: AllApiHubProvider
): Promise<Record<string, unknown>> {
  const baseUrl = sanitizeBaseUrl(provider.baseUrl);
  const existing = await findExistingOpenAiNode(baseUrl);
  if (existing) return existing;

  return createProviderNode({
    id: `${OPENAI_COMPATIBLE_PREFIX}chat-${generateId()}`,
    type: "openai-compatible",
    prefix: derivePrefix(provider.name, baseUrl),
    apiType: "chat",
    baseUrl,
    name: provider.name,
  });
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const auditContext = getAuditRequestContext(request);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(buildErrorBody(400, "Invalid JSON body"), { status: 400 });
  }

  const parsed = importSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      buildErrorBody(
        400,
        "Validation failed: " + parsed.error.issues.map((i) => i.message).join(", ")
      ),
      { status: 400 }
    );
  }

  let allProviders: AllApiHubProvider[];
  try {
    allProviders = parseAllApiHubJson(parsed.data.json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse ALL-API-Hub data";
    return NextResponse.json(buildErrorBody(400, message), { status: 400 });
  }

  const selectedSet = new Set(parsed.data.selectedIds);
  const selected = allProviders.filter((provider) => selectedSet.has(provider.id));
  if (selected.length === 0) {
    return NextResponse.json(buildErrorBody(400, "No matching providers found"), { status: 400 });
  }

  const created: Array<Record<string, unknown>> = [];
  const createdNodes: Array<Record<string, unknown>> = [];
  const errors: Array<{ index: number; name: string; message: string }> = [];

  for (let i = 0; i < selected.length; i++) {
    const provider = selected[i];
    try {
      const node = await createNodeForProvider(provider);
      const nodeId = String(node.id || "");

      const connection = await createProviderConnection({
        provider: nodeId,
        authType: "apikey",
        apiKey: provider.apiKey,
        name: provider.name,
        isActive: provider.disabled !== true,
        testStatus: "unknown",
        providerSpecificData: {
          baseUrl: sanitizeBaseUrl(provider.baseUrl),
          prefix: node.prefix || derivePrefix(provider.name, provider.baseUrl),
          nodeName: node.name || provider.name,
          source: "all-api-hub",
          allApiHubAccountId: provider.id,
          allApiHubSiteType: provider.siteType,
          username: provider.username,
        },
      });

      if (!connection) {
        throw new Error("Failed to create provider connection");
      }

      const safe: Record<string, unknown> = { ...connection };
      delete safe.apiKey;
      created.push(safe);

      if (!createdNodes.some((n) => n.id === nodeId)) {
        createdNodes.push(node);
      }

      logAuditEvent({
        action: "provider.credentials.imported",
        actor: "admin",
        target: getProviderAuditTarget(connection),
        resourceType: "provider_credentials",
        status: "success",
        ipAddress: auditContext.ipAddress || undefined,
        requestId: auditContext.requestId,
        metadata: {
          source: "all-api-hub",
          allApiHubId: provider.id,
          allApiHubSiteType: provider.siteType,
          provider: nodeId,
          connection: summarizeProviderConnectionForAudit(connection),
        },
      });
    } catch (err) {
      errors.push({
        index: i,
        name: provider.name,
        message: sanitizeErrorMessage(err) || "Failed to import",
      });
    }
  }

  logAuditEvent({
    action: "provider.credentials.bulk_imported",
    actor: "admin",
    resourceType: "provider_credentials",
    status: errors.length === selected.length ? "failure" : "success",
    ipAddress: auditContext.ipAddress || undefined,
    requestId: auditContext.requestId,
    metadata: {
      source: "all-api-hub",
      total: selected.length,
      success: created.length,
      failed: errors.length,
    },
  });

  return NextResponse.json({
    success: created.length,
    failed: errors.length,
    total: selected.length,
    created,
    createdNodes,
    errors,
  });
}
