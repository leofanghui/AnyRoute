import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-ep-policy-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = process.env.API_KEY_SECRET || "task-ep-policy-secret";

const coreDb = await import("../../src/lib/db/core.ts");
const apiKeysDb = await import("../../src/lib/db/apiKeys.ts");
const costRules = await import("../../src/domain/costRules.ts");
const rateLimiter = await import("../../src/shared/utils/rateLimiter.ts");

rateLimiter.setRateLimiterTestMode(true);

async function resetStorage() {
  apiKeysDb.resetApiKeyState();
  costRules.resetCostData();
  coreDb.resetDbInstance();

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      }
      break;
    } catch (error: any) {
      if ((error?.code === "EBUSY" || error?.code === "EPERM") && attempt < 9) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      } else {
        throw error;
      }
    }
  }

  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

async function loadPolicy(label: string) {
  const modulePath = path.join(process.cwd(), "src/shared/utils/apiKeyPolicy.ts");
  return import(`${pathToFileURL(modulePath).href}?case=${label}-${Date.now()}`);
}

async function createKeyWithEndpoints(allowedEndpoints: string[]) {
  const created = await apiKeysDb.createApiKey("EP Test Key", "machine-ep");
  if (allowedEndpoints.length > 0) {
    await apiKeysDb.updateApiKeyPermissions(created.id, { allowedEndpoints });
  }
  return created;
}

function makeRequest(url: string, apiKey?: string) {
  return new Request(url, {
    method: "POST",
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
}

async function readErrorMessage(response: Response) {
  const body = (await response.json()) as any;
  return body.error.message as string;
}

test.beforeEach(async () => {
  delete process.env.DEFAULT_RATE_LIMIT_PER_DAY;
  await resetStorage();
});

test.after(async () => {
  apiKeysDb.resetApiKeyState();
  costRules.resetCostData();
  coreDb.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("no restriction allows retained chat endpoint", async () => {
  const policy = await loadPolicy("no-endpoint-restriction");
  const key = await createKeyWithEndpoints([]);

  const request = makeRequest("http://localhost/v1/chat/completions", key.key);
  const result = await policy.enforceApiKeyPolicy(request, "gpt-4");

  assert.equal(result.rejection, null);
});

test("models-only key allows /v1/models", async () => {
  const policy = await loadPolicy("models-only-allowed");
  const key = await createKeyWithEndpoints(["models"]);

  const request = makeRequest("http://localhost/v1/models", key.key);
  const result = await policy.enforceApiKeyPolicy(request, "models");

  assert.equal(result.rejection, null);
});

test("models-only key blocks /v1/chat/completions", async () => {
  const policy = await loadPolicy("models-blocks-chat");
  const key = await createKeyWithEndpoints(["models"]);

  const request = makeRequest("http://localhost/v1/chat/completions", key.key);
  const result = await policy.enforceApiKeyPolicy(request, "gpt-4");

  assert.ok(result.rejection, "Should reject the request");
  assert.equal(result.rejection.status, 403);
  const msg = await readErrorMessage(result.rejection);
  assert.ok(msg.includes("chat"), `Error message should mention 'chat', got: ${msg}`);
});

test("no API key skips endpoint restriction check", async () => {
  const policy = await loadPolicy("no-key-endpoint");

  const request = makeRequest("http://localhost/v1/chat/completions");
  const result = await policy.enforceApiKeyPolicy(request, "gpt-4");

  assert.equal(result.rejection, null);
});

test("updateApiKeyPermissions persists retained allowedEndpoints", async () => {
  const key = await apiKeysDb.createApiKey("EP Persist Key", "machine-persist");
  await apiKeysDb.updateApiKeyPermissions(key.id, {
    allowedEndpoints: ["chat", "models"],
  });

  const meta = await apiKeysDb.getApiKeyMetadata(key.key);
  assert.ok(meta, "Metadata should exist");
  assert.deepEqual(meta.allowedEndpoints, ["chat", "models"]);
});

test("updateApiKeyPermissions keeps empty allowedEndpoints", async () => {
  const key = await apiKeysDb.createApiKey("EP All Key", "machine-all");
  await apiKeysDb.updateApiKeyPermissions(key.id, {
    allowedEndpoints: [],
  });

  const meta = await apiKeysDb.getApiKeyMetadata(key.key);
  assert.ok(meta, "Metadata should exist");
  assert.deepEqual(meta.allowedEndpoints, []);
});

test("getApiKeys returns allowedEndpoints in listing", async () => {
  const key = await apiKeysDb.createApiKey("EP List Key", "machine-list");
  await apiKeysDb.updateApiKeyPermissions(key.id, {
    allowedEndpoints: ["chat"],
  });

  const keys = await apiKeysDb.getApiKeys();
  const found = keys.find((k: any) => k.id === key.id);
  assert.ok(found, "Key should be in listing");
  assert.deepEqual(found.allowedEndpoints, ["chat"]);
});
