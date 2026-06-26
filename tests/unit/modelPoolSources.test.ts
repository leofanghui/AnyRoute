import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVerificationLookup,
  resolveSourceVerification,
} from "../../src/lib/modelPoolSources.ts";
import type { ModelPoolVerification } from "../../src/lib/db/cliToolState.ts";

test("buildVerificationLookup uses base model-pool verification for client pools", () => {
  const model = "gateway/claude-sonnet-4";
  const verifications: ModelPoolVerification[] = [
    {
      tool: "model-pool",
      model,
      provider: "openai-compatible-gateway",
      connectionId: "conn-base",
      status: "ok",
      checkedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  const lookup = buildVerificationLookup(verifications, "claude");

  assert.equal(lookup.get(`${model}:conn-base`)?.tool, "model-pool");
  assert.equal(lookup.get(`${model}:conn-base`)?.status, "ok");
});

test("buildVerificationLookup prefers client-specific verification over base verification", () => {
  const model = "gateway/claude-opus-4";
  const verifications: ModelPoolVerification[] = [
    {
      tool: "model-pool",
      model,
      provider: "openai-compatible-gateway",
      connectionId: "conn-specific",
      status: "ok",
      checkedAt: "2026-01-01T00:01:00.000Z",
    },
    {
      tool: "claude",
      model,
      provider: "openai-compatible-gateway",
      connectionId: "conn-specific",
      status: "error",
      checkedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  const lookup = buildVerificationLookup(verifications, "claude");

  assert.equal(lookup.get(`${model}:conn-specific`)?.tool, "claude");
  assert.equal(lookup.get(`${model}:conn-specific`)?.status, "error");
});

test("buildVerificationLookup keeps other client-specific verification out of client pools", () => {
  const model = "gateway/gpt-5.1-codex";
  const verifications: ModelPoolVerification[] = [
    {
      tool: "codex",
      model,
      provider: "openai-compatible-gateway",
      connectionId: "conn-codex",
      status: "ok",
      checkedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  const lookup = buildVerificationLookup(verifications, "claude");

  assert.equal(lookup.has(`${model}:conn-codex`), false);
});

test("resolveSourceVerification does not apply model-only verification to connection sources", () => {
  const model = "gateway/claude-sonnet-4";
  const verifications: ModelPoolVerification[] = [
    {
      tool: "model-pool",
      model,
      provider: "openai-compatible-gateway",
      status: "ok",
      checkedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const lookup = buildVerificationLookup(verifications, "claude");

  assert.equal(resolveSourceVerification(lookup, model, "conn-current"), undefined);
  assert.equal(resolveSourceVerification(lookup, model)?.status, "ok");
});
