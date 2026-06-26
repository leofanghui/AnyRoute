import { replaceSyncedAvailableModelsForConnection } from "@/lib/db/models";

function getDetectedModelsForSync(providerSpecificData: unknown) {
  const record =
    providerSpecificData && typeof providerSpecificData === "object"
      ? (providerSpecificData as Record<string, any>)
      : {};
  const autoDetection =
    record.autoDetection && typeof record.autoDetection === "object"
      ? (record.autoDetection as Record<string, any>)
      : null;
  const models = Array.isArray(autoDetection?.discoveredModels)
    ? autoDetection.discoveredModels
    : [];
  const capabilities =
    autoDetection?.capabilities && typeof autoDetection.capabilities === "object"
      ? (autoDetection.capabilities as Record<string, unknown>)
      : {};

  return models
    .map((model: any) => {
      const id = String(model?.id || model?.name || model || "").trim();
      if (!id) return null;
      const name = String(model?.name || id).trim();
      const supportedEndpoints = [
        capabilities.openaiChat ? "chat" : "",
        capabilities.openaiResponses ? "responses" : "",
        capabilities.claudeMessages ? "claude-messages" : "",
      ].filter(Boolean);
      return {
        id,
        name,
        apiFormat: capabilities.openaiResponses ? "responses" : "chat-completions",
        ...(supportedEndpoints.length > 0 ? { supportedEndpoints } : {}),
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string;
    apiFormat?: string;
    supportedEndpoints?: string[];
  }>;
}

export async function persistDetectedModelsForConnection(connection: any) {
  const detectedModels = getDetectedModelsForSync(connection?.providerSpecificData);
  if (detectedModels.length === 0 || !connection?.provider || !connection?.id) return 0;

  await replaceSyncedAvailableModelsForConnection(
    String(connection.provider),
    String(connection.id),
    detectedModels
  );
  return detectedModels.length;
}
