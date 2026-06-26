import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-model-pool-sources-"));
const originalDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = tmpDir;

const { ensureDbInitialized, getDbInstance, resetDbInstance } =
  await import("../../src/lib/db/core.ts");
const { replaceSyncedAvailableModelsForConnection } = await import("../../src/lib/db/models.ts");
const { saveModelPoolVerification } = await import("../../src/lib/db/cliToolState.ts");
const { buildModelPoolSources } = await import("../../src/lib/modelPoolSources.ts");

async function resetStorage() {
  resetDbInstance();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  await ensureDbInitialized();
}

function insertConnection(id: string, isActive: boolean) {
  const now = new Date().toISOString();
  getDbInstance()
    .prepare(
      "INSERT INTO provider_connections (id, provider, auth_type, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(id, "openai-compatible-pool", "apikey", isActive ? 1 : 0, now, now);
}

beforeEach(async () => {
  await resetStorage();
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

test("buildModelPoolSources ignores inactive connections even when they have verified models", async () => {
  insertConnection("conn-active", true);
  insertConnection("conn-inactive", false);

  await replaceSyncedAvailableModelsForConnection("openai-compatible-pool", "conn-active", [
    { id: "active-model", name: "Active Model", source: "imported" },
  ]);
  await replaceSyncedAvailableModelsForConnection("openai-compatible-pool", "conn-inactive", [
    { id: "inactive-model", name: "Inactive Model", source: "imported" },
  ]);

  for (const [model, connectionId] of [
    ["openai-compatible-pool/active-model", "conn-active"],
    ["openai-compatible-pool/inactive-model", "conn-inactive"],
  ]) {
    saveModelPoolVerification({
      tool: "model-pool",
      model,
      provider: "openai-compatible-pool",
      connectionId,
      status: "ok",
      checkedAt: "2026-01-01T00:00:00.000Z",
    });
  }

  const sources = await buildModelPoolSources({ client: "all" });

  assert.ok(sources.some((source) => source.value === "openai-compatible-pool/active-model"));
  assert.equal(
    sources.some((source) => source.value === "openai-compatible-pool/inactive-model"),
    false
  );
});
