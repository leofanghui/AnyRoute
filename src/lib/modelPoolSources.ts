import {
  getAllCustomModels,
  getAllModelPoolVerifications,
  getProviderConnections,
  getProviderNodes,
  getSyncedAvailableModelsForConnection,
  type ModelPoolVerification,
} from "@/lib/localDb";
import { getModelsByProviderId, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import type { ModelPoolClient, ModelPoolSource } from "@/shared/utils/modelPool";

export function normalizeModelPoolClient(value: string | null | undefined): ModelPoolClient {
  if (value === "claude" || value === "codex") return value;
  return "all";
}

function getConnectionPrefix(conn: any, providerNode?: any) {
  const specificPrefix = conn?.providerSpecificData?.prefix;
  if (typeof specificPrefix === "string" && specificPrefix.trim()) {
    return specificPrefix.trim();
  }
  const nodePrefix = providerNode?.prefix;
  if (typeof nodePrefix === "string" && nodePrefix.trim()) {
    return nodePrefix.trim();
  }
  return PROVIDER_ID_TO_ALIAS[conn.provider] || conn.provider;
}

function normalizeCustomModelEntries(providerId: string, rawModels: unknown): ModelPoolSource[] {
  if (!Array.isArray(rawModels)) return [];
  return rawModels
    .map((model: any) => {
      const modelId = String(model?.id || model?.modelId || "").trim();
      if (!modelId) return null;
      return {
        value: `${providerId}/${modelId}`,
        label: model?.name || model?.modelName || modelId,
        provider: providerId,
        alias: providerId,
        modelId,
        name: model?.name || model?.modelName || modelId,
        source: model?.source || "custom",
      };
    })
    .filter(Boolean) as ModelPoolSource[];
}

function getDetectedCapabilities(conn: any) {
  const autoDetection = conn?.providerSpecificData?.autoDetection;
  if (!autoDetection || typeof autoDetection !== "object") return undefined;
  const capabilities = autoDetection.capabilities;
  return capabilities && typeof capabilities === "object" ? capabilities : undefined;
}

function getDetectedModels(conn: any) {
  const autoDetection = conn?.providerSpecificData?.autoDetection;
  if (!autoDetection || typeof autoDetection !== "object") return [];
  const models = autoDetection.discoveredModels;
  if (!Array.isArray(models)) return [];
  return models
    .map((model: any) => {
      const id = String(model?.id || model?.name || model || "").trim();
      if (!id) return null;
      return {
        id,
        name: String(model?.name || id).trim(),
      };
    })
    .filter(Boolean) as Array<{ id: string; name: string }>;
}

function getClientTools(client: ModelPoolClient) {
  if (client === "claude") return new Set(["claude", "claude-desktop"]);
  if (client === "codex") return new Set(["codex", "codex-desktop"]);
  return null;
}

function getVerificationClientRank(
  verification: ModelPoolVerification,
  clientTools: Set<string> | null
) {
  if (!clientTools) return 0;
  if (clientTools.has(verification.tool)) return 0;
  if (verification.tool === "model-pool") return 1;
  return null;
}

export function buildVerificationLookup(
  verifications: ModelPoolVerification[],
  client: ModelPoolClient
) {
  const clientTools = getClientTools(client);
  const lookup = new Map<string, ModelPoolVerification>();
  const ranks = new Map<string, number>();

  for (const verification of verifications) {
    const rank = getVerificationClientRank(verification, clientTools);
    if (rank === null) continue;
    const keys = [
      verification.connectionId
        ? `${verification.model}:${verification.connectionId}`
        : verification.model,
    ];

    for (const key of keys) {
      const existing = lookup.get(key);
      const existingRank = ranks.get(key);
      if (
        !existing ||
        existingRank === undefined ||
        rank < existingRank ||
        (rank === existingRank && verification.checkedAt > existing.checkedAt)
      ) {
        lookup.set(key, verification);
        ranks.set(key, rank);
      }
    }
  }

  return lookup;
}

export function resolveSourceVerification(
  lookup: Map<string, ModelPoolVerification>,
  modelValue: string,
  connectionId?: string
) {
  if (connectionId) return lookup.get(`${modelValue}:${connectionId}`);
  return lookup.get(modelValue);
}

export type BuildModelPoolSourcesOptions = {
  client?: ModelPoolClient;
  connectionId?: string;
};

export async function buildModelPoolSources({
  client = "all",
  connectionId,
}: BuildModelPoolSourcesOptions = {}) {
  const [connections, providerNodes, customModelsMap, verifications] = await Promise.all([
    getProviderConnections(),
    getProviderNodes(),
    getAllCustomModels(),
    getAllModelPoolVerifications(),
  ]);
  const verificationByModel = buildVerificationLookup(verifications, client);

  const providerNodeById = new Map(providerNodes.map((node: any) => [node.id, node]));
  const sources: ModelPoolSource[] = [];
  const seen = new Set<string>();

  for (const conn of connections as any[]) {
    if (conn.isActive === false) continue;
    if (connectionId && String(conn.id) !== connectionId) continue;

    const providerNode = providerNodeById.get(conn.provider);
    const alias = getConnectionPrefix(conn, providerNode);
    const capabilities = getDetectedCapabilities(conn);
    const detectedModels = getDetectedModels(conn);
    const addSource = (source: ModelPoolSource) => {
      const value = source.value;
      const sourceConnectionId = source.connectionId || conn.id;
      const seenKey = `${value}:${sourceConnectionId || ""}`;
      if (!value || seen.has(seenKey)) return;
      seen.add(seenKey);
      sources.push({
        ...source,
        provider: source.provider || conn.provider,
        alias: source.alias || alias,
        connectionId: sourceConnectionId,
        connectionName: source.connectionName || conn.name || "",
        verification: resolveSourceVerification(verificationByModel, value, sourceConnectionId),
        capabilities: source.capabilities || capabilities,
      });
    };

    for (const model of getModelsByProviderId(conn.provider) as any[]) {
      addSource({
        value: `${alias}/${model.id}`,
        label: `${alias}/${model.id}`,
        provider: conn.provider,
        alias,
        connectionName: conn.name || "",
        modelId: model.id,
        name: model.name || model.id,
        source: "system",
      });
    }

    const syncedModels = await getSyncedAvailableModelsForConnection(conn.provider, conn.id);
    for (const model of syncedModels) {
      addSource({
        value: `${alias}/${model.id}`,
        label: `${alias}/${model.id}`,
        provider: conn.provider,
        alias,
        connectionName: conn.name || "",
        modelId: model.id,
        name: model.name || model.id,
        source: "imported",
      });
    }

    const customModels = (customModelsMap as Record<string, unknown>)[conn.provider];
    for (const model of normalizeCustomModelEntries(alias, customModels)) {
      addSource({
        ...model,
        provider: conn.provider,
        alias,
        connectionName: conn.name || "",
      });
    }

    for (const model of detectedModels) {
      addSource({
        value: `${alias}/${model.id}`,
        label: `${alias}/${model.id}`,
        provider: conn.provider,
        alias,
        connectionName: conn.name || "",
        modelId: model.id,
        name: model.name || model.id,
        source: "detected",
      });
    }
  }

  return sources;
}
