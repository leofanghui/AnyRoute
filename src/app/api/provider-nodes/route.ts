import { NextResponse } from "next/server";
import { createProviderNode, getProviderNodes } from "@/models";
import {
  OPENAI_COMPATIBLE_PREFIX,
  ANTHROPIC_COMPATIBLE_PREFIX,
  CLAUDE_CODE_COMPATIBLE_PREFIX,
} from "@/shared/constants/providers";
import { generateId } from "@/shared/utils";
import { isCcCompatibleProviderEnabled } from "@/shared/utils/featureFlags";
import { createProviderNodeSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

const OPENAI_COMPATIBLE_DEFAULTS = {
  baseUrl: "https://api.openai.com/v1",
};

const ANTHROPIC_COMPATIBLE_DEFAULTS = {
  baseUrl: "https://api.anthropic.com/v1",
};

function sanitizeAnthropicBaseUrl(baseUrl: string) {
  return (baseUrl || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/\/messages(?:\?[^#]*)?$/i, "");
}

function sanitizeClaudeCodeCompatibleBaseUrl(baseUrl: string) {
  return (baseUrl || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/\/(?:v\d+\/)?messages(?:\?[^#]*)?$/i, "");
}

function normalizeNullablePath(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeBaseUrl(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function findExistingCompatibleNode(nodes, target) {
  return (
    nodes.find((node) => {
      if (node.type !== target.type) return false;
      if (normalizeBaseUrl(node.baseUrl) !== normalizeBaseUrl(target.baseUrl)) return false;
      if (normalizeNullablePath(node.chatPath) !== normalizeNullablePath(target.chatPath)) {
        return false;
      }
      if (normalizeNullablePath(node.modelsPath) !== normalizeNullablePath(target.modelsPath)) {
        return false;
      }
      if (target.type === "openai-compatible" && node.apiType !== target.apiType) return false;
      return true;
    }) || null
  );
}

// GET /api/provider-nodes - List all provider nodes
export async function GET() {
  try {
    const nodes = await getProviderNodes();
    return NextResponse.json({
      nodes,
      ccCompatibleProviderEnabled: isCcCompatibleProviderEnabled(),
    });
  } catch (error) {
    console.log("Error fetching provider nodes:", error);
    return NextResponse.json({ error: "Failed to fetch provider nodes" }, { status: 500 });
  }
}

// POST /api/provider-nodes - Create provider node
export async function POST(request) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(createProviderNodeSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const {
      name,
      prefix,
      apiType,
      baseUrl,
      type,
      compatMode,
      chatPath,
      modelsPath,
      customHeaders,
    } = validation.data;

    // Determine type
    const nodeType = type || "openai-compatible";

    if (nodeType === "openai-compatible") {
      const target = {
        type: "openai-compatible",
        apiType,
        baseUrl: (baseUrl || OPENAI_COMPATIBLE_DEFAULTS.baseUrl).trim(),
        chatPath: chatPath || null,
        modelsPath: modelsPath || null,
      };
      const existing = findExistingCompatibleNode(
        await getProviderNodes({ type: target.type }),
        target
      );
      if (existing) {
        return NextResponse.json({ node: existing, reused: true }, { status: 200 });
      }

      const node = await createProviderNode({
        id: `${OPENAI_COMPATIBLE_PREFIX}${apiType}-${generateId()}`,
        type: "openai-compatible",
        prefix: prefix.trim(),
        apiType,
        baseUrl: target.baseUrl,
        name: name.trim(),
        chatPath: target.chatPath,
        modelsPath: target.modelsPath,
        customHeaders: customHeaders || null,
      });
      return NextResponse.json({ node }, { status: 201 });
    }

    if (nodeType === "anthropic-compatible") {
      if (compatMode === "cc" && !isCcCompatibleProviderEnabled()) {
        return NextResponse.json({ error: "CC Compatible provider is disabled" }, { status: 403 });
      }

      const rawBaseUrl = baseUrl || ANTHROPIC_COMPATIBLE_DEFAULTS.baseUrl;
      const sanitizedBaseUrl =
        compatMode === "cc"
          ? sanitizeClaudeCodeCompatibleBaseUrl(rawBaseUrl)
          : sanitizeAnthropicBaseUrl(rawBaseUrl);
      const target = {
        type: "anthropic-compatible",
        baseUrl: sanitizedBaseUrl,
        chatPath: chatPath || null,
        modelsPath: compatMode === "cc" ? null : modelsPath || null,
      };
      const existing = findExistingCompatibleNode(
        await getProviderNodes({ type: target.type }),
        target
      );
      if (existing) {
        return NextResponse.json({ node: existing, reused: true }, { status: 200 });
      }

      const node = await createProviderNode({
        id:
          compatMode === "cc"
            ? `${CLAUDE_CODE_COMPATIBLE_PREFIX}${generateId()}`
            : `${ANTHROPIC_COMPATIBLE_PREFIX}${generateId()}`,
        type: "anthropic-compatible",
        prefix: prefix.trim(),
        baseUrl: target.baseUrl,
        name: name.trim(),
        chatPath: target.chatPath,
        modelsPath: target.modelsPath,
        customHeaders: customHeaders || null,
      });
      return NextResponse.json({ node }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid provider node type" }, { status: 400 });
  } catch (error) {
    console.log("Error creating provider node:", error);
    return NextResponse.json({ error: "Failed to create provider node" }, { status: 500 });
  }
}
