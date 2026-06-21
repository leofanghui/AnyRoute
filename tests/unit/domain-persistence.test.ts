import { describe, it, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

function assertAlmostEqual(actual, expected, epsilon = 1e-9, message = "") {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    message || `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

// ─── Test Setup: Single temp dir for whole file (core caches DATA_DIR at first import) ────────

const fileTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-domain-test-"));
const originalDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = fileTmpDir;

async function removeStorageFiles(dir) {
  const storage = path.join(dir, "storage.sqlite");
  try {
    const core = await import("../../src/lib/db/core.ts");
    core.resetDbInstance();
  } catch {
    /* core may not be loaded yet */
  }
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const p = storage + suffix;
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
  }
}

beforeEach(async () => {
  await removeStorageFiles(fileTmpDir);
});

afterEach(async () => {
  const core = await import("../../src/lib/db/core.ts");
  core.resetDbInstance();
});

after(() => {
  process.env.DATA_DIR = originalDataDir;
  if (fs.existsSync(fileTmpDir)) fs.rmSync(fileTmpDir, { recursive: true, force: true });
});

// ─── Cost Rules Tests ────────────────────────

describe("costRules persistence", () => {
  it("should set and check budget", async () => {
    const { setBudget, getBudget, checkBudget, resetCostData } =
      await import("../../src/domain/costRules.ts");

    resetCostData();

    setBudget("key1", { dailyLimitUsd: 10 });
    const budget = getBudget("key1");
    assert.equal(budget.dailyLimitUsd, 10);
    assert.equal(budget.warningThreshold, 0.8);

    const check = checkBudget("key1");
    assert.ok(check.allowed);
    assert.equal(check.dailyLimit, 10);

    resetCostData();
  });

  it("should record cost and check daily total", async () => {
    const { setBudget, recordCost, getDailyTotal, checkBudget, resetCostData } =
      await import("../../src/domain/costRules.ts");

    resetCostData();

    setBudget("key2", { dailyLimitUsd: 5 });
    recordCost("key2", 3.5);
    recordCost("key2", 1.0);

    const total = getDailyTotal("key2");
    assertAlmostEqual(total, 4.5, 1e-9, `daily total ${total} should equal 4.5 (3.5 + 1.0)`);

    // Should still be allowed
    const check = checkBudget("key2", 0);
    assert.ok(check.allowed);

    // Should be denied with additional cost
    const checkOver = checkBudget("key2", 1.0);
    assert.ok(!checkOver.allowed);

    resetCostData();
  });

  it("should return allowed=true when no budget set", async () => {
    const { checkBudget, resetCostData } = await import("../../src/domain/costRules.ts");

    resetCostData();

    const check = checkBudget("no-budget-key");
    assert.ok(check.allowed);
    assert.equal(check.dailyLimit, 0);

    resetCostData();
  });

  it("should get cost summary", async () => {
    const { setBudget, recordCost, getCostSummary, resetCostData } =
      await import("../../src/domain/costRules.ts");

    resetCostData();

    setBudget("key3", { dailyLimitUsd: 100 });
    recordCost("key3", 1.5);
    recordCost("key3", 2.5);

    const summary = getCostSummary("key3");
    assertAlmostEqual(
      summary.dailyTotal,
      4.0,
      1e-9,
      `dailyTotal ${summary.dailyTotal} should equal 4.0 (1.5 + 2.5)`
    );
    assertAlmostEqual(
      summary.monthlyTotal,
      4.0,
      1e-9,
      `monthlyTotal ${summary.monthlyTotal} should equal 4.0`
    );
    assert.equal(summary.budget.dailyLimitUsd, 100);

    resetCostData();
  });
});

// ─── Circuit Breaker Tests ────────────────────────

describe("circuitBreaker persistence", () => {
  it("should open after threshold failures", async () => {
    const { CircuitBreaker, STATE } = await import("../../src/shared/utils/circuitBreaker.ts");

    const cb = new CircuitBreaker("test-cb-" + Date.now(), { failureThreshold: 3 });
    assert.equal(cb.state, STATE.CLOSED);

    // Simulate failures
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(() => Promise.reject(new Error("fail")));
      } catch {
        // expected
      }
    }

    assert.equal(cb.state, STATE.OPEN);
    assert.ok(!cb.canExecute());
  });

  it("should reset correctly", async () => {
    const { CircuitBreaker, STATE } = await import("../../src/shared/utils/circuitBreaker.ts");

    const cb = new CircuitBreaker("test-reset-" + Date.now(), { failureThreshold: 2 });

    try {
      await cb.execute(() => Promise.reject(new Error("fail")));
    } catch {}
    try {
      await cb.execute(() => Promise.reject(new Error("fail")));
    } catch {}

    assert.equal(cb.state, STATE.OPEN);

    cb.reset();
    assert.equal(cb.state, STATE.CLOSED);
    assert.equal(cb.failureCount, 0);
    assert.ok(cb.canExecute());
  });

  it("should close on success after half-open", async () => {
    const { CircuitBreaker, STATE } = await import("../../src/shared/utils/circuitBreaker.ts");

    const cb = new CircuitBreaker("test-halfopen-" + Date.now(), {
      failureThreshold: 2,
      resetTimeout: 10, // 10ms for test speed
    });

    // Open the circuit
    try {
      await cb.execute(() => Promise.reject(new Error("fail")));
    } catch {}
    try {
      await cb.execute(() => Promise.reject(new Error("fail")));
    } catch {}
    assert.equal(cb.state, STATE.OPEN);

    // Wait for resetTimeout
    await new Promise((r) => setTimeout(r, 20));

    // Should transition to HALF_OPEN and succeed
    const result = await cb.execute(() => Promise.resolve("ok"));
    assert.equal(result, "ok");
    assert.equal(cb.state, STATE.CLOSED);
  });

  it("registry should return statuses", async () => {
    const { getCircuitBreaker, getAllCircuitBreakerStatuses } =
      await import("../../src/shared/utils/circuitBreaker.ts");

    const name = "reg-test-" + Date.now();
    const cb = getCircuitBreaker(name, { failureThreshold: 5 });
    assert.ok(cb);

    const statuses = getAllCircuitBreakerStatuses();
    const found = statuses.find((s) => s.name === name);
    assert.ok(found);
    assert.equal(found.state, "CLOSED");
  });
});
