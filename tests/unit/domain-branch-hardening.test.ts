import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-domain-hardening-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const costRules = await import("../../src/domain/costRules.ts");
const providerExpiration = await import("../../src/domain/providerExpiration.ts");
const quotaCache = await import("../../src/domain/quotaCache.ts");

const originalDateNow = Date.now;
const originalMathRandom = Math.random;

function isoFromNow(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function resetStorage() {
  costRules.resetCostData();
  providerExpiration.resetExpirations();
  quotaCache.stopBackgroundRefresh();
  core.resetDbInstance();

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

test.beforeEach(async () => {
  Date.now = originalDateNow;
  Math.random = originalMathRandom;
  await resetStorage();
});

test.after(async () => {
  Date.now = originalDateNow;
  Math.random = originalMathRandom;
  quotaCache.stopBackgroundRefresh();
  costRules.resetCostData();
  providerExpiration.resetExpirations();
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("providerExpiration derives status, sorting, summary and header-based expiration hints", () => {
  const expired = providerExpiration.setExpiration(
    "conn-expired",
    "claude",
    "Claude",
    isoFromNow(-60_000),
    "oauth_token"
  );
  const soon = providerExpiration.setExpiration(
    "conn-soon",
    "openai",
    "OpenAI",
    isoFromNow(2 * 24 * 60 * 60 * 1000),
    "subscription",
    { alertDays: 7 }
  );
  const active = providerExpiration.setExpiration(
    "conn-active",
    "gemini",
    "Gemini",
    isoFromNow(20 * 24 * 60 * 60 * 1000),
    "api_credits",
    { alertDays: 3, note: "healthy" }
  );
  providerExpiration.setExpiration("conn-unknown", "cursor", "Cursor", null, "subscription");
  providerExpiration.setExpiration("conn-invalid", "kimi", "Kimi", "not-a-date", "free_tier_reset");

  assert.equal(expired.status, "expired");
  assert.equal(soon.status, "expiring_soon");
  assert.equal(active.status, "active");
  assert.equal(providerExpiration.getExpiration("missing-connection"), null);
  assert.equal(providerExpiration.getExpiration("conn-active")?.note, "healthy");

  assert.deepEqual(
    providerExpiration.getAllExpirations().map((entry) => entry.connectionId),
    ["conn-expired", "conn-soon", "conn-active", "conn-unknown", "conn-invalid"]
  );
  assert.deepEqual(
    providerExpiration.getExpiringSoon().map((entry) => entry.connectionId),
    ["conn-expired", "conn-soon"]
  );

  const summary = providerExpiration.getExpirationSummary();
  assert.equal(summary.total, 5);
  assert.equal(summary.active, 1);
  assert.equal(summary.expiringSoon, 1);
  assert.equal(summary.expired, 1);
  assert.equal(summary.unknown, 2);
  assert.equal(summary.nextExpiration?.connectionId, "conn-soon");

  const detected401 = providerExpiration.detectExpirationFromResponse("claude", 401, {});
  assert.equal(detected401.expiryType, "oauth_token");

  const detected402 = providerExpiration.detectExpirationFromResponse("openai", 402, {});
  assert.equal(detected402.expiryType, "subscription");

  const retryAfterSeconds = providerExpiration.detectExpirationFromResponse("gemini", 429, {
    "retry-after": "120",
  });
  assert.equal(retryAfterSeconds.expiryType, "free_tier_reset");
  assert.ok(new Date(retryAfterSeconds.expiresAt).getTime() > Date.now());

  const epochSeconds = Math.floor((Date.now() + 60_000) / 1000);
  const ratelimitReset = providerExpiration.detectExpirationFromResponse("openai", 429, {
    "x-ratelimit-reset": String(epochSeconds),
  });
  assert.equal(ratelimitReset.expiryType, "free_tier_reset");

  assert.equal(
    providerExpiration.detectExpirationFromResponse("openai", 429, { "retry-after": "nope" }),
    null
  );
  assert.equal(providerExpiration.detectExpirationFromResponse("openai", 500, {}), null);

  assert.equal(providerExpiration.removeExpiration("conn-active"), true);
  assert.equal(providerExpiration.removeExpiration("conn-active"), false);
  providerExpiration.resetExpirations();
  assert.deepEqual(providerExpiration.getAllExpirations(), []);
});

test("quotaCache covers normalized windows, stale exhaustion, stats and refresh timer lifecycle", () => {
  let now = 10_000;
  Date.now = () => now;

  const activeConnectionId = "quota-active-connection";
  quotaCache.setQuotaCache(activeConnectionId, "cursor", {
    daily: { remainingPercentage: 125, resetAt: isoFromNow(60_000) },
    "weekly (7d)": { total: 100, used: 90, resetAt: isoFromNow(120_000) },
    ignored: null,
  });

  assert.equal(quotaCache.getQuotaCache("missing"), null);
  assert.equal(quotaCache.isAccountQuotaExhausted("missing"), false);
  assert.equal(quotaCache.getQuotaWindowStatus("missing", "daily"), null);

  const weekly = quotaCache.getQuotaWindowStatus(activeConnectionId, "weekly", 80);
  assert.deepEqual(weekly, {
    remainingPercentage: 10,
    usedPercentage: 90,
    resetAt: isoFromNow(120_000),
    reachedThreshold: true,
  });

  const daily = quotaCache.getQuotaWindowStatus(activeConnectionId, "daily", 99);
  assert.deepEqual(daily, {
    remainingPercentage: 100,
    usedPercentage: 0,
    resetAt: isoFromNow(60_000),
    reachedThreshold: false,
  });

  const expiredWindowId = "quota-expired-window";
  quotaCache.setQuotaCache(expiredWindowId, "cursor", {
    session: { remainingPercentage: 5, resetAt: isoFromNow(-1_000) },
  });
  assert.deepEqual(quotaCache.getQuotaWindowStatus(expiredWindowId, "session", 90), {
    remainingPercentage: 5,
    usedPercentage: 95,
    resetAt: null,
    reachedThreshold: false,
  });
  assert.equal(quotaCache.getQuotaWindowStatus(expiredWindowId, "", 90), null);

  const exhaustedWithResetId = "quota-exhausted-reset";
  quotaCache.setQuotaCache(exhaustedWithResetId, "cursor", {
    daily: { remainingPercentage: 0, resetAt: isoFromNow(60_000) },
  });
  assert.equal(quotaCache.isAccountQuotaExhausted(exhaustedWithResetId), true);

  now += 61_000;
  assert.equal(quotaCache.isAccountQuotaExhausted(exhaustedWithResetId), false);

  const exhausted429Id = "quota-exhausted-429";
  quotaCache.markAccountExhaustedFrom429(exhausted429Id, "cursor");
  assert.equal(quotaCache.isAccountQuotaExhausted(exhausted429Id), true);

  now += 5 * 60 * 1000 + 1;
  assert.equal(quotaCache.isAccountQuotaExhausted(exhausted429Id), false);

  const stats = quotaCache.getQuotaCacheStats();
  assert.ok(stats.total >= 3);
  assert.ok(stats.entries.some((entry) => entry.connectionId === "quota-ac..."));

  quotaCache.startBackgroundRefresh();
  quotaCache.startBackgroundRefresh();
  quotaCache.stopBackgroundRefresh();
  quotaCache.stopBackgroundRefresh();
});

test("quotaCache covers empty quotas, invalid dates and fallback percentage normalization", () => {
  let now = 100_000;
  Date.now = () => now;

  quotaCache.setQuotaCache("quota-empty", "cursor", {});
  assert.equal(quotaCache.getQuotaCache("quota-empty")?.exhausted, false);
  assert.equal(quotaCache.isAccountQuotaExhausted("quota-empty"), false);

  quotaCache.setQuotaCache("quota-zero-total", "cursor", {
    daily: { total: 0, used: 25 },
    "###": { remainingPercentage: 50 },
  });
  assert.deepEqual(quotaCache.getQuotaWindowStatus("quota-zero-total", "daily", 10), {
    remainingPercentage: 0,
    usedPercentage: 100,
    resetAt: null,
    reachedThreshold: true,
  });
  assert.equal(quotaCache.getQuotaWindowStatus("quota-zero-total", "unknown"), null);

  quotaCache.setQuotaCache("quota-invalid-reset", "cursor", {
    daily: { remainingPercentage: Number.POSITIVE_INFINITY, resetAt: "not-a-date" },
  });
  assert.deepEqual(quotaCache.getQuotaWindowStatus("quota-invalid-reset", "daily", 10), {
    remainingPercentage: 0,
    usedPercentage: 100,
    resetAt: "not-a-date",
    reachedThreshold: true,
  });

  quotaCache.setQuotaCache("quota-invalid-exhausted", "cursor", {
    daily: { remainingPercentage: 0, resetAt: "still-not-a-date" },
  });
  assert.equal(quotaCache.isAccountQuotaExhausted("quota-invalid-exhausted"), true);
});
