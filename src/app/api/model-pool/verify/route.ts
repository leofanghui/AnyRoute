import { NextResponse } from "next/server";
import { z } from "zod";

import { runSingleModelTest } from "@/lib/api/modelTestRunner";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { saveModelPoolVerification } from "@/lib/localDb";
import { buildModelPoolSources, normalizeModelPoolClient } from "@/lib/modelPoolSources";
import type { ModelPoolClient, ModelPoolSource } from "@/shared/utils/modelPool";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";

const DEFAULT_LIMIT = 30;
const CONNECTION_LIMIT = 12;
const MAX_LIMIT = 80;
const VERIFY_CONCURRENCY = 2;
const MODEL_POOL_VERIFY_TIMEOUT_MS = 8_000;

const verifySchema = z.object({
  client: z.enum(["all", "claude", "codex"]).optional(),
  connectionId: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
});

function getVerificationStatus(source: ModelPoolSource) {
  const verification = source.verification;
  if (!verification || typeof verification !== "object") return "";
  const status = (verification as Record<string, unknown>).status;
  return typeof status === "string" ? status : "";
}

function getSourcePriority(source: ModelPoolSource) {
  if (source.source === "detected") return 0;
  if (source.source === "imported") return 1;
  if (source.source === "custom") return 2;
  if (source.source === "system") return 3;
  return 4;
}

function selectCandidates(sources: ModelPoolSource[], limit: number) {
  return [...sources]
    .sort((a, b) => {
      const statusA = getVerificationStatus(a);
      const statusB = getVerificationStatus(b);
      const okDiff = Number(statusA === "ok") - Number(statusB === "ok");
      if (okDiff !== 0) return okDiff;

      const sourceDiff = getSourcePriority(a) - getSourcePriority(b);
      if (sourceDiff !== 0) return sourceDiff;

      return (a.value || "").localeCompare(b.value || "");
    })
    .slice(0, limit);
}

function getProviderId(model: string) {
  const slashIdx = model.indexOf("/");
  if (slashIdx > 0) return model.slice(0, slashIdx);
  return "auto";
}

async function verifyCandidate(source: ModelPoolSource, client: ModelPoolClient) {
  void client;
  const tool = "model-pool";
  const providerId = source.provider || getProviderId(source.value);
  const result = await runSingleModelTest({
    providerId,
    modelId: source.value,
    ...(source.connectionId ? { connectionId: source.connectionId } : {}),
    timeoutMs: MODEL_POOL_VERIFY_TIMEOUT_MS,
  });
  const ok = result.status === "ok";
  const status = ok ? "ok" : "error";
  const probe = {
    status,
    latencyMs: result.latencyMs,
    statusCode: result.statusCode || result.httpStatus,
    ...(result.responseText ? { responseText: result.responseText } : {}),
    ...(result.error ? { error: result.error } : {}),
  };
  const diagnosis = ok
    ? { layer: "模型池", reason: "ok", message: "模型基础链路验证通过。" }
    : {
        layer: result.rateLimited || result.isTimeout ? "上游渠道" : "模型池",
        reason: result.rateLimited ? "rate_limited" : result.isTimeout ? "timeout" : "unknown",
        message: result.error || "模型基础链路验证失败。",
      };

  saveModelPoolVerification({
    tool,
    model: source.value,
    provider: providerId,
    ...(source.connectionId ? { connectionId: source.connectionId } : {}),
    status,
    checkedAt: new Date().toISOString(),
    probes: { chat: probe },
    diagnosis,
  });

  return {
    source: source.value,
    modelId: source.modelId,
    provider: providerId,
    connectionId: source.connectionId || null,
    tool,
    httpStatus: result.httpStatus,
    status,
    model: source.value,
    probes: { chat: probe },
    diagnosis,
  };
}

async function verifyInBatches(candidates: ModelPoolSource[], client: ModelPoolClient) {
  const results = [];
  for (let index = 0; index < candidates.length; index += VERIFY_CONCURRENCY) {
    const batch = candidates.slice(index, index + VERIFY_CONCURRENCY);
    results.push(...(await Promise.all(batch.map((source) => verifyCandidate(source, client)))));
  }
  return results;
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }

  const parsed = verifySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const client = normalizeModelPoolClient(parsed.data.client);
    const limit =
      parsed.data.limit || (parsed.data.connectionId ? CONNECTION_LIMIT : DEFAULT_LIMIT);
    const sources = await buildModelPoolSources({
      client,
      connectionId: parsed.data.connectionId,
    });
    const candidates = selectCandidates(sources, limit);
    const results = await verifyInBatches(candidates, client);
    const passed = results.filter((result) => result.status === "ok").length;
    const partial = results.filter((result) => result.status === "partial").length;
    const failed = results.filter((result) => result.status === "error").length;

    return NextResponse.json({
      status: failed > 0 ? "partial" : "ok",
      totalCandidates: sources.length,
      verified: results.length,
      passed,
      partial,
      failed,
      limit,
      results,
    });
  } catch (error) {
    console.log("Error verifying model pool:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to verify model pool" },
      { status: 500 }
    );
  }
}
