import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { POST as postChatCompletion } from "@/app/api/v1/chat/completions/route";
import { POST as postClaudeMessages } from "@/app/api/v1/messages/route";
import { POST as postResponses } from "@/app/api/v1/responses/route";
import { runSingleModelTest } from "@/lib/api/modelTestRunner";
import { requireCliToolsAuth } from "@/lib/api/requireCliToolsAuth";
import { buildComboTestRequestBody, extractComboTestResponseText } from "@/lib/combos/testHealth";
import { saveModelPoolVerification, type ModelPoolVerificationStatus } from "@/lib/localDb";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";

const INTERNAL_ORIGIN = "http://omniroute.internal";
const VERIFY_TIMEOUT_MS = 20_000;

const verifySchema = z
  .object({
    tool: z.enum(["claude", "claude-desktop", "codex", "codex-desktop"]),
    model: z.string().trim().min(1).optional(),
    models: z.array(z.string().trim().min(1)).max(5).optional(),
    connectionId: z.string().trim().min(1).optional(),
    modelConnections: z.record(z.string().trim().min(1), z.string().trim().min(1)).optional(),
    wireApi: z.enum(["chat", "responses"]).optional(),
  })
  .refine((value) => !!value.model || (Array.isArray(value.models) && value.models.length > 0), {
    message: "model or models is required",
    path: ["model"],
  });

type ProbeStatus = "ok" | "error";

type ProbeResult = {
  status: ProbeStatus;
  latencyMs: number;
  error?: string;
  statusCode?: number;
  responseText?: string;
};

type VerificationDiagnosis = {
  layer: "模型池" | "AnyRoute 协议适配" | "上游渠道" | "客户端配置";
  reason:
    | "ok"
    | "partial"
    | "invalid_key"
    | "model_not_found"
    | "rate_limited"
    | "protocol_unsupported"
    | "streaming_unsupported"
    | "tools_unsupported"
    | "timeout"
    | "empty_response"
    | "unknown";
  message: string;
};

function getProviderId(model: string) {
  const slashIdx = model.indexOf("/");
  if (slashIdx > 0) return model.slice(0, slashIdx);
  return "auto";
}

