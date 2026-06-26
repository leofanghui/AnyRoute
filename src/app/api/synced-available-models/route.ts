import { getSyncedAvailableModelsByConnection } from "@/lib/db/models";
import { getActiveSyncedAvailableModels } from "@/lib/activeSyncedAvailableModels";
import { getProviderConnections } from "@/lib/db/providers";
import { persistDetectedModelsForConnection } from "@/lib/detectedModelsSync";
import { isAuthenticated } from "@/shared/utils/apiAuth";

async function getProviderModelsWithConnectionIds(provider: string) {
  const [byConnection, connections] = await Promise.all([
    getSyncedAvailableModelsByConnection(provider),
    getProviderConnections({ provider, isActive: true }),
  ]);
  const activeConnectionIds = new Set(
    connections
      .map((connection) => (typeof connection.id === "string" ? connection.id : ""))
      .filter(Boolean)
  );
  const merged = new Map<string, any>();

  for (const [connectionId, models] of Object.entries(byConnection)) {
    if (!activeConnectionIds.has(connectionId)) continue;
    for (const model of models) {
      const existing = merged.get(model.id);
      const connectionIds = existing?.connectionIds || [];
      if (existing) {
        if (!connectionIds.includes(connectionId)) {
          existing.connectionIds = [...connectionIds, connectionId];
        }
        continue;
      }
      merged.set(model.id, {
        ...model,
        connectionId,
        connectionIds: [connectionId],
      });
    }
  }

  return Array.from(merged.values());
}

/**
 * GET /api/synced-available-models?provider=<id>
 * List synced available models for a provider (or all providers).
 */
export async function GET(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return Response.json(
        { error: { message: "Authentication required", type: "invalid_api_key" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (provider) {
      let models = await getProviderModelsWithConnectionIds(provider);
      if (models.length === 0) {
        const connections = await getProviderConnections({ provider, isActive: true });
        for (const connection of connections) {
          await persistDetectedModelsForConnection(connection).catch(() => 0);
        }
        models = await getProviderModelsWithConnectionIds(provider);
      }
      return Response.json({ models });
    }

    const allModels = await getActiveSyncedAvailableModels();
    return Response.json(allModels);
  } catch {
    return Response.json(
      { error: { message: "Failed to fetch synced available models", type: "server_error" } },
      { status: 500 }
    );
  }
}
