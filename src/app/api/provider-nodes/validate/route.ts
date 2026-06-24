import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getAuditRequestContext, logAuditEvent } from "@/lib/compliance/index";
import { validateClaudeCodeCompatibleProvider } from "@/lib/providers/validation";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  SafeOutboundFetchError,
  getSafeOutboundFetchErrorStatus,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import tlsClient from "@omniroute/open-sse/utils/tlsClient.ts";
import {
  PROVIDER_URL_BLOCKED_MESSAGE,
  getProviderOutboundGuard,
} from "@/shared/network/outboundUrlGuard";
import { isCcCompatibleProviderEnabled } from "@/shared/utils/featureFlags";
import { providerNodeValidateSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

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

function sanitizeAuditBaseUrl(baseUrl: string) {
  if (!baseUrl) return null;
  try {
    const parsed = new URL(baseUrl);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "") || parsed.origin;
  } catch {
    return baseUrl;
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function hasVersionPath(baseUrl: string) {
  try {
    const pathname = new URL(baseUrl).pathname.replace(/\/+$/, "");
    return /\/v\d+$/i.test(pathname);
  } catch {
    return false;
  }
}

function buildModelsCandidates(baseUrl: string, modelsPath?: string) {
  const normalizedBase = trimTrailingSlash(baseUrl);
  const path = modelsPath || "/models";
  const candidates = [{ url: `${normalizedBase}${path}`, baseUrl: normalizedBase }];

  if (!modelsPath && !hasVersionPath(normalizedBase)) {
    candidates.push({ url: `${normalizedBase}/v1/models`, baseUrl: `${normalizedBase}/v1` });
  }

  return candidates;
}

async function fetchValidationUrl(url: string, init: Parameters<typeof safeOutboundFetch>[1]) {
  try {
    return await safeOutboundFetch(url, init);
  } catch (error) {
    if (error instanceof SafeOutboundFetchError && error.code === "NETWORK_ERROR") {
      return await tlsClient.fetch(url, {
        method: init?.method,
        headers: init?.headers,
        redirect: init?.allowRedirect ? "follow" : "manual",
        signal: init?.signal,
      });
    }
    throw error;
  }
}

async function isModelsResponse(response: Response) {
  if (!response.ok) return false;

  const text = await response.text().catch(() => "");
  if (!text.trim()) return false;

  try {
    const json = JSON.parse(text);
    return Array.isArray(json) || Array.isArray(json?.data) || Array.isArray(json?.models);
  } catch {
    return false;
  }
}

async function validateModelsCandidates(
  candidates: Array<{ url: string; baseUrl: string }>,
  init: Parameters<typeof safeOutboundFetch>[1]
) {
  let sawUnauthorized = false;
  let lastError = "Invalid API key or models endpoint unavailable";

  for (const candidate of candidates) {
    try {
      const response = await fetchValidationUrl(candidate.url, init);
      if (response.status === 401 || response.status === 403) {
        sawUnauthorized = true;
        lastError = "Invalid API key";
        continue;
      }
      if (await isModelsResponse(response)) {
        return { valid: true, baseUrl: candidate.baseUrl, error: null };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Validation failed";
    }
  }

  return { valid: false, baseUrl: null, error: sawUnauthorized ? "Invalid API key" : lastError };
}

// POST /api/provider-nodes/validate - Validate API key against base URL
export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const auditContext = getAuditRequestContext(request);
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
    const validation = validateBody(providerNodeValidateSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { baseUrl, apiKey, type, compatMode, chatPath, modelsPath } = validation.data;

    // Anthropic Compatible Validation
    if (type === "anthropic-compatible") {
      if (compatMode === "cc") {
        if (!isCcCompatibleProviderEnabled()) {
          return NextResponse.json(
            { valid: false, error: "CC Compatible provider is disabled" },
            { status: 403 }
          );
        }

        const result = await validateClaudeCodeCompatibleProvider({
          apiKey,
          providerSpecificData: {
            baseUrl: sanitizeClaudeCodeCompatibleBaseUrl(baseUrl),
            chatPath: chatPath || undefined,
          },
        });

        return NextResponse.json({
          valid: !!result.valid,
          error: result.valid ? null : result.error || "Invalid API key",
          warning: result.warning || null,
          method: result.method || null,
        });
      }

      // Robustly construct URL: remove trailing slash, and remove trailing /messages if user added it
      const normalizedBase = sanitizeAnthropicBaseUrl(baseUrl);

      const result = await validateModelsCandidates(
        buildModelsCandidates(normalizedBase, modelsPath),
        {
          ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
          guard: getProviderOutboundGuard(),
          method: "GET",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            Authorization: `Bearer ${apiKey}`, // Add Bearer token for hybrid proxies
          },
        }
      );

      return NextResponse.json(result);
    }

    // OpenAI Compatible Validation (Default)
    const result = await validateModelsCandidates(buildModelsCandidates(baseUrl, modelsPath), {
      ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
      guard: getProviderOutboundGuard(),
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = getSafeOutboundFetchErrorStatus(error);
    if (status) {
      const message = error instanceof Error ? error.message : "Validation failed";
      if (
        error instanceof SafeOutboundFetchError &&
        error.code === "URL_GUARD_BLOCKED" &&
        message.includes(PROVIDER_URL_BLOCKED_MESSAGE)
      ) {
        const attemptedBaseUrl =
          rawBody && typeof rawBody === "object" && "baseUrl" in rawBody
            ? String((rawBody as { baseUrl?: unknown }).baseUrl || "")
            : "";
        logAuditEvent({
          action: "provider.validation.ssrf_blocked",
          actor: "admin",
          target: "provider-node",
          resourceType: "provider_validation",
          status: "blocked",
          ipAddress: auditContext.ipAddress || undefined,
          requestId: auditContext.requestId,
          metadata: {
            route: "/api/provider-nodes/validate",
            reason: message,
            baseUrl: sanitizeAuditBaseUrl(attemptedBaseUrl),
          },
        });
      }
      return NextResponse.json({ error: message }, { status });
    }
    console.log("Error validating provider node:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
