import test from "node:test";
import assert from "node:assert/strict";

import { parseGeminiModelsList } from "../../src/lib/providerModels/geminiModelsParser";

// A representative slice of the live generativelanguage v1beta/models response — including the
// image models (gemini-*-image via generateContent, imagen-* via predict) that the Vertex catalog
// must surface dynamically.
const SAMPLE = {
  models: [
    {
      name: "models/gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      inputTokenLimit: 1048576,
      outputTokenLimit: 65536,
      supportedGenerationMethods: ["generateContent", "countTokens", "batchGenerateContent"],
      thinking: true,
    },
    {
      name: "models/gemini-3-pro-image-preview",
      displayName: "Gemini 3 Pro Image Preview",
      supportedGenerationMethods: ["generateContent", "countTokens"],
    },
    {
      name: "models/imagen-4.0-generate-001",
      displayName: "Imagen 4.0",
      supportedGenerationMethods: ["predict"],
    },
    {
      name: "models/text-embedding-004",
      displayName: "Text Embedding 004",
      supportedGenerationMethods: ["embedContent"],
    },
    {
      name: "models/gemini-live-2.5-flash",
      displayName: "Gemini Live",
      supportedGenerationMethods: ["bidiGenerateContent"],
    },
    {
      name: "models/veo-3.0-generate-001",
      displayName: "Veo 3.0",
      supportedGenerationMethods: ["predictLongRunning"],
    },
    {
      // Defensive: an Imagen model exposed via a long-running method must stay
      // "images", never "video".
      name: "models/imagen-future-preview",
      displayName: "Imagen Future",
      supportedGenerationMethods: ["predictLongRunning"],
    },
  ],
};

test("parseGeminiModelsList strips the models/ prefix and maps display name", () => {
  const models = parseGeminiModelsList(SAMPLE);
  const flash = models.find((m) => m.id === "gemini-2.5-flash");
  assert.ok(flash, "gemini-2.5-flash should be present");
  assert.equal(flash!.name, "Gemini 2.5 Flash");
  assert.equal(flash!.inputTokenLimit, 1048576);
  assert.equal(flash!.outputTokenLimit, 65536);
  assert.equal(flash!.supportsThinking, true);
  assert.deepEqual(flash!.supportedEndpoints, ["chat"]);
});

test("parseGeminiModelsList maps generateContent image models to the chat endpoint", () => {
  const models = parseGeminiModelsList(SAMPLE);
  const proImage = models.find((m) => m.id === "gemini-3-pro-image-preview");
  assert.ok(proImage, "gemini-3-pro-image-preview should be present");
  // gemini-*-image models generate images via generateContent (chat-with-modalities path).
  assert.deepEqual(proImage!.supportedEndpoints, ["chat"]);
});

test("parseGeminiModelsList filters Imagen predict models from the minimal catalog", () => {
  const models = parseGeminiModelsList(SAMPLE);
  const imagen = models.find((m) => m.id === "imagen-4.0-generate-001");
  assert.equal(imagen, undefined);
});

test("parseGeminiModelsList filters embedContent and bidiGenerateContent models", () => {
  const models = parseGeminiModelsList(SAMPLE);
  assert.equal(
    models.find((m) => m.id === "text-embedding-004"),
    undefined
  );
  assert.equal(
    models.find((m) => m.id === "gemini-live-2.5-flash"),
    undefined
  );
});

test("parseGeminiModelsList filters Veo predictLongRunning models", () => {
  const models = parseGeminiModelsList(SAMPLE);
  const veo = models.find((m) => m.id === "veo-3.0-generate-001");
  assert.equal(veo, undefined);
});

test("parseGeminiModelsList filters Imagen long-running models", () => {
  const models = parseGeminiModelsList(SAMPLE);
  const imagen = models.find((m) => m.id === "imagen-future-preview");
  assert.equal(imagen, undefined);
});

test("parseGeminiModelsList defaults to chat and tolerates empty/missing input", () => {
  assert.deepEqual(parseGeminiModelsList({}), []);
  assert.deepEqual(parseGeminiModelsList(null), []);
  const [m] = parseGeminiModelsList({ models: [{ name: "models/mystery" }] });
  assert.equal(m.id, "mystery");
  assert.deepEqual(m.supportedEndpoints, ["chat"]);
});
