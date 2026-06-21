/**
 * Parses the Google Generative Language `v1beta/models` listing into discovery models.
 *
 * Only chat-capable models are surfaced in the minimal source profile. The
 * regular `generateContent` path remains chat even when a model can emit rich
 * content inside a chat response.
 *
 * This is shared by the `gemini` discovery config and the `vertex` /
 * `vertex-partner` (incl. Vertex AI Express key) discovery branches, so every
 * chat model the account can access surfaces dynamically instead of being
 * limited to the small static registry.
 */
const CHAT_METHODS = new Set(["generateContent", "generateAnswer"]);

const IGNORED_METHODS = new Set([
  "countTokens",
  "countTextTokens",
  "createCachedContent",
  "batchGenerateContent",
  "asyncBatchEmbedContent",
]);

export interface GeminiDiscoveryModel {
  id: string;
  name: string;
  supportedEndpoints: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  description?: string;
  supportsThinking?: boolean;
  [key: string]: unknown;
}

export function parseGeminiModelsList(data: any): GeminiDiscoveryModel[] {
  return (data?.models || []).flatMap((m: Record<string, unknown>) => {
    const methods: string[] = Array.isArray(m.supportedGenerationMethods)
      ? (m.supportedGenerationMethods as string[])
      : [];

    const relevantMethods = methods.filter((method) => !IGNORED_METHODS.has(method));
    const supportsChat =
      relevantMethods.length === 0 || relevantMethods.some((method) => CHAT_METHODS.has(method));
    if (!supportsChat) return [];

    const endpoints = new Set<string>(["chat"]);

    const id = ((m.name as string) || (m.id as string) || "").replace(/^models\//, "");

    return {
      ...m,
      id,
      name: (m.displayName as string) || id,
      supportedEndpoints: [...endpoints],
      ...(typeof m.inputTokenLimit === "number" ? { inputTokenLimit: m.inputTokenLimit } : {}),
      ...(typeof m.outputTokenLimit === "number" ? { outputTokenLimit: m.outputTokenLimit } : {}),
      ...(typeof m.description === "string" ? { description: m.description } : {}),
      ...(m.thinking === true ? { supportsThinking: true } : {}),
    } as GeminiDiscoveryModel;
  });
}
