import test from "node:test";
import assert from "node:assert/strict";

// ═════════════════════════════════════════════════════
//  Remaining Tasks Tests: Telemetry
// ═════════════════════════════════════════════════════

// ─── Request Telemetry (T-45) ────────────────────

import {
  RequestTelemetry,
  recordTelemetry,
  getTelemetrySummary,
} from "../../src/shared/utils/requestTelemetry.ts";

test("RequestTelemetry: records phases", async () => {
  const t = new RequestTelemetry("tel-1");
  t.startPhase("parse");
  t.endPhase();
  t.startPhase("validate");
  t.endPhase();

  const summary = t.getSummary();
  assert.equal(summary.phases.length, 2);
  assert.equal(summary.phases[0].phase, "parse");
  assert.equal(summary.phases[1].phase, "validate");
});

test("RequestTelemetry: measure() wraps async functions", async () => {
  const t = new RequestTelemetry("tel-2");
  const result = await t.measure("parse", async () => "parsed");
  assert.equal(result, "parsed");
  assert.equal(t.getSummary().phases.length, 1);
  assert.equal(t.getSummary().phases[0].phase, "parse");
});

test("RequestTelemetry: measure() records errors", async () => {
  const t = new RequestTelemetry("tel-3");
  await assert.rejects(
    () =>
      t.measure("connect", async () => {
        throw new Error("timeout");
      }),
    (err) => (err as any).message === "timeout"
  );
  assert.equal(t.getSummary().phases[0].error, "timeout");
});

test("RequestTelemetry: getTelemetrySummary returns valid output", () => {
  const t = new RequestTelemetry("tel-4");
  t.startPhase("parse");
  t.endPhase();
  recordTelemetry(t);

  const summary = getTelemetrySummary();
  assert.ok(summary.count > 0);
  assert.ok(typeof summary.p50 === "number");
  assert.ok(typeof summary.p95 === "number");
});
