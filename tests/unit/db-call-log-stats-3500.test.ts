import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omni-db-callogstats-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const stats = await import("../../src/lib/db/callLogStats.ts");

let idSeq = 0;
function insertCallLog(row: Record<string, unknown>) {
  const db = core.getDbInstance();
  const full = {
    method: "POST",
    path: "/v1/chat/completions",
    status: 200,
    model: "openai/gpt-4.1",
    requested_model: null,
    provider: "openai",
    account: null,
    connection_id: null,
    duration: 100,
    tokens_in: 10,
    tokens_out: 20,
    cache_source: "upstream",
    source_format: null,
    target_format: null,
    api_key_id: null,
    api_key_name: null,
    combo_name: null,
    combo_step_id: null,
    combo_execution_key: null,
    error_summary: null,
    detail_state: "none",
    artifact_relpath: null,
    artifact_size_bytes: null,
    artifact_sha256: null,
    has_request_body: 0,
    has_response_body: 0,
    has_pipeline_details: 0,
    request_summary: null,
    request_type: null,
    ...row,
    id: row.id ?? `log-${++idSeq}`,
    timestamp: row.timestamp ?? new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO call_logs (
      id, timestamp, method, path, status, model, requested_model, provider, account,
      connection_id, duration, tokens_in, tokens_out, cache_source, source_format, target_format,
      api_key_id, api_key_name, combo_name, combo_step_id, combo_execution_key,
      error_summary, detail_state, artifact_relpath, artifact_size_bytes, artifact_sha256,
      has_request_body, has_response_body, has_pipeline_details, request_summary, request_type
    ) VALUES (
      @id, @timestamp, @method, @path, @status, @model, @requested_model, @provider, @account,
      @connection_id, @duration, @tokens_in, @tokens_out, @cache_source, @source_format, @target_format,
      @api_key_id, @api_key_name, @combo_name, @combo_step_id, @combo_execution_key,
      @error_summary, @detail_state, @artifact_relpath, @artifact_size_bytes, @artifact_sha256,
      @has_request_body, @has_response_body, @has_pipeline_details, @request_summary, @request_type
    )`
  ).run(full);
}

test.before(() => {
  core.resetDbInstance();
});

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("getProviderMetrics aggregates totals and last error state per provider", () => {
  const ts1 = "2025-06-01T10:00:00.000Z";
  const ts2 = "2025-06-01T11:00:00.000Z";
  insertCallLog({ provider: "openai", status: 200, duration: 100, timestamp: ts1 });
  insertCallLog({
    provider: "openai",
    status: 500,
    duration: 200,
    timestamp: ts2,
    error_summary: "upstream exploded",
  });
  insertCallLog({ provider: "anthropic", status: 200, duration: 50 });
  insertCallLog({ provider: "-", status: 200 });

  const rows = stats.getProviderMetrics();
  assert.ok(!rows.some((row) => row.provider === "-"));

  const openai = rows.find((row) => row.provider === "openai");
  assert.ok(openai);
  assert.equal(openai.totalRequests, 2);
  assert.equal(openai.totalSuccesses, 1);
  assert.equal(openai.avgLatencyMs, 150);
  assert.equal(openai.lastErrorAt, ts2);
  assert.equal(openai.lastStatus, 500);
  assert.equal(openai.lastErrorStatus, 500);

  const anthropic = rows.find((row) => row.provider === "anthropic");
  assert.ok(anthropic);
  assert.equal(anthropic.totalRequests, 1);
  assert.equal(anthropic.totalSuccesses, 1);
  assert.equal(anthropic.lastErrorAt, null);
});

test("getFallbackStats counts model fallback rows outside combo traffic", () => {
  insertCallLog({
    id: "fallback-requested",
    requested_model: "openai/gpt-5",
    model: "gpt-4.1",
    combo_name: null,
  });
  insertCallLog({
    id: "no-fallback",
    requested_model: "openai/gpt-4.1",
    model: "gpt-4.1",
    combo_name: null,
  });
  insertCallLog({
    id: "combo-traffic",
    requested_model: "openai/gpt-5",
    model: "gpt-4.1",
    combo_name: "combo-a",
  });

  const row = stats.getFallbackStats("", {});
  assert.ok(row.total >= 2);
  assert.ok(row.with_requested >= 2);
  assert.ok(row.fallback_eligible >= 2);
  assert.ok(row.fallbacks >= 1);
});
