import test from "node:test";
import assert from "node:assert/strict";

import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  STATE,
} from "../../src/shared/utils/circuitBreaker.ts";

const cbSuffix = `-${Date.now()}`;

test("CircuitBreaker: starts in CLOSED state", () => {
  const cb = new CircuitBreaker(`test-closed${cbSuffix}`);
  assert.equal(cb.getStatus().state, STATE.CLOSED);
});

test("CircuitBreaker: stays CLOSED on success", async () => {
  const cb = new CircuitBreaker(`test-success${cbSuffix}`);
  const result = await cb.execute(async () => "ok");
  assert.equal(result, "ok");
  assert.equal(cb.getStatus().state, STATE.CLOSED);
});

test("CircuitBreaker: opens after failure threshold", async () => {
  const cb = new CircuitBreaker(`test-open${cbSuffix}`, { failureThreshold: 3 });

  for (let i = 0; i < 3; i++) {
    try {
      await cb.execute(async () => {
        throw new Error("fail");
      });
    } catch {}
  }

  assert.equal(cb.getStatus().state, STATE.OPEN);
  assert.equal(cb.getStatus().failureCount, 3);
});

test("CircuitBreaker: rejects requests when open", async () => {
  const cb = new CircuitBreaker(`test-reject${cbSuffix}`, {
    failureThreshold: 1,
    resetTimeout: 60000,
  });

  try {
    await cb.execute(async () => {
      throw new Error("fail");
    });
  } catch {}

  await assert.rejects(
    () => cb.execute(async () => "should not run"),
    (err) => err instanceof CircuitBreakerOpenError
  );
});

test("CircuitBreaker: transitions to HALF_OPEN after reset timeout", async () => {
  const cb = new CircuitBreaker(`test-halfopen${cbSuffix}`, {
    failureThreshold: 1,
    resetTimeout: 10,
  });

  try {
    await cb.execute(async () => {
      throw new Error("fail");
    });
  } catch {}

  assert.equal(cb.state, STATE.OPEN);

  await new Promise((r) => setTimeout(r, 15));

  const result = await cb.execute(async () => "recovered");
  assert.equal(result, "recovered");
  assert.equal(cb.state, STATE.CLOSED);
});

test("CircuitBreaker: status reads refresh OPEN providers after reset timeout", async () => {
  const cb = new CircuitBreaker(`test-status-refresh${cbSuffix}`, {
    failureThreshold: 1,
    resetTimeout: 250,
  });

  try {
    await cb.execute(async () => {
      throw new Error("fail");
    });
  } catch {}

  assert.equal(cb.getStatus().state, STATE.OPEN);

  await new Promise((r) => setTimeout(r, 300));

  assert.equal(cb.getStatus().state, STATE.HALF_OPEN);
  assert.equal(cb.canExecute(), true);
});

test("CircuitBreaker: reset() forces back to CLOSED", () => {
  const cb = new CircuitBreaker(`test-reset${cbSuffix}`, { failureThreshold: 1 });
  cb.state = STATE.OPEN;
  cb.failureCount = 5;
  cb.reset();
  assert.equal(cb.state, STATE.CLOSED);
  assert.equal(cb.failureCount, 0);
});

test("CircuitBreaker: calls onStateChange callback", async () => {
  const changes: Array<{ name: string; from: string; to: string }> = [];
  const cb = new CircuitBreaker(`test-callback${cbSuffix}`, {
    failureThreshold: 1,
    onStateChange: (name, from, to) => changes.push({ name, from, to }),
  });

  try {
    await cb.execute(async () => {
      throw new Error("fail");
    });
  } catch {}

  assert.ok(changes.length > 0);
  assert.equal(changes[0].from, STATE.CLOSED);
  assert.equal(changes[0].to, STATE.OPEN);
});
