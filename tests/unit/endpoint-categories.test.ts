import test from "node:test";
import assert from "node:assert/strict";

const { resolveEndpointCategory } =
  await import("../../src/shared/constants/endpointCategories.ts");

test("resolveEndpointCategory maps retained OpenAI-compatible endpoints", () => {
  assert.equal(resolveEndpointCategory("/v1/chat/completions"), "chat");
  assert.equal(resolveEndpointCategory("/v1/responses"), "chat");
  assert.equal(resolveEndpointCategory("/v1/responses/some/path"), "chat");
  assert.equal(resolveEndpointCategory("/v1/models"), "models");
});

test("resolveEndpointCategory ignores pruned endpoint families", () => {
  for (const path of [
    "/v1/unknown-search",
    "/v1/unknown-vector",
    "/v1/unknown-media/generations",
    "/v1/unknown-batches",
    "/v1/unknown-files",
    "/v1/unknown-agents/tasks",
    "/v1/completions",
    "/v1/messages",
    "/v1/messages/count_tokens",
  ]) {
    assert.equal(resolveEndpointCategory(path), null);
  }
});

test("resolveEndpointCategory returns null for unknown or management paths", () => {
  assert.equal(resolveEndpointCategory("/v1/unknown"), null);
  assert.equal(resolveEndpointCategory("/api/keys"), null);
  assert.equal(resolveEndpointCategory("/"), null);
});
