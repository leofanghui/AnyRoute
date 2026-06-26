import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const originalDataDir = process.env.DATA_DIR;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-connection-model-support-"));
process.env.DATA_DIR = tmpDir;

const { ensureDbInitialized, resetDbInstance } = await import("../../src/lib/db/core.ts");
const { saveModelPoolVerification } = await import("../../src/lib/db/cliToolState.ts");
const { replaceSyncedAvailableModelsForConnection } = await import("../../src/lib/db/models.ts");
const { filterConnectionsByKnownModelSupport } =
  await import("../../src/sse/services/connectionModelSupport.ts");

before(async () => {
  await ensureDbInitialized();
});

after(() => {
  resetDbInstance();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (originalDataDir === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = originalDataDir;
  }
});

test("filterConnectionsByKnownModelSupport keeps only connections with detected support", async () => {
  const connections = [
    {
      id: "conn-a",
      provider: "openai-compatible-test",
      providerSpecificData: {
        autoDetection: {
          discoveredModels: [{ id: "claude-sonnet-4-5" }],
        },
      },
    },
    {
      id: "conn-b",
      provider: "openai-compatible-test",
      providerSpecificData: {
        autoDetection: {
          discoveredModels: [{ id: "gpt-5.1-codex" }],
        },
      },
    },
  ];

  const filtered = await filterConnectionsByKnownModelSupport(
    "openai-compatible-test",
    connections,
    "gpt-5.1-codex"
  );

  assert.deepEqual(
    filtered.map((connection) => connection.id),
    ["conn-b"]
  );
});

test("filterConnectionsByKnownModelSupport uses synced model cache", async () => {
  await replaceSyncedAvailableModelsForConnection("openai-compatible-test", "conn-synced", [
    { id: "qwen3-coder", name: "Qwen3 Coder" },
  ]);

  const connections = [
    { id: "conn-other", provider: "openai-compatible-test", providerSpecificData: {} },
    { id: "conn-synced", provider: "openai-compatible-test", providerSpecificData: {} },
  ];

  const filtered = await filterConnectionsByKnownModelSupport(
    "openai-compatible-test",
    connections,
    "gateway/qwen3-coder"
  );

  assert.deepEqual(
    filtered.map((connection) => connection.id),
    ["conn-synced"]
  );
});

test("filterConnectionsByKnownModelSupport prefers model-pool verified connections", async () => {
  saveModelPoolVerification({
    tool: "codex",
    model: "gateway/gpt-5.1-codex",
    provider: "openai-compatible-test",
    connectionId: "conn-verified",
    status: "ok",
    checkedAt: new Date().toISOString(),
  });

  const connections = [
    {
      id: "conn-unverified",
      provider: "openai-compatible-test",
      providerSpecificData: {
        autoDetection: {
          discoveredModels: [{ id: "gpt-5.1-codex" }],
        },
      },
    },
    {
      id: "conn-verified",
      provider: "openai-compatible-test",
      providerSpecificData: {
        autoDetection: {
          discoveredModels: [{ id: "gpt-5.1-codex" }],
        },
      },
    },
  ];

  const filtered = await filterConnectionsByKnownModelSupport(
    "openai-compatible-test",
    connections,
    "gateway/gpt-5.1-codex"
  );

  assert.deepEqual(
    filtered.map((connection) => connection.id),
    ["conn-verified"]
  );
});

test("filterConnectionsByKnownModelSupport preserves old routing when there is no evidence", async () => {
  const connections = [
    { id: "conn-a", provider: "openai-compatible-test", providerSpecificData: {} },
    { id: "conn-b", provider: "openai-compatible-test", providerSpecificData: {} },
  ];

  const filtered = await filterConnectionsByKnownModelSupport(
    "openai-compatible-test",
    connections,
    "gpt-5.1-codex"
  );

  assert.deepEqual(filtered, connections);
});
