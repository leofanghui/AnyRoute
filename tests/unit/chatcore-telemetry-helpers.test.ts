import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolated DATA_DIR set BEFORE importing anything that may touch the DB
// (maybeSyncClaudeExtraUsageState -> fetchLiveProviderLimits -> getProviderConnectionById).
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-telemetry-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const { maybeSyncClaudeExtraUsageState } =
  await import("../../open-sse/handlers/chatCore/telemetryHelpers.ts");
const core = await import("../../src/lib/db/core.ts");

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test.after(() => {
  globalThis.fetch = originalFetch;
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("maybeSyncClaudeExtraUsageState returns early when connectionId is falsy (no fetch)", async () => {
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("", { status: 200 });
  }) as typeof fetch;

  await maybeSyncClaudeExtraUsageState({
    provider: "claude",
    connectionId: null,
    providerSpecificData: {},
    log: null,
  });

  assert.equal(fetchCalled, false, "guard short-circuits before any network/DB work");
});

test("maybeSyncClaudeExtraUsageState returns early for non-claude provider (block disabled)", async () => {
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("", { status: 200 });
  }) as typeof fetch;

  await maybeSyncClaudeExtraUsageState({
    provider: "openai",
    connectionId: "some-conn",
    providerSpecificData: {},
    log: null,
  });

  assert.equal(fetchCalled, false, "isClaudeExtraUsageBlockEnabled is false for non-claude");
});

test("maybeSyncClaudeExtraUsageState returns early for claude with blockExtraUsage:false", async () => {
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("", { status: 200 });
  }) as typeof fetch;

  await maybeSyncClaudeExtraUsageState({
    provider: "claude",
    connectionId: "some-conn",
    providerSpecificData: { blockExtraUsage: false },
    log: null,
  });

  assert.equal(fetchCalled, false, "explicit blockExtraUsage:false disables the block");
});

test("maybeSyncClaudeExtraUsageState enters the try for claude+enabled, swallows the error, and logs via log.debug", async () => {
  // provider=claude, providerSpecificData={} (blockExtraUsage !== false), connectionId set
  // -> passes the guard -> calls the REAL fetchLiveProviderLimits("bogus-conn") which
  // looks the connection up in the (empty) DB, finds nothing, throws "Connection not found",
  // and the function's internal try/catch swallows it while logging to log.debug.
  const calls: unknown[][] = [];
  const log = {
    debug: (...args: unknown[]) => {
      calls.push(args);
    },
  };

  await assert.doesNotReject(
    maybeSyncClaudeExtraUsageState({
      provider: "claude",
      connectionId: "bogus-conn-id",
      providerSpecificData: {},
      log,
    })
  );

  assert.equal(calls.length, 1, "the swallowed error path logs exactly once");
  assert.equal(calls[0][0], "CLAUDE_USAGE");
  assert.match(
    String(calls[0][1]),
    /Failed to sync Claude extra-usage state:/,
    "logs the sync-failure message with the underlying error text"
  );
});
