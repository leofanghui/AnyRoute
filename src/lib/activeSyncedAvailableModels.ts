import { getSyncedAvailableModelsByConnection, type SyncedAvailableModel } from "@/lib/db/models";
import { getProviderConnections } from "@/lib/db/providers";

export async function getActiveSyncedAvailableModels(): Promise<
  Record<string, SyncedAvailableModel[]>
> {
  const connections = await getProviderConnections();
  const activeByProvider = new Map<string, Set<string>>();

  for (const connection of connections as Array<{
    id?: unknown;
    provider?: unknown;
    isActive?: unknown;
  }>) {
    if (connection.isActive === false) continue;
    if (typeof connection.provider !== "string" || typeof connection.id !== "string") continue;
    const ids = activeByProvider.get(connection.provider) || new Set<string>();
    ids.add(connection.id);
    activeByProvider.set(connection.provider, ids);
  }

  const result: Record<string, SyncedAvailableModel[]> = {};
  for (const [providerId, activeIds] of activeByProvider) {
    const byConnection = await getSyncedAvailableModelsByConnection(providerId);
    const merged = new Map<string, SyncedAvailableModel>();

    for (const [connectionId, models] of Object.entries(byConnection)) {
      if (!activeIds.has(connectionId)) continue;
      for (const model of models) {
        if (model.id) merged.set(model.id, model);
      }
    }

    if (merged.size > 0) result[providerId] = Array.from(merged.values());
  }

  return result;
}
