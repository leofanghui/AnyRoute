import test from "node:test";
import assert from "node:assert/strict";

import { mergeCompatibleProviderNodeData } from "../../src/sse/services/auth.ts";

test("compatible provider node config is merged into runtime provider data", () => {
  const merged = mergeCompatibleProviderNodeData(
    {
      id: "conn-compatible-runtime",
      providerSpecificData: {
        autoDetection: {
          discoveredModels: [{ id: "gpt-runtime" }],
        },
      },
    },
    {
      baseUrl: "https://gateway.example.com/v1",
      apiType: "chat",
      chatPath: "/chat/completions",
      modelsPath: "/models",
    }
  );

  assert.deepEqual(merged.providerSpecificData, {
    baseUrl: "https://gateway.example.com/v1",
    apiType: "chat",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    autoDetection: {
      discoveredModels: [{ id: "gpt-runtime" }],
    },
  });
});

test("connection-specific compatible provider data overrides provider node defaults", () => {
  const merged = mergeCompatibleProviderNodeData(
    {
      id: "conn-compatible-runtime",
      providerSpecificData: {
        apiType: "responses",
      },
    },
    {
      baseUrl: "https://gateway.example.com/v1",
      apiType: "chat",
    }
  );

  assert.equal(merged.providerSpecificData.baseUrl, "https://gateway.example.com/v1");
  assert.equal(merged.providerSpecificData.apiType, "responses");
});
