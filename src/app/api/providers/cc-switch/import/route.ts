import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { buildErrorBody } from "@omniroute/open-sse/utils/error";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { getAuditRequestContext, logAuditEvent } from "@/lib/compliance/index";
import {
  getProviderAuditTarget,
  summarizeProviderConnectionForAudit,
} from "@/lib/compliance/providerAudit";
import { createProviderConnection, createProviderNode, getProviderNodes } from "@/models";
import { generateId } from "@/shared/utils";
import {
  OPENAI_COMPATIBLE_PREFIX,
  ANTHROPIC_COMPATIBLE_PREFIX,
} from "@/shared/constants/providers";
import {
  getCcSwitchDbPath,
  parseCcSwitchDb,
  parseCcSwitchSql,
  type CcSwitchProvider,
} from "@/lib/import/ccSwitchParser";

const SQL_BODY_LIMIT = 11 * 1024 * 1024;

const importSchema = z.object({
  source: z.enum(["local", "upload"]).default("local"),
  sql: z.string().max(SQL_BODY_LIMIT).optional(),
  selectedIds: z.array(z.string().min(1).max(200)).min(1).max(200),
});

function sanitizeBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/$/, "")
    .replace(/\/messages(?:\?[^#]*)?$/i, "");
}

function derivePrefix(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "imported"
  );
}

async function findExistingNodeByBaseUrl(
  baseUrl: string,
  nodeType: "openai-compatible" | "anthropic-compatible"
): Promise<Record<string, unknown> | null> {
  const nodes = await getProviderNodes({ type: nodeType });
  const normalized = sanitizeBaseUrl(baseUrl).toLowerCase();
  for (const node of nodes) {
    const nodeUrl = String((node as Record<string, unknown>).baseUrl || "")
      .trim()
      .replace(/\/$/, "")
      .toLowerCase();
    if (nodeUrl === normalized) return node as Record<string, unknown>;
  }
  return null;
}

async function createNodeForProvider(provider: CcSwitchProvider): Promise<Record<string, unknown>> {
  const baseUrl = sanitizeBaseUrl(provider.baseUrl);

  if (provider.protocol === "anthropic") {
    const existing = await findExistingNodeByBaseUrl(baseUrl, "anthropic-compatible");
    if (existing) return existing;

    return createProviderNode({
      id: `${ANTHROPIC_COMPATIBLE_PREFIX}${generateId()}`,
      type: "anthropic-compatible",
      prefix: derivePrefix(provider.name),
      baseUrl,
      name: provider.name,
    });
  }

  const existing = await findExistingNodeByBaseUrl(baseUrl, "openai-compatible");
  if (existing) return existing;

  const apiType = provider.apiType || "responses";
  return createProviderNode({
    id: `${OPENAI_COMPATIBLE_PREFIX}${apiType}-${generateId()}`,
    type: "openai-compatible",
    prefix: derivePrefix(provider.name),
    apiType,
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

  const { source, sql, selectedIds } = parsed.data;
  const selectedSet = new Set(selectedIds);

  let allProviders: CcSwitchProvider[];
  try {
    if (source === "upload") {
      if (!sql || !sql.trim()) {
        return NextResponse.json(buildErrorBody(400, "Missing sql field"), { status: 400 });
      }
      allProviders = await parseCcSwitchSql(sql);
    } else {
      const dbPath = getCcSwitchDbPath();
      const buffer = (await fs.readFile(dbPath)) as Buffer;
      allProviders = await parseCcSwitchDb(buffer);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read cc-switch data";
    return NextResponse.json(buildErrorBody(400, message), { status: 400 });
  }

  const selected = allProviders.filter((p) => selectedSet.has(p.id));
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
        isActive: true,
        providerSpecificData: {
          baseUrl: sanitizeBaseUrl(provider.baseUrl),
          prefix: node.prefix || derivePrefix(provider.name),
          nodeName: node.name || provider.name,
        },
      });

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
          source: "cc-switch",
          ccSwitchId: provider.id,
          ccSwitchAppType: provider.appType,
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
      source: "cc-switch",
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
