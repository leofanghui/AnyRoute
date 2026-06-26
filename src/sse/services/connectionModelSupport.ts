import { getModelMatchCandidates } from "@/domain/connectionModelRules";
import { getAllModelPoolVerifications } from "@/lib/db/cliToolState";
import { getSyncedAvailableModelsForConnection } from "@/lib/db/models";

type ConnectionLike = {
  id?: string;
  provider?: string;
  providerSpecificData?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getDetectedModelIds(providerSpecificData: unknown): string[] {
  const data = asRecord(providerSpecificData);
  const autoDetection = asRecord(data.autoDetection);
  const discoveredModels = autoDetection.discoveredModels;
  if (!Array.isArray(discoveredModels)) return [];

  return discoveredModels
    .map((model) => {
      if (typeof model === "string") return model.trim();
      const record = asRecord(model);
      return String(record.id || record.name || "").trim();
    })
    .filter(Boolean);
}

function modelIdMatches(requestedModel: string, availableModel: string): boolean {
  const requested = getModelMatchCandidates(requestedModel).map((candidate) =>
    candidate.toLowerCase()
  );
  const available = getModelMatchCandidates(availableModel).map((candidate) =>
    candidate.toLowerCase()
  );
  return requested.some((candidate) => available.includes(candidate));
}

function filterConnectionsByVerifiedModel<T extends ConnectionLike>(
  connections: T[],
  modelId: string
): T[] {
  const connectionIds = new Set(
    connections
      .map((connection) => (typeof connection.id === "string" ? connection.id : ""))
      .filter(Boolean)
  );
  if (connectionIds.size === 0) return connections;

  const okConnectionIds = new Set<string>();
  try {
    for (const verification of getAllModelPoolVerifications()) {
      if (verification.status !== "ok") continue;
      if (!verification.connectionId || !connectionIds.has(verification.connectionId)) continue;
      if (!modelIdMatches(modelId, verification.model)) continue;
      okConnectionIds.add(verification.connectionId);
    }
  } catch {
    return connections;
  }

  if (okConnectionIds.size === 0) return connections;
  return connections.filter(
    (connection) => typeof connection.id === "string" && okConnectionIds.has(connection.id)
  );
}

export async function filterConnectionsByKnownModelSupport<T extends ConnectionLike>(
  providerId: string,
  connections: T[],
  modelId: unknown
): Promise<T[]> {
  if (!Array.isArray(connections) || connections.length <= 1) return connections;
  if (typeof modelId !== "string" || modelId.trim().length === 0) return connections;

  const verifiedConnections = filterConnectionsByVerifiedModel(connections, modelId);
  if (verifiedConnections.length !== connections.length) return verifiedConnections;

  const checks = await Promise.all(
    connections.map(async (connection) => {
      const connectionId = typeof connection.id === "string" ? connection.id : "";
      if (!connectionId) return null;

      const provider = typeof connection.provider === "string" ? connection.provider : providerId;
      const syncedModels = await getSyncedAvailableModelsForConnection(
        provider,
        connectionId
      ).catch(() => []);
      const knownModelIds = [
        ...syncedModels.map((model) => model.id).filter(Boolean),
        ...getDetectedModelIds(connection.providerSpecificData),
      ];

      return knownModelIds.some((availableModel) => modelIdMatches(modelId, availableModel))
        ? connection
        : null;
    })
  );
  const supportedConnections = checks.filter((connection): connection is T => Boolean(connection));

  return supportedConnections.length > 0 ? supportedConnections : connections;
}
