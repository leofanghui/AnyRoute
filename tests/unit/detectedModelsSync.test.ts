import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-detected-models-sync-"));
process.env.DATA_DIR = tmpDir;

const { persistDetectedModelsForConnection } = await import("../../src/lib/detectedModelsSync.ts");
const { getSyncedAvailableModels } = await import("../../src/lib/localDb.ts");
const { ensureDbInitialized, resetDbInstance } = await import("../../src/lib/db/core.ts");

before(async () => {
  await ensureDbInitialized();
});

after(() => {
  resetDbInstance();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("detected onboarding models are persisted for provider detail model list", async () => {
  const persisted = await persistDetectedModelsForConnection({
    id: "conn-detected-1",
    provider: "openai-compatible-detected",
    providerSpecificData: {
      autoDetection: {
        discoveredModels: [
          { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
          { id: "gpt-5.1-codex" },
        ],
        capabilities: {
          openaiChat: true,
          openaiResponses: true,
        },
      },
    },
  });

  assert.equal(persisted, 2);

  const synced = await getSyncedAvailableModels("openai-compatible-detected");
  assert.deepEqual(synced.map((model) => model.id).sort(), ["claude-sonnet-4", "gpt-5.1-codex"]);
  assert.deepEqual(synced[0].supportedEndpoints, ["chat", "responses"]);
});
