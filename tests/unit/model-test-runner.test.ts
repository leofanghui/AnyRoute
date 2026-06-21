import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRetryAfterHeader, detectTestKind } from "@/lib/api/modelTestRunner.ts";

// ---------------------------------------------------------------------------
// parseRetryAfterHeader — Retry-After is either delta-seconds or an HTTP-date.
// Regression guard for the rate-limit handling in runSingleModelTest (#3267).
// ---------------------------------------------------------------------------

test("parseRetryAfterHeader returns undefined for missing/empty/null input", () => {
  assert.equal(parseRetryAfterHeader(null), undefined);
  assert.equal(parseRetryAfterHeader(undefined), undefined);
  assert.equal(parseRetryAfterHeader(""), undefined);
  assert.equal(parseRetryAfterHeader("   "), undefined);
});

test("parseRetryAfterHeader parses delta-seconds (numeric form)", () => {
  assert.equal(parseRetryAfterHeader("0"), 0);
  assert.equal(parseRetryAfterHeader("30"), 30);
  assert.equal(parseRetryAfterHeader("120"), 120);
  // fractional seconds round up (ceil) so we never under-wait
  assert.equal(parseRetryAfterHeader("1.2"), 2);
});

test("parseRetryAfterHeader rejects non-date garbage and never yields a misleading positive wait", () => {
  // Pure garbage with no parseable date → undefined.
  assert.equal(parseRetryAfterHeader("soon"), undefined);
  assert.equal(parseRetryAfterHeader("NaN"), undefined);
  // A negative numeric is not accepted on the numeric path (>= 0 guard); it
  // falls through to Date.parse, which yields a past date → clamped to 0.
  // The important guarantee is that it never produces a positive wait.
  const negative = parseRetryAfterHeader("-5");
  assert.ok(negative === undefined || negative === 0, `expected 0/undefined, got ${negative}`);
});

test("parseRetryAfterHeader parses an HTTP-date into a non-negative seconds delta", () => {
  // A date ~10s in the future should yield a small positive integer (>=0).
  const future = new Date(Date.now() + 10_000).toUTCString();
  const secs = parseRetryAfterHeader(future);
  assert.ok(typeof secs === "number");
  assert.ok(secs >= 0 && secs <= 11, `expected ~10s, got ${secs}`);

  // A date in the past clamps to 0 (never negative).
  const past = new Date(Date.now() - 60_000).toUTCString();
  assert.equal(parseRetryAfterHeader(past), 0);
});

// ---------------------------------------------------------------------------
// detectTestKind keeps every model on the retained chat test path.
// ---------------------------------------------------------------------------

test("detectTestKind defaults to a plain chat test for ordinary models", () => {
  assert.deepEqual(detectTestKind("openai/gpt-4o", null), {
    isRerank: false,
    isEmbedding: false,
  });
});

test("detectTestKind ignores pruned non-chat endpoint heuristics", () => {
  for (const id of [
    "openai/vector-small",
    "vendor/vector-model",
    "baai/vector-m3",
    "vendor/clip-model",
    "colbert-ir/colbertv2",
    "vendor/ranker-v2",
    "vendor/ranker-vector-hybrid",
  ]) {
    assert.deepEqual(detectTestKind(id, null), {
      isRerank: false,
      isEmbedding: false,
    });
  }
});

test("detectTestKind ignores pruned non-chat custom-model metadata", () => {
  assert.deepEqual(detectTestKind("vendor/opaque-model", { apiFormat: "legacy-rank" }), {
    isRerank: false,
    isEmbedding: false,
  });
  assert.deepEqual(
    detectTestKind("vendor/opaque-model", { supportedEndpoints: ["legacy-vector"] }),
    {
      isRerank: false,
      isEmbedding: false,
    }
  );
});