export function buildInternalRequest(
  path: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  connectionId?: string
) {
  return new Request(`${INTERNAL_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "X-Internal-Test": "cli-tool-verify",
      "X-OmniRoute-No-Cache": "true",
      ...(connectionId ? { "X-OmniRoute-Connection": connectionId } : {}),
      "X-Request-Id": `cli-tool-verify-${randomUUID()}`,
    },
    body: JSON.stringify(body),
    signal,
  });
}

async function runProbe(
  path: string,
  body: Record<string, unknown>,
  handler: (request: Request, context?: unknown) => Promise<Response> | Response,
  connectionId?: string
): Promise<ProbeResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await handler(
      buildInternalRequest(path, body, controller.signal, connectionId),
      {}
    );
    const latencyMs = Date.now() - startedAt;
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return {
        status: "error",
        latencyMs,
        statusCode: response.status,
        error: extractError(parsed, response.statusText || "Verification failed"),
      };
    }

    const responseText = extractComboTestResponseText(parsed);
    if (!responseText) {
      return {
        status: "error",
        latencyMs,
        statusCode: response.status,
        error: "Verification returned no text content.",
      };
    }

    return { status: "ok", latencyMs, responseText };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: sanitizeErrorMessage(error) || "Verification failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runStreamProbe(
  path: string,
  body: Record<string, unknown>,
  handler: (request: Request, context?: unknown) => Promise<Response> | Response,
  connectionId?: string
): Promise<ProbeResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await handler(
      buildInternalRequest(path, body, controller.signal, connectionId),
      {}
    );
    const latencyMs = Date.now() - startedAt;
    const text = await response.text().catch(() => "");

    if (!response.ok) {
      return {
        status: "error",
        latencyMs,
        statusCode: response.status,
        error: text || response.statusText || "Streaming verification failed",
      };
    }

    if (!text.includes("data:") && !text.includes("event:")) {
      return {
        status: "error",
        latencyMs,
        statusCode: response.status,
        error: "Streaming verification did not return an SSE payload.",
      };
    }

    return { status: "ok", latencyMs, responseText: "[stream verified]" };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: sanitizeErrorMessage(error) || "Streaming verification failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function hasToolSignal(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, any>;

  if (Array.isArray(record.content)) {
    return record.content.some((part) => part?.type === "tool_use");
  }

  if (Array.isArray(record.choices)) {
    return record.choices.some((choice) => {
      const message = choice?.message || {};
      return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
    });
  }

  if (Array.isArray(record.output)) {
    return record.output.some((item) => {
      const type = String(item?.type || "");
      return type.includes("function") || type.includes("tool");
    });
  }

  return false;
}

async function runToolProbe(
  path: string,
  body: Record<string, unknown>,
  handler: (request: Request, context?: unknown) => Promise<Response> | Response,
  connectionId?: string
): Promise<ProbeResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await handler(
      buildInternalRequest(path, body, controller.signal, connectionId),
      {}
    );
    const latencyMs = Date.now() - startedAt;
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return {
        status: "error",
        latencyMs,
        statusCode: response.status,
        error: extractError(parsed, response.statusText || "Tool verification failed"),
      };
    }

    if (!hasToolSignal(parsed)) {
      return {
        status: "error",
        latencyMs,
        statusCode: response.status,
        error: "Tool verification completed, but no tool call was observed.",
      };
    }

    return { status: "ok", latencyMs, responseText: "[tool call verified]" };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: sanitizeErrorMessage(error) || "Tool verification failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractError(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (record.error && typeof record.error === "object") {
      const message = (record.error as Record<string, unknown>).message;
      if (typeof message === "string") return message;
    }
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}

function getPrimaryFailure(probes: Record<string, ProbeResult>) {
  return (
    Object.entries(probes).find(
      ([name, probe]) =>
        probe.status === "error" && (name === "claude" || name === "chat" || name === "responses")
    ) || Object.entries(probes).find(([, probe]) => probe.status === "error")
  );
}

function diagnoseVerification(
  status: ModelPoolVerificationStatus,
  probes: Record<string, ProbeResult>
): VerificationDiagnosis {
  if (status === "ok") {
    return { layer: "客户端配置", reason: "ok", message: "客户端链路验证通过。" };
  }

  const failed = getPrimaryFailure(probes);
  if (!failed) {
    return {
      layer: "客户端配置",
      reason: "partial",
      message: "基础链路可用，但部分扩展能力尚未验证通过。",
    };
  }

  const [probeName, probe] = failed;
  const message = (probe.error || "").toLowerCase();
  const statusCode = probe.statusCode;

  if (statusCode === 401 || statusCode === 403 || message.includes("invalid api key")) {
    return {
      layer: "上游渠道",
      reason: "invalid_key",
      message: "上游渠道拒绝了当前 key，请检查路由连接的 API Key。",
    };
  }

  if (
    statusCode === 404 ||
    message.includes("model") ||
    message.includes("not found") ||
    message.includes("does not exist")
  ) {
    return {
      layer: "模型池",
      reason: "model_not_found",
      message: "模型池选择的模型在当前上游不可用，请换一个模型或重新同步渠道模型。",
    };
  }

  if (statusCode === 429 || message.includes("rate limit") || message.includes("quota")) {
    return {
      layer: "上游渠道",
      reason: "rate_limited",
      message: "上游渠道正在限流或额度不足，稍后重试或切换其他模型来源。",
    };
  }

  if (probeName.includes("stream") || message.includes("sse")) {
    return {
      layer: "上游渠道",
      reason: "streaming_unsupported",
      message: "基础链路可用，但该模型或渠道没有通过流式输出验证。",
    };
  }

  if (probeName.includes("tools") || message.includes("tool")) {
    return {
      layer: "上游渠道",
      reason: "tools_unsupported",
      message: "基础链路可用，但该模型或渠道没有通过工具调用验证。",
    };
  }

  if (message.includes("abort") || message.includes("timeout")) {
    return {
      layer: "上游渠道",
      reason: "timeout",
      message: "上游渠道响应超时，请检查渠道可用性或稍后重试。",
    };
  }

  if (message.includes("no text") || message.includes("empty")) {
    return {
      layer: "AnyRoute 协议适配",
      reason: "empty_response",
      message: "AnyRoute 收到了响应，但没有解析到可用文本内容。",
    };
  }

  return {
    layer: "AnyRoute 协议适配",
    reason: "protocol_unsupported",
    message: probe.error || "协议适配验证失败，请检查该模型是否支持当前客户端协议。",
  };
}

async function verifyChat(model: string, connectionId?: string) {
  const result = await runSingleModelTest({
    providerId: getProviderId(model),
    modelId: model,
    ...(connectionId ? { connectionId } : {}),
    timeoutMs: VERIFY_TIMEOUT_MS,
  });

  if (result.status === "ok") {
    return {
      status: "ok" as const,
      latencyMs: result.latencyMs,
      responseText: result.responseText,
      statusCode: result.statusCode,
    };
  }

  return {
    status: "error" as const,
    latencyMs: result.latencyMs,
    statusCode: result.statusCode || result.httpStatus,
    error: result.error || "Chat Completions verification failed",
  };
}

async function verifyChatStream(model: string, connectionId?: string) {
  return runStreamProbe(
    "/v1/chat/completions",
    { ...buildComboTestRequestBody(model), stream: true },
    (request) => postChatCompletion(request),
    connectionId
  );
}

async function verifyChatTools(model: string, connectionId?: string) {
  return runToolProbe(
    "/v1/chat/completions",
    {
      model,
      messages: [{ role: "user", content: "Call the add_numbers tool with 12345 and 67890." }],
      tools: [
        {
          type: "function",
          function: {
            name: "add_numbers",
            description: "Add two numbers.",
            parameters: {
              type: "object",
              properties: {
                a: { type: "number" },
                b: { type: "number" },
              },
              required: ["a", "b"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "add_numbers" } },
      stream: false,
      max_tokens: 512,
    },
    (request) => postChatCompletion(request),
    connectionId
  );
}

async function verifyResponses(model: string, connectionId?: string) {
  return runProbe(
    "/v1/responses",
    {
      model,
      input: "Calculate 12345+67890, and reply with the result only.",
      max_output_tokens: 2048,
      stream: false,
    },
    (request, context) => postResponses(request, context),
    connectionId
  );
}

async function verifyResponsesStream(model: string, connectionId?: string) {
  return runStreamProbe(
    "/v1/responses",
    {
      model,
      input: "Calculate 12345+67890, and reply with the result only.",
      max_output_tokens: 2048,
      stream: true,
    },
    (request, context) => postResponses(request, context),
    connectionId
  );
}

async function verifyClaude(model: string, connectionId?: string) {
  return runProbe(
    "/v1/messages",
    {
      model,
      max_tokens: 2048,
      stream: false,
      messages: [
        { role: "user", content: "Calculate 12345+67890, and reply with the result only." },
      ],
    },
    (request) => postClaudeMessages(request),
    connectionId
  );
}

async function verifyClaudeStream(model: string, connectionId?: string) {
  return runStreamProbe(
    "/v1/messages",
    {
      model,
      max_tokens: 2048,
      stream: true,
      messages: [
        { role: "user", content: "Calculate 12345+67890, and reply with the result only." },
      ],
    },
    (request) => postClaudeMessages(request),
    connectionId
  );
}

async function verifyClaudeTools(model: string, connectionId?: string) {
  return runToolProbe(
    "/v1/messages",
    {
      model,
      max_tokens: 512,
      stream: false,
      messages: [{ role: "user", content: "Call add_numbers with 12345 and 67890." }],
      tools: [
        {
          name: "add_numbers",
          description: "Add two numbers.",
          input_schema: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" },
            },
            required: ["a", "b"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "add_numbers" },
    },
    (request) => postClaudeMessages(request),
    connectionId
  );
}

async function verifyOneModel({
  tool,
  model,
  connectionId,
  wireApi,
}: {
  tool: "claude" | "claude-desktop" | "codex" | "codex-desktop";
  model: string;
  connectionId?: string;
  wireApi?: "chat" | "responses";
}) {
  const probes: Record<string, ProbeResult> = {};

  if (tool === "claude" || tool === "claude-desktop") {
    const [claude, claudeStream, claudeTools] = await Promise.all([
      verifyClaude(model, connectionId),
      verifyClaudeStream(model, connectionId),
      verifyClaudeTools(model, connectionId),
    ]);
    probes.claude = claude;
    probes.claude_stream = claudeStream;
    probes.claude_tools = claudeTools;
  } else {
    const first = wireApi === "chat" ? "chat" : "responses";
    const second = first === "chat" ? "responses" : "chat";
    const [firstProbe, secondProbe, streamProbe, toolProbe] = await Promise.all([
      first === "chat" ? verifyChat(model, connectionId) : verifyResponses(model, connectionId),
      second === "chat" ? verifyChat(model, connectionId) : verifyResponses(model, connectionId),
      first === "chat"
        ? verifyChatStream(model, connectionId)
        : verifyResponsesStream(model, connectionId),
      verifyChatTools(model, connectionId),
    ]);
    probes[first] = firstProbe;
    probes[second] = secondProbe;
    probes[`${first}_stream`] = streamProbe;
    probes.chat_tools = toolProbe;
  }

  const ok =
    (probes.claude && probes.claude.status === "ok") ||
    (probes.chat && probes.chat.status === "ok") ||
    (probes.responses && probes.responses.status === "ok");
  const hasProbeError = Object.values(probes).some((probe) => probe.status === "error");
  const status: ModelPoolVerificationStatus = ok ? (hasProbeError ? "partial" : "ok") : "error";
  const provider = getProviderId(model);
  const diagnosis = diagnoseVerification(status, probes);
  saveModelPoolVerification({
    tool,
    model,
    provider,
    ...(connectionId ? { connectionId } : {}),
    status,
    checkedAt: new Date().toISOString(),
    probes,
    diagnosis,
  });

  return NextResponse.json(
    {
      status,
      tool,
      model,
      provider,
      connectionId: connectionId || null,
      probes,
      diagnosis,
    },
    { status: ok ? 200 : 502 }
  );
}

export async function POST(request: Request) {
  const authError = await requireCliToolsAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tool, model, models, connectionId, modelConnections, wireApi } = parsed.data;
  const modelsToVerify = [...new Set(models && models.length > 0 ? models : [model as string])];
  const results = [];
  for (const item of modelsToVerify) {
    const response = await verifyOneModel({
      tool,
      model: item,
      connectionId: modelConnections?.[item] || connectionId,
      wireApi,
    });
    const body = await response.json().catch(() => null);
    results.push({
      ...(body && typeof body === "object" ? body : { model: item, status: "error" }),
      httpStatus: response.status,
    });
  }

  if (modelsToVerify.length === 1) {
    const result = results[0];
    const { httpStatus, ...body } = result;
    return NextResponse.json(body, { status: typeof httpStatus === "number" ? httpStatus : 502 });
  }

  const hasError = results.some((result) => result.status === "error");
  const hasPartial = results.some((result) => result.status === "partial");
  const status: ModelPoolVerificationStatus = hasError ? "error" : hasPartial ? "partial" : "ok";
  return NextResponse.json(
    {
      status,
      tool,
      results,
      diagnosis: hasError
        ? {
            layer: "模型池",
            reason: "model_not_found",
            message: "部分模型未通过验证，请检查失败模型或切换模型来源。",
          }
        : hasPartial
          ? {
              layer: "客户端配置",
              reason: "partial",
              message: "所有模型基础链路可用，但部分扩展能力尚未验证通过。",
            }
          : { layer: "客户端配置", reason: "ok", message: "客户端链路验证通过。" },
    },
    { status: hasError ? 502 : 200 }
  );
}
