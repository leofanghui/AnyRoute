"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import Modal from "./Modal";
import { getModelsByProviderId, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { getCompatibleFallbackModels } from "@/lib/providers/managedAvailableModels";
import {
  getModelCatalogSourceLabel,
  matchesModelCatalogQuery,
  normalizeModelCatalogSource,
} from "@/shared/utils/modelCatalogSearch";
import {
  OAUTH_PROVIDERS,
  NOAUTH_PROVIDERS,
  APIKEY_PROVIDERS,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
} from "@/shared/constants/providers";

// Provider order: OAuth first, then no-auth, then API Key (matches dashboard/providers)
const PROVIDER_ORDER = [
  ...Object.keys(OAUTH_PROVIDERS),
  ...Object.keys(NOAUTH_PROVIDERS),
  ...Object.keys(APIKEY_PROVIDERS),
];

type ModelSelectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (model: unknown) => void;
  onDeselect?: (model: unknown) => void;
  selectedModel?: string;
  selectedModels?: string[];
  activeProviders?: Array<{ provider: string; providerSpecificData?: Record<string, unknown> }>;
  availableModels?: Array<{
    value: string;
    label?: string;
    provider?: string;
    alias?: string;
    modelId?: string;
    name?: string;
    source?: string;
    poolId?: string;
    poolFamily?: string;
    poolFamilyLabel?: string;
    poolDisplayName?: string;
    sourceCount?: number;
    sources?: unknown[];
    verificationStatus?: "ok" | "partial" | "error";
    verificationCheckedAt?: string;
    verificationMessage?: string;
    capabilities?: Record<string, boolean>;
  }>;
  title?: string;
  modelAliases?: Record<string, string>;
  addedModelValues?: string[];
  multiSelect?: boolean;
  showCombos?: boolean;
  alwaysIncludeProviders?: string[] | null;
  keepOpenOnSelect?: boolean;
};

