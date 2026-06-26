import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const originalDataDir = process.env.DATA_DIR;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-cli-tool-state-"));
process.env.DATA_DIR = tmpDir;

const { ensureDbInitialized, resetDbInstance } = await import("../../src/lib/db/core.ts");
const {
  deleteModelPoolVerificationsForConnection,
  getAllModelPoolVerifications,
  saveModelPoolVerification,
} = await import("../../src/lib/db/cliToolState.ts");

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

test("deleteModelPoolVerificationsForConnection removes only the target connection", () => {
  saveModelPoolVerification({
    tool: "model-pool",
    model: "gateway/claude-sonnet-4",
    provider: "openai-compatible-gateway",
    connectionId: "conn-stale",
    status: "ok",
    checkedAt: "2026-01-01T00:00:00.000Z",
  });
  saveModelPoolVerification({
    tool: "model-pool",
    model: "gateway/gpt-5.1-codex",
    provider: "openai-compatible-gateway",
    connectionId: "conn-fresh",
    status: "ok",
    checkedAt: "2026-01-01T00:00:00.000Z",
  });

  const deleted = deleteModelPoolVerificationsForConnection("conn-stale");
  const remaining = getAllModelPoolVerifications();

  assert.equal(deleted, 1);
  assert.deepEqual(
    remaining.map((item) => item.connectionId),
    ["conn-fresh"]
  );
});
