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
  buildClaudeCodeCompatibleHeaders,
  CLAUDE_CODE_COMPATIBLE_DEFAULT_MODELS_PATH,
  joinBaseUrlAndPath,
} from "@omniroute/open-sse/services/claudeCodeCompatible.ts";
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
    .replace(/\/messages(?:\?[^#]*)?$/i, "")
    .replace(/\/(v\d+)\/\1$/i, "/$1");
}

function sanitizeClaudeCodeCompatibleBaseUrl(baseUrl: string) {
  return (baseUrl || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/\/(?:v\d+\/)?messages(?:\?[^#]*)?$/i, "")
    .replace(/\/(v\d+)\/\1$/i, "/$1");
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

function sanitizeOpenAICompatibleBaseUrl(baseUrl: string) {
  return (baseUrl || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/\/(?:chat\/completions|responses|completions|models)(?:\?[^#]*)?$/i, "")
    .replace(/\/(v\d+)\/\1$/i, "/$1");
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
        body: init?.body,
        redirect: init?.allowRedirect ? "follow" : "manual",
        signal: init?.signal,
      });
    }
    throw error;
  }
}

function extractDiscoveredModels(payload: unknown) {
  const models = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.data)
      ? (payload as any).data
      : Array.isArray((payload as any)?.models)
        ? (payload as any).models
        : [];

  return models
    .map((model: any) => {
      const id = String(model?.id || model?.name || model?.model || model || "").trim();
      if (!id) return null;
      const name = String(model?.name || model?.displayName || model?.model || id).trim();
      return { id, name };
    })
    .filter(Boolean)
    .slice(0, 500);
}

function extractPayloadMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, any>;
  const candidates = [
    record.message,
    record.error,
    record.error?.message,
    record.error?.type,
    record.detail,
  ];
  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function isModelNotFoundPayload(payload: unknown) {
  const message = extractPayloadMessage(payload).toLowerCase();
  return (
    message.includes("model") &&
    (message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("not exist"))
  );
}

async function readJsonPayload(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function isJsonObjectResponse(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return false;

  try {
    const parsed = JSON.parse(text);
    return !!parsed && typeof parsed === "object";
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
      const payload = await readJsonPayload(response);
      const discoveredModels = extractDiscoveredModels(payload);
      if (response.ok && discoveredModels.length > 0) {
        return {
          valid: true,
          baseUrl: candidate.baseUrl,
          error: null,
          discoveredModels,
          modelCount: discoveredModels.length,
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Validation failed";
    }
  }

  return { valid: false, baseUrl: null, error: sawUnauthorized ? "Invalid API key" : lastError };
}

async function probeOpenAIEndpoint({
  baseUrl,
  apiKey,
  path,
  model,
}: {
  baseUrl: string;
  apiKey: string | undefined;
  path: "/chat/completions" | "/responses";
  model: string;
}) {
  const url = joinBaseUrlAndPath(baseUrl, path);
  const body =
    path === "/responses"
      ? { model, input: "Reply with ok.", max_output_tokens: 8, stream: false }
      : {
          model,
          messages: [{ role: "user", content: "Reply with ok." }],
          max_tokens: 8,
          stream: false,
        };

  try {
    const response = await fetchValidationUrl(url, {
      ...SAFE_OUTBOUND_FETCH_PRESETS.validationWrite,
      guard: getProviderOutboundGuard(),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey || ""}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 401 || response.status === 403) {
      return { available: false, error: "Invalid API key", status: response.status };
    }

    const payload = await readJsonPayload(response);
    const jsonLike = !!payload && typeof payload === "object";
    const compatibleError =
      jsonLike &&
      ([400, 422, 429].includes(response.status) ||
        (response.status === 404 && isModelNotFoundPayload(payload)));
    if (response.ok || compatibleError) {
      return { available: true, error: null, status: response.status };
    }

    return {
      available: false,
      error: `${path} unavailable: ${response.status}`,
      status: response.status,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : `${path} unavailable`,
    };
  }
}

async function validateAnthropicMessagesCandidate(
  baseUrl: string,
  apiKey: string | undefined,
  chatPath: string | undefined
) {
  const url = joinBaseUrlAndPath(baseUrl, chatPath || "/v1/messages");
  try {
    const response = await fetchValidationUrl(url, {
      ...SAFE_OUTBOUND_FETCH_PRESETS.validationWrite,
      guard: getProviderOutboundGuard(),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey || "",
        "anthropic-version": "2023-06-01",
        Authorization: `Bearer ${apiKey || ""}`,
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return { valid: false, baseUrl: null, error: "Invalid API key" };
    }

    if (response.ok && (await isJsonObjectResponse(response))) {
      return { valid: true, baseUrl, error: null, method: "messages_endpoint" };
    }

    if (
      (response.status === 400 || response.status === 422 || response.status === 429) &&
      (await isJsonObjectResponse(response))
    ) {
      return { valid: true, baseUrl, error: null, method: "messages_endpoint" };
    }

    return {
      valid: false,
      baseUrl: null,
      error: `Messages endpoint unavailable: ${response.status}`,
    };
  } catch (error) {
    return {
      valid: false,
      baseUrl: null,
      error: error instanceof Error ? error.message : "Messages endpoint unavailable",
    };
  }
}

async function validateOpenAICompatibleBase(
  baseUrl: string,
  apiKey: string | undefined,
  modelsPath: string | undefined
) {
  const modelsResult = await validateModelsCandidates(
    buildModelsCandidates(sanitizeOpenAICompatibleBaseUrl(baseUrl), modelsPath),
    {
      ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
      guard: getProviderOutboundGuard(),
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!modelsResult.valid || !modelsResult.baseUrl) return modelsResult;

  const probeModel = modelsResult.discoveredModels?.[0]?.id || "gpt-4o-mini";
  const [chat, responses] = await Promise.all([
    probeOpenAIEndpoint({
      baseUrl: modelsResult.baseUrl,
      apiKey,
      path: "/chat/completions",
      model: probeModel,
    }),
    probeOpenAIEndpoint({
      baseUrl: modelsResult.baseUrl,
      apiKey,
      path: "/responses",
      model: probeModel,
    }),
  ]);

  return {
    ...modelsResult,
    apiType: responses.available && !chat.available ? "responses" : "chat",
    capabilities: {
      openaiModels: true,
      openaiChat: chat.available,
      openaiResponses: responses.available,
      claudeMessages: false,
    },
    probes: { chat, responses },
  };
}

async function validateAnthropicCompatibleBase(
  baseUrl: string,
  apiKey: string | undefined,
  chatPath: string | undefined,
  modelsPath: string | undefined
) {
  const normalizedBase = sanitizeAnthropicBaseUrl(baseUrl);

  const modelsResult = await validateModelsCandidates(
    buildModelsCandidates(normalizedBase, modelsPath),
    {
      ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
      guard: getProviderOutboundGuard(),
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!modelsResult.valid && modelsResult.error !== "Invalid API key") {
    const messagesResult = await validateAnthropicMessagesCandidate(
      normalizedBase,
      apiKey,
      chatPath || undefined
    );
    if (messagesResult.valid || messagesResult.error === "Invalid API key") {
      return {
        ...messagesResult,
        capabilities: {
          openaiModels: false,
          openaiChat: false,
          openaiResponses: false,
          claudeMessages: messagesResult.valid,
        },
      };
    }
  }

  const messagesResult = await validateAnthropicMessagesCandidate(
    modelsResult.baseUrl || normalizedBase,
    apiKey,
    chatPath || undefined
  );

  return {
    ...modelsResult,
    capabilities: {
      openaiModels: false,
      openaiChat: false,
      openaiResponses: false,
      claudeMessages: messagesResult.valid,
    },
    probes: { messages: messagesResult },
  };
}

async function validateClaudeCodeCompatibleBase(
  baseUrl: string,
  apiKey: string | undefined,
  chatPath: string | undefined,
  modelsPath: string | undefined
) {
  const normalizedBase = sanitizeClaudeCodeCompatibleBaseUrl(baseUrl);
  const result = await validateClaudeCodeCompatibleProvider({
    apiKey,
    providerSpecificData: {
      baseUrl: normalizedBase,
      chatPath: chatPath || undefined,
      modelsPath: modelsPath || undefined,
    },
  });

  let discoveredModels: Array<{ id: string; name: string }> = [];
  if (result.valid) {
    const modelsResult = await validateModelsCandidates(
      [
        {
          url: joinBaseUrlAndPath(
            normalizedBase,
            modelsPath || CLAUDE_CODE_COMPATIBLE_DEFAULT_MODELS_PATH
          ),
          baseUrl: normalizedBase,
        },
      ],
      {
        ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
        guard: getProviderOutboundGuard(),
        method: "GET",
        headers: buildClaudeCodeCompatibleHeaders(apiKey || "", false),
      }
    );
    discoveredModels = modelsResult.discoveredModels || [];
  }

  return {
    valid: !!result.valid,
    baseUrl: result.valid ? normalizedBase : null,
    error: result.valid ? null : result.error || "Claude Code Compatible validation failed",
    warning: result.warning || null,
    method: result.method || null,
    discoveredModels,
    modelCount: discoveredModels.length,
    capabilities: {
      openaiModels: false,
      openaiChat: false,
      openaiResponses: false,
      claudeMessages: !!result.valid,
    },
    probes: { claudeCode: result },
  };
}

function classifyAutoDetectFailure(
  openaiResult: Record<string, any>,
  anthropicResult: Record<string, any>,
  ccResult: Record<string, any>
) {
  const errors = [openaiResult.error, anthropicResult.error, ccResult.error]
    .filter((error): error is string => typeof error === "string" && error.length > 0)
    .map((error) => error.toLowerCase());

  if (errors.some((error) => error.includes("invalid api key"))) {
    return {
      type: "invalid_key",
      message: "Invalid API key",
    };
  }

  if (
    errors.some(
      (error) =>
        error.includes("network") ||
        error.includes("fetch") ||
        error.includes("timeout") ||
        error.includes("timed out") ||
        error.includes("econnrefused") ||
        error.includes("enotfound") ||
        error.includes("unable to connect")
    )
  ) {
    return {
      type: "network_unreachable",
      message: "Base URL is unreachable",
    };
  }

  if (errors.some((error) => error.includes("models endpoint") || error.includes("no models"))) {
    return {
      type: "no_models",
      message: "No models were discovered from this route connection",
    };
  }

  return {
    type: "protocol_unsupported",
    message: "No compatible protocol was detected",
  };
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

    if (!type) {
      const [openaiResult, anthropicResult, ccResult] = await Promise.all([
        validateOpenAICompatibleBase(baseUrl, apiKey, modelsPath),
        validateAnthropicCompatibleBase(baseUrl, apiKey, chatPath, modelsPath),
        isCcCompatibleProviderEnabled()
          ? validateClaudeCodeCompatibleBase(baseUrl, apiKey, chatPath, modelsPath)
          : Promise.resolve({
              valid: false,
              baseUrl: null,
              error: "CC Compatible provider is disabled",
            }),
      ]);

      const openaiValid = !!(
        openaiResult.valid &&
        (openaiResult.capabilities?.openaiChat || openaiResult.capabilities?.openaiResponses)
      );
      const anthropicMessages = !!(
        anthropicResult.valid && anthropicResult.capabilities?.claudeMessages
      );
      const claudeCodeCompatible = !!ccResult.valid;
      const primaryResult = openaiValid
        ? {
            ...openaiResult,
            detectedType: "openai-compatible",
            apiType: openaiResult.apiType || "chat",
          }
        : anthropicMessages
          ? {
              ...anthropicResult,
              detectedType: "anthropic-compatible",
            }
          : claudeCodeCompatible
            ? {
                ...ccResult,
                detectedType: "claude-code-compatible",
              }
            : null;

      if (primaryResult) {
        const discoveredModels =
          primaryResult.discoveredModels?.length > 0
            ? primaryResult.discoveredModels
            : openaiResult.discoveredModels?.length > 0
              ? openaiResult.discoveredModels
              : ccResult.discoveredModels || [];
        const detectedTypes = [
          openaiValid ? "openai-compatible" : "",
          anthropicMessages ? "anthropic-compatible" : "",
          claudeCodeCompatible ? "claude-code-compatible" : "",
        ].filter(Boolean);

        return NextResponse.json({
          ...primaryResult,
          inputBaseUrl: baseUrl,
          detectedAt: new Date().toISOString(),
          discoveredModels,
          modelCount: discoveredModels.length,
          detectedTypes,
          capabilities: {
            openaiModels: openaiValid,
            openaiChat: !!openaiResult.capabilities?.openaiChat,
            openaiResponses: !!openaiResult.capabilities?.openaiResponses,
            claudeMessages: anthropicMessages || claudeCodeCompatible,
          },
          attempts: {
            openai: openaiResult,
            anthropic: anthropicResult,
            claudeCodeCompatible: ccResult,
          },
        });
      }

      const failure = classifyAutoDetectFailure(openaiResult, anthropicResult, ccResult);
      const invalidKey = failure.type === "invalid_key";
      return NextResponse.json({
        valid: false,
        baseUrl: null,
        inputBaseUrl: baseUrl,
        detectedAt: new Date().toISOString(),
        detectedType: null,
        errorType: invalidKey ? "invalid_key" : failure.type,
        error: invalidKey
          ? "Invalid API key"
          : `Auto-detect failed. OpenAI: ${openaiResult.error || "unavailable"}; Claude: ${
              anthropicResult.error || "unavailable"
            }; Claude Code Compatible: ${ccResult.error || "unavailable"}`,
        diagnosis: invalidKey
          ? { type: "invalid_key", message: "Invalid API key" }
          : { type: failure.type, message: failure.message },
        attempts: {
          openai: openaiResult,
          anthropic: anthropicResult,
          claudeCodeCompatible: ccResult,
        },
      });
    }

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

      const result = await validateAnthropicCompatibleBase(baseUrl, apiKey, chatPath, modelsPath);
      return NextResponse.json(result);
    }

    // OpenAI Compatible Validation (Default)
    const result = await validateOpenAICompatibleBase(baseUrl, apiKey, modelsPath);

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