function getActiveProviderPrefix(provider: {
  provider: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  const prefix = provider.providerSpecificData?.prefix;
  return typeof prefix === "string" && prefix.trim() ? prefix.trim() : null;
}

function getVerificationLabel(status: unknown) {
  if (status === "ok") return "可用";
  if (status === "partial") return "部分可用";
  if (status === "error") return "不可用";
  return "";
}

function buildModelPoolTitle(model: any) {
  const lines: string[] = [];
  if (Array.isArray(model.sources) && model.sources.length > 0) {
    lines.push("来源：");
    for (const source of model.sources.slice(0, 8)) {
      const record = source && typeof source === "object" ? (source as Record<string, any>) : {};
      const sourceName = record.connectionName || record.alias || record.provider || "未知来源";
      const modelId = record.modelId || record.value || "";
      lines.push(`- ${sourceName}${modelId ? ` / ${modelId}` : ""}`);
    }
    if (model.sources.length > 8) lines.push(`- 另有 ${model.sources.length - 8} 个来源`);
  }
  const statusLabel = getVerificationLabel(model.verificationStatus);
  if (statusLabel) {
    lines.push(`最近验证：${statusLabel}`);
    if (model.verificationMessage) lines.push(String(model.verificationMessage));
  }
  if (model.capabilities && typeof model.capabilities === "object") {
    const capabilities = [
      model.capabilities.openaiChat ? "Chat" : "",
      model.capabilities.openaiResponses ? "Responses" : "",
      model.capabilities.claudeMessages ? "Claude Messages" : "",
      model.capabilities.streaming ? "Stream" : "",
      model.capabilities.tools ? "Tools" : "",
    ].filter(Boolean);
    if (capabilities.length > 0) lines.push(`能力：${capabilities.join(" / ")}`);
  }
  return lines.join("\n") || undefined;
}

export default function ModelSelectModal({
  isOpen,
  onClose,
  onSelect,
  onDeselect,
  selectedModel,
  selectedModels = [],
  activeProviders = [],
  availableModels = [],
  title,
  modelAliases = {},
  addedModelValues = [],
  multiSelect = false,
  showCombos = true,
  alwaysIncludeProviders = [],
  keepOpenOnSelect = false,
}: ModelSelectModalProps) {
  const t = useTranslations("common");
  const resolvedTitle = title ?? t("selectModel");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("all");
  const [combos, setCombos] = useState<any[]>([]);
  const [providerNodes, setProviderNodes] = useState<any[]>([]);
  const [customModels, setCustomModels] = useState<Record<string, any>>({});

  const fetchCombos = async () => {
    try {
      const res = await fetch("/api/combos");
      if (!res.ok) throw new Error(`Failed to fetch combos: ${res.status}`);
      const data = await res.json();
      setCombos(data.combos || []);
    } catch (error) {
      console.error("Error fetching combos:", error);
      setCombos([]);
    }
  };

  useEffect(() => {
    if (isOpen) fetchCombos();
  }, [isOpen]);

  const fetchProviderNodes = async () => {
    try {
      const res = await fetch("/api/provider-nodes");
      if (!res.ok) throw new Error(`Failed to fetch provider nodes: ${res.status}`);
      const data = await res.json();
      setProviderNodes(data.nodes || []);
    } catch (error) {
      console.error("Error fetching provider nodes:", error);
      setProviderNodes([]);
    }
  };

  useEffect(() => {
    if (isOpen) fetchProviderNodes();
  }, [isOpen]);

  const fetchCustomModels = async () => {
    try {
      const res = await fetch("/api/provider-models");
      if (!res.ok) throw new Error(`Failed to fetch custom models: ${res.status}`);
      const data = await res.json();
      setCustomModels(data.models || {});
    } catch (error) {
      console.error("Error fetching custom models:", error);
      setCustomModels({});
    }
  };

  useEffect(() => {
    if (isOpen) fetchCustomModels();
  }, [isOpen]);

  const allProviders = useMemo(
    () => ({ ...OAUTH_PROVIDERS, ...NOAUTH_PROVIDERS, ...APIKEY_PROVIDERS }),
    []
  );
  const alwaysIncludeProvidersKey = Array.isArray(alwaysIncludeProviders)
    ? alwaysIncludeProviders
        .filter((providerId) => typeof providerId === "string" && providerId)
        .join("\0")
    : "";

  // Group models by provider with priority order
  const groupedModels = useMemo(() => {
    const groups: Record<string, any> = {};
    const selectedValues = (multiSelect ? selectedModels : selectedModel ? [selectedModel] : [])
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => value.trim());
    const addCurrentConfigModels = () => {
      if (selectedValues.length === 0) return;
      const knownValues = new Set<string>();
      Object.values(groups).forEach((group: any) => {
        for (const model of group.models || []) {
          if (typeof model.value === "string") knownValues.add(model.value);
        }
      });
      const missingValues = selectedValues.filter((value) => !knownValues.has(value));
      if (missingValues.length === 0) return;
      groups["current-config"] = {
        name: "当前配置",
        alias: "当前配置",
        color: "#64748B",
        models: missingValues.map((value) => ({
          id: `current:${value}`,
          name: value,
          value,
          source: "custom",
        })),
      };
    };
    const modelPoolEntries = availableModels.filter((model) => model.source === "model-pool");

    if (modelPoolEntries.length > 0) {
      const familyColors: Record<string, string> = {
        claude: "#D97757",
        gpt: "#10A37F",
        deepseek: "#4F46E5",
        qwen: "#2563EB",
        kimi: "#7C3AED",
        glm: "#0891B2",
        other: "#64748B",
      };

      for (const model of modelPoolEntries) {
        const family = model.poolFamily || "other";
        const groupId = `model-pool:${family}`;
        if (!groups[groupId]) {
          groups[groupId] = {
            name: model.poolFamilyLabel || family,
            alias: model.poolFamilyLabel || family,
            color: familyColors[family] || familyColors.other,
            models: [],
            isModelPool: true,
          };
        }
        groups[groupId].models.push({
          id: model.poolId || model.value,
          name: model.label || model.poolDisplayName || model.name || model.value,
          value: model.value,
          source: model.source,
          provider: model.provider,
          alias: model.alias,
          connectionId: model.connectionId,
          connectionName: model.connectionName,
          modelId: model.modelId,
          sourceCount: model.sourceCount,
          sources: model.sources,
          verificationStatus: model.verificationStatus,
          verificationCheckedAt: model.verificationCheckedAt,
          verificationMessage: model.verificationMessage,
          capabilities: model.capabilities,
        });
      }

      addCurrentConfigModels();
      return groups;
    }

    // Get all active provider IDs from connections
    const activeConnectionIds = activeProviders.map((p) => p.provider);
    const explicitProviderIds = alwaysIncludeProvidersKey
      ? alwaysIncludeProvidersKey.split("\0")
      : [];

    // Only show connected providers (including both standard and custom)
    const providerIdsToShow = new Set([
      ...activeConnectionIds, // Connected providers
      ...explicitProviderIds, // Zero-config providers required by specific clients
    ]);

    // Sort by PROVIDER_ORDER
    const sortedProviderIds = [...providerIdsToShow].sort((a, b) => {
      const indexA = PROVIDER_ORDER.indexOf(a);
      const indexB = PROVIDER_ORDER.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    sortedProviderIds.forEach((providerId) => {
      const activeProvider = activeProviders.find((provider) => provider.provider === providerId);
      const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
      const providerInfo = allProviders[providerId] || { name: providerId, color: "#666" };
      const isCustomProvider =
        isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId);
      const matchedNode = providerNodes.find((node) => node.id === providerId);
      const activeProviderPrefix = activeProvider ? getActiveProviderPrefix(activeProvider) : null;
      const nodePrefix = activeProviderPrefix || matchedNode?.prefix || alias;
      const availableModelEntries = availableModels
        .filter((model) => {
          const modelProvider = typeof model?.provider === "string" ? model.provider : "";
          const modelAlias = typeof model?.alias === "string" ? model.alias : "";
          const modelId = typeof model?.value === "string" ? model.value : "";
          return (
            modelProvider === providerId ||
            modelAlias === nodePrefix ||
            modelAlias === alias ||
            modelId.startsWith(`${nodePrefix}/`) ||
            modelId.startsWith(`${alias}/`) ||
            modelId.startsWith(`${providerId}/`)
          );
        })
        .map((model) => {
          const value = model.value;
          const id = value.startsWith(`${nodePrefix}/`)
            ? value.slice(nodePrefix.length + 1)
            : value.startsWith(`${alias}/`)
              ? value.slice(alias.length + 1)
              : value.startsWith(`${providerId}/`)
                ? value.slice(providerId.length + 1)
                : value;
          return {
            id: model.modelId || id,
            name: model.name || model.label || model.modelId || id,
            value,
            source: model.source || "imported",
          };
        });

      // Get user-added custom models for this provider (if any)
      const providerCustomModels = customModels[providerId] || [];

      if (providerInfo.passthroughModels) {
        const aliasModels = Object.entries(modelAliases as Record<string, string>)
          .filter(([, fullModel]: [string, string]) => fullModel.startsWith(`${alias}/`))
          .map(([aliasName, fullModel]: [string, string]) => ({
            id: fullModel.replace(`${alias}/`, ""),
            name: aliasName,
            value: fullModel,
            source: "alias",
          }));

        // Merge custom models for passthrough providers
        const customEntries = providerCustomModels
          .filter((cm) => !aliasModels.some((am) => am.id === cm.id))
          .map((cm) => ({
            id: cm.id,
            name: cm.name || cm.id,
            value: `${alias}/${cm.id}`,
            isCustom: true,
            source: normalizeModelCatalogSource(cm.source) === "imported" ? "imported" : "custom",
          }));

        const allModels = [...aliasModels, ...customEntries];

        if (allModels.length > 0) {
          const displayName = matchedNode?.name || providerInfo.name;

          groups[providerId] = {
            name: displayName,
            alias: alias,
            color: providerInfo.color,
            models: allModels,
          };
        }
      } else if (isCustomProvider) {
        const displayName = matchedNode?.name || providerInfo.name;

        const nodeModels = Object.entries(modelAliases as Record<string, string>)
          .filter(([, fullModel]: [string, string]) => fullModel.startsWith(`${providerId}/`))
          .map(([aliasName, fullModel]: [string, string]) => ({
            id: fullModel.replace(`${providerId}/`, ""),
            name: aliasName,
            value: `${nodePrefix}/${fullModel.replace(`${providerId}/`, "")}`,
            source: "alias",
          }));

        const fallbackEntries = (
          getCompatibleFallbackModels(providerId, providerCustomModels) || []
        )
          .filter((fm) => !nodeModels.some((nm) => nm.id === fm.id))
          .map((fm) => ({
            id: fm.id,
            name: fm.name || fm.id,
            value: `${nodePrefix}/${fm.id}`,
            isFallback: true,
            source: "fallback",
          }));

        // Merge custom models for custom providers
        const customEntries = providerCustomModels
          .filter(
            (cm) =>
              !nodeModels.some((nm) => nm.id === cm.id) &&
              !fallbackEntries.some((fm) => fm.id === cm.id)
          )
          .map((cm) => ({
            id: cm.id,
            name: cm.name || cm.id,
            value: `${nodePrefix}/${cm.id}`,
            isCustom: true,
            source: normalizeModelCatalogSource(cm.source) === "imported" ? "imported" : "custom",
          }));

        const allModels = [
          ...nodeModels,
          ...availableModelEntries,
          ...fallbackEntries,
          ...customEntries,
        ];
        const dedupedModels = Array.from(
          new Map(allModels.map((model) => [model.value, model])).values()
        );

        if (dedupedModels.length > 0) {
          groups[providerId] = {
            name: displayName,
            alias: nodePrefix,
            color: providerInfo.color,
            models: dedupedModels,
            isCustom: true,
            hasModels: true,
          };
        }
      } else {
        const systemModels = getModelsByProviderId(providerId);

        // Merge system models with user-added custom models
        const systemEntries = systemModels.map((m) => ({
          id: m.id,
          name: m.name,
          value: `${alias}/${m.id}`,
          source: "system",
        }));

        const customEntries = providerCustomModels
          .filter((cm) => !systemModels.some((sm) => sm.id === cm.id))
          .map((cm) => ({
            id: cm.id,
            name: cm.name || cm.id,
            value: `${alias}/${cm.id}`,
            isCustom: true,
            source: normalizeModelCatalogSource(cm.source) === "imported" ? "imported" : "custom",
          }));

        const allModels = [...systemEntries, ...availableModelEntries, ...customEntries];
        const dedupedModels = Array.from(
          new Map(allModels.map((model) => [model.value, model])).values()
        );

        if (dedupedModels.length > 0) {
          groups[providerId] = {
            name: providerInfo.name,
            alias: alias,
            color: providerInfo.color,
            models: dedupedModels,
          };
        }
      }
    });

    addCurrentConfigModels();
    return groups;
  }, [
    activeProviders,
    alwaysIncludeProvidersKey,
    modelAliases,
    allProviders,
    providerNodes,
    customModels,
    availableModels,
    multiSelect,
    selectedModel,
    selectedModels,
  ]);

  // Filter combos by search query
  const filteredCombos = useMemo(() => {
    if (!searchQuery.trim()) return combos;
    const query = searchQuery.toLowerCase();
    return combos.filter((c) => c.name.toLowerCase().includes(query));
  }, [combos, searchQuery]);

  // Filter models by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedModels;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, any> = {};

    Object.entries(groupedModels).forEach(([providerId, group]: [string, any]) => {
      const matchedModels = group.models.filter((model) =>
        matchesModelCatalogQuery(query, {
          modelId: model.id,
          modelName: model.name,
          source: model.source,
        })
      );

      const providerNameMatches = group.name.toLowerCase().includes(query);

      if (matchedModels.length > 0 || providerNameMatches) {
        filtered[providerId] = {
          ...group,
          models: matchedModels.length > 0 ? matchedModels : group.models,
        };
      }
    });

    return filtered;
  }, [groupedModels, searchQuery]);

  const providerTags = useMemo(
    () =>
      Object.entries(groupedModels).map(([providerId, group]: [string, any]) => ({
        id: providerId,
        name: group.name,
        color: group.color,
        count: group.models.length,
      })),
    [groupedModels]
  );

  useEffect(() => {
    if (selectedProviderId !== "all" && !groupedModels[selectedProviderId]) {
      setSelectedProviderId("all");
    }
  }, [groupedModels, selectedProviderId]);

  const visibleGroups = useMemo(() => {
    if (selectedProviderId === "all") return filteredGroups;
    const group = filteredGroups[selectedProviderId];
    return group ? { [selectedProviderId]: group } : {};
  }, [filteredGroups, selectedProviderId]);

  const visibleCombos = selectedProviderId === "all" ? filteredCombos : [];

  const resolvedSelectedModels = multiSelect
    ? selectedModels
    : selectedModel
      ? [selectedModel]
      : [];

  const isValueSelected = (value: string) => resolvedSelectedModels.includes(value);

  const handleSelect = (model: any) => {
    const candidateValue =
      typeof model?.value === "string"
        ? model.value
        : typeof model?.name === "string"
          ? model.name
          : typeof model === "string"
            ? model
            : "";
    const isAdded = candidateValue ? addedModelValues.includes(candidateValue) : false;

    if (isAdded && onDeselect) {
      onDeselect(model);
    } else {
      onSelect(model);
    }

    if (!multiSelect && !keepOpenOnSelect) {
      onClose();
      setSearchQuery("");
      setSelectedProviderId("all");
    }
  };

  const doneFooter =
    keepOpenOnSelect && !multiSelect ? (
      <button
        type="button"
        onClick={() => {
          onClose();
          setSearchQuery("");
          setSelectedProviderId("all");
        }}
        className="w-full px-3 py-2 text-sm font-medium rounded border border-primary bg-primary text-white hover:bg-primary/90 transition-colors"
      >
        {t("done")}
      </button>
    ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setSearchQuery("");
        setSelectedProviderId("all");
      }}
      title={resolvedTitle}
      size="md"
      className="p-4!"
      footer={doneFooter}
    >
      {/* Search - compact */}
      <div className="mb-3">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[16px]">
            search
          </span>
          <input
            type="text"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {providerTags.length > 0 && (
        <div className="mb-3 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedProviderId("all")}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              selectedProviderId === "all"
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-text-muted hover:border-primary/50 hover:text-text-main"
            }`}
          >
            {t("all")}
          </button>
          {providerTags.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => setSelectedProviderId(provider.id)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                selectedProviderId === provider.id
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-text-main hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <span
                className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{ backgroundColor: provider.color }}
              />
              {provider.name}
              <span className="ml-1 opacity-70">({provider.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Models grouped by provider - compact */}
      <div className="max-h-[300px] overflow-y-auto space-y-3">
        {/* Combos section - always first */}
        {showCombos && visibleCombos.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 sticky top-0 bg-surface py-0.5">
              <span className="material-symbols-outlined text-primary text-[14px]">layers</span>
              <span className="text-xs font-medium text-primary">{t("combos")}</span>
              <span className="text-[10px] text-text-muted">({visibleCombos.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {visibleCombos.map((combo) => {
                const isSelected = isValueSelected(combo.name);
                return (
                  <button
                    key={combo.id}
                    onClick={() =>
                      handleSelect({ id: combo.name, name: combo.name, value: combo.name })
                    }
                    className={`
                      px-2 py-1 rounded-xl text-xs font-medium transition-all border hover:cursor-pointer
                      ${
                        isSelected
                          ? "bg-primary text-white border-primary"
                          : "bg-surface border-border text-text-main hover:border-primary/50 hover:bg-primary/5"
                      }
                    `}
                  >
                    {combo.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Provider models */}
        {Object.entries(visibleGroups).map(([providerId, group]: [string, any]) => (
          <div key={providerId}>
            {/* Provider header */}
            <div className="flex items-center gap-1.5 mb-1.5 sticky top-0 bg-surface py-0.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
              <span className="text-xs font-medium text-primary">{group.name}</span>
              <span className="text-[10px] text-text-muted">({group.models.length})</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {group.models.map((model) => {
                const isSelected = isValueSelected(model.value);
                const isAdded = addedModelValues.includes(model.value);
                const verificationLabel = getVerificationLabel(model.verificationStatus);
                return (
                  <button
                    key={model.id}
                    onClick={() => handleSelect(model)}
                    title={group.isModelPool ? buildModelPoolTitle(model) : undefined}
                    className={`
                      px-2 py-1 rounded-xl text-xs font-medium transition-all border hover:cursor-pointer
                      ${
                        isSelected
                          ? "bg-primary text-white border-primary"
                          : isAdded
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                            : "bg-surface border-border text-text-main hover:border-primary/50 hover:bg-primary/5"
                      }
                    `}
                  >
                    {isAdded && <span className="mr-0.5 opacity-70">✓</span>}
                    {model.name}
                    {verificationLabel && (
                      <span className="ml-1 text-[10px] opacity-70">{verificationLabel}</span>
                    )}
                    {model.source && model.source !== "model-pool" && (
                      <span className="ml-1 text-[10px] uppercase opacity-70">
                        {getModelCatalogSourceLabel(model.source)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(visibleGroups).length === 0 && visibleCombos.length === 0 && (
          <div className="text-center py-4 text-text-muted">
            <span className="material-symbols-outlined text-2xl mb-1 block">search_off</span>
            <p className="text-xs">{t("noModelsFound")}</p>
          </div>
        )}
      </div>
      {multiSelect && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-xs text-text-muted">{resolvedSelectedModels.length} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="px-2 py-1 text-xs rounded border border-border bg-surface hover:bg-primary/5"
            >
              {t("clear")}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                setSearchQuery("");
                setSelectedProviderId("all");
              }}
              className="px-2 py-1 text-xs rounded border border-border bg-surface hover:bg-primary/5"
            >
              {t("done")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
