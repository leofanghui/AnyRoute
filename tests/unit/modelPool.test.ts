import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildModelPoolOptions, type ModelPoolSource } from "../../src/shared/utils/modelPool";

describe("modelPool", () => {
  it("keeps one visible pool entry while choosing the best source for each client", () => {
    const sources: ModelPoolSource[] = [
      {
        value: "chatgw/claude-sonnet-4-20250514",
        provider: "openai-compatible-chatgw",
        alias: "chatgw",
        connectionId: "conn-chat",
        connectionName: "Chat Gateway",
        modelId: "claude-sonnet-4-20250514",
        name: "claude-sonnet-4-20250514",
        source: "detected",
        capabilities: { openaiChat: true },
      },
      {
        value: "claudegw/claude-sonnet-4-20250514",
        provider: "anthropic-compatible-claudegw",
        alias: "claudegw",
        connectionId: "conn-claude",
        connectionName: "Claude Gateway",
        modelId: "claude-sonnet-4-20250514",
        name: "claude-sonnet-4-20250514",
        source: "detected",
        capabilities: { claudeMessages: true },
      },
      {
        value: "respgw/claude-sonnet-4-20250514",
        provider: "openai-compatible-respgw",
        alias: "respgw",
        connectionId: "conn-responses",
        connectionName: "Responses Gateway",
        modelId: "claude-sonnet-4-20250514",
        name: "claude-sonnet-4-20250514",
        source: "detected",
        capabilities: { openaiResponses: true },
      },
    ];

    const claude = buildModelPoolOptions(sources, "claude")[0];
    const codex = buildModelPoolOptions(sources, "codex")[0];

    assert.equal(claude.label, "Claude Sonnet 4 · 3 个来源");
    assert.equal(claude.value, "claudegw/claude-sonnet-4-20250514");
    assert.equal(claude.connectionId, "conn-claude");
    assert.equal(codex.value, "respgw/claude-sonnet-4-20250514");
    assert.equal(codex.connectionId, "conn-responses");
    assert.deepEqual(claude.capabilities, {
      openaiChat: true,
      openaiResponses: true,
      claudeMessages: true,
      streaming: false,
      tools: false,
    });
  });

  it("prefers a verified usable source over a newer failing source", () => {
    const sources: ModelPoolSource[] = [
      {
        value: "broken/gpt-5.1-codex",
        provider: "openai-compatible-broken",
        alias: "broken",
        connectionName: "Broken",
        modelId: "gpt-5.1-codex",
        name: "gpt-5.1-codex",
        source: "detected",
        capabilities: { openaiResponses: true },
        verification: { status: "error", checkedAt: "2026-01-01T00:00:00.000Z" },
      },
      {
        value: "working/gpt-5.1-codex",
        provider: "openai-compatible-working",
        alias: "working",
        connectionName: "Working",
        modelId: "gpt-5.1-codex",
        name: "gpt-5.1-codex",
        source: "detected",
        capabilities: { openaiChat: true },
        verification: { status: "ok", checkedAt: "2025-01-01T00:00:00.000Z" },
      },
    ];

    const model = buildModelPoolOptions(sources, "codex")[0];

    assert.equal(model.label, "GPT 5.1 Codex · 2 个来源");
    assert.equal(model.value, "working/gpt-5.1-codex");
    assert.equal(model.verificationStatus, "ok");
  });

  it("does not keep an old failing verification as a permanent unavailable state", () => {
    const sources: ModelPoolSource[] = [
      {
        value: "limited/qwen3-coder",
        provider: "openai-compatible-limited",
        alias: "limited",
        connectionName: "Limited",
        modelId: "qwen3-coder",
        name: "qwen3-coder",
        source: "detected",
        capabilities: { openaiChat: true },
        verification: {
          status: "error",
          checkedAt: "2020-01-01T00:00:00.000Z",
          diagnosis: { message: "上游渠道正在限流或额度不足" },
        },
      },
    ];

    const model = buildModelPoolOptions(sources, "codex")[0];

    assert.equal(model.value, "limited/qwen3-coder");
    assert.equal(model.verificationStatus, undefined);
    assert.equal(model.verificationMessage, undefined);
  });

  it("keeps OpenAI o-series models as distinct pool entries", () => {
    const sources: ModelPoolSource[] = ["o1", "o3-mini", "o4-mini"].map((modelId) => ({
      value: `gateway/${modelId}`,
      provider: "openai-compatible-gateway",
      alias: "gateway",
      connectionName: "Gateway",
      modelId,
      name: modelId,
      source: "detected",
      capabilities: { openaiResponses: true },
    }));

    const models = buildModelPoolOptions(sources, "codex");

    assert.deepEqual(
      models.map((model) => model.label),
      ["O1", "O3 Mini", "O4 Mini"]
    );
  });

  it("strict pool only includes verified usable sources", () => {
    const sources: ModelPoolSource[] = [
      {
        value: "working/claude-sonnet-4",
        provider: "openai-compatible-working",
        alias: "working",
        connectionName: "Working",
        modelId: "claude-sonnet-4",
        name: "claude-sonnet-4",
        source: "detected",
        capabilities: { openaiChat: true },
        verification: { status: "ok", checkedAt: "2026-01-01T00:00:00.000Z" },
      },
      {
        value: "partial/claude-sonnet-4",
        provider: "openai-compatible-partial",
        alias: "partial",
        connectionName: "Partial",
        modelId: "claude-sonnet-4",
        name: "claude-sonnet-4",
        source: "detected",
        capabilities: { openaiChat: true },
        verification: { status: "partial", checkedAt: "2026-01-01T00:00:00.000Z" },
      },
      {
        value: "broken/claude-sonnet-4",
        provider: "openai-compatible-broken",
        alias: "broken",
        connectionName: "Broken",
        modelId: "claude-sonnet-4",
        name: "claude-sonnet-4",
        source: "detected",
        capabilities: { openaiChat: true },
        verification: { status: "error", checkedAt: "2026-01-01T00:00:00.000Z" },
      },
      {
        value: "unknown/gpt-5.1-codex",
        provider: "openai-compatible-unknown",
        alias: "unknown",
        connectionName: "Unknown",
        modelId: "gpt-5.1-codex",
        name: "gpt-5.1-codex",
        source: "detected",
        capabilities: { openaiResponses: true },
      },
    ];

    const models = buildModelPoolOptions(sources, "all", { requireVerified: true });

    assert.equal(models.length, 1);
    assert.equal(models[0].value, "working/claude-sonnet-4");
    assert.equal(models[0].sourceCount, 1);
    assert.deepEqual(
      models[0].sources.map((source) => source.value),
      ["working/claude-sonnet-4"]
    );
  });
});
