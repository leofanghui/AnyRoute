import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-active-synced-"));
const originalDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const modelsDb = await import("../../src/lib/db/models.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const { getActiveSyncedAvailableModels } =
  await import("../../src/lib/activeSyncedAvailableModels.ts");

async function resetStorage() {
  core.resetDbInstance();

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      }
      break;
    } catch (error: unknown) {
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code?: unknown }).code
          : null;
      if ((code === "EBUSY" || code === "EPERM") && attempt < 9) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      } else {
        throw error;
      }
    }
  }

  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(async () => {
  await resetStorage();
  await core.ensureDbInitialized();
});

test.after(async () => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  if (originalDataDir === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = originalDataDir;
  }
});

test("active synced available models ignore inactive connection caches", async () => {
  const now = new Date().toISOString();
  const db = core.getDbInstance();
  db.prepare(
    "INSERT INTO provider_connections (id, provider, auth_type, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("conn-active", "openai-compatible-test", "apikey", 1, now, now);
  db.prepare(
    "INSERT INTO provider_connections (id, provider, auth_type, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("conn-inactive", "openai-compatible-test", "apikey", 0, now, now);

  await modelsDb.replaceSyncedAvailableModelsForConnection(
    "openai-compatible-test",
    "conn-active",
    [{ id: "gpt-live", name: "GPT Live", source: "imported" }]
  );
  await modelsDb.replaceSyncedAvailableModelsForConnection(
    "openai-compatible-test",
    "conn-inactive",
    [{ id: "gpt-stale", name: "GPT Stale", source: "imported" }]
  );

  const models = await getActiveSyncedAvailableModels();
  const activeConnections = await providersDb.getProviderConnections({
    provider: "openai-compatible-test",
    isActive: true,
  });

  assert.deepEqual(
    models["openai-compatible-test"].map((model) => model.id),
    ["gpt-live"]
  );
  assert.deepEqual(
    activeConnections.map((connection) => connection.id),
    ["conn-active"]
  );
});
