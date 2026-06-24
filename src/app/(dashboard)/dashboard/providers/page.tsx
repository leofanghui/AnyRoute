"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardSkeleton, Button, Modal } from "@/shared/components";
import {
  AGGREGATOR_PROVIDER_IDS,
  isClaudeCodeCompatibleProvider,
  providerAllowsOptionalApiKey,
  supportsBulkApiKey,
} from "@/shared/constants/providers";
import { getModelsByProviderId } from "@/shared/constants/models";
import { useRouter, useSearchParams } from "next/navigation";
import { getErrorCode, getRelativeTime } from "@/shared/utils";
import { parseBulkApiKeys } from "@/shared/utils/bulkApiKeyParser";
import { pickDisplayValue } from "@/shared/utils/maskEmail";
import { matchesSearch } from "@/shared/utils/turkishText";
import useEmailPrivacyStore from "@/store/emailPrivacyStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useTranslations } from "next-intl";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { buildStaticProviderEntries, shouldShowFirstProviderHint } from "./providerPageUtils";
import CcSwitchImportPanel from "./components/CcSwitchImportPanel";
import type { ProviderEntry } from "./providerPageUtils";
import {
  getCodexEffectiveServiceTier,
  getCodexGlobalServiceMode,
  type CodexGlobalServiceMode,
} from "@/lib/providers/codexFastTier";
import {
  getProviderBaseUrlDefault,
  getProviderBaseUrlHint,
  getProviderBaseUrlPlaceholder,
  isBaseUrlConfigurableProvider,
  normalizeAndValidateHttpBaseUrl,
} from "./[id]/providerPageHelpers";

type DashboardProviderInfo = {
  id?: string;
  name: string;
  color?: string;
  apiType?: string;
  compatibleMode?: CompatibleMode;
  deprecated?: boolean;
  deprecationReason?: string;
  hasFree?: boolean;
  freeNote?: string;
  isCompatibleTemplate?: boolean;
  [key: string]: unknown;
};

type ProviderPresetCategory = "apikey" | "oauth" | "compatible" | "web-cookie" | "no-auth";
type ChannelCategory = ProviderPresetCategory | "all";

type DashboardProviderEntry = ProviderEntry<DashboardProviderInfo> & {
  presetCategory?: ProviderPresetCategory;
};

type MarketplaceTab = "channels" | "models";
type CompatibleMode = "openai" | "anthropic";
type CompatibleProviderNode = { id: string } & Record<string, unknown>;

type ModelMarketplaceItem = {
  id: string;
  name: string;
  providers: Array<{
    providerId: string;
    providerName: string;
    provider: DashboardProviderInfo;
    hasFree: boolean;
  }>;
  hasFree: boolean;
  contextLength?: number;
  apiFormat?: string;
  supportedEndpoints?: string[];
  supportsReasoning?: boolean;
  supportsVision?: boolean;
  toolCalling?: boolean;
};

type MarketplaceModel = Pick<
  ModelMarketplaceItem,
  | "id"
  | "name"
  | "contextLength"
  | "apiFormat"
  | "supportedEndpoints"
  | "supportsReasoning"
  | "supportsVision"
  | "toolCalling"
>;

function dedupeProviderEntries(entries: DashboardProviderEntry[]): DashboardProviderEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.providerId)) return false;
    seen.add(entry.providerId);
    return true;
  });
}

function providerEntryHasFree(entry: DashboardProviderEntry): boolean {
  return entry.provider.hasFree === true;
}

function withPresetCategory(
  entries: ProviderEntry<DashboardProviderInfo>[],
  presetCategory: ProviderPresetCategory
): DashboardProviderEntry[] {
  return entries.map((entry) => ({ ...entry, presetCategory }));
}

function getProviderCardAuthType(entry: DashboardProviderEntry): string {
  if (entry.toggleAuthType === "free") return "free";
  if (entry.presetCategory === "web-cookie") return "web-cookie";
  return entry.displayAuthType;
}

function getChannelConnectionCategory(
  connection: any,
  providerEntry?: DashboardProviderEntry,
  providerNode?: any
): ProviderPresetCategory {
  if (providerEntry?.presetCategory) return providerEntry.presetCategory;
  if (providerNode?.type === "openai-compatible" || providerNode?.type === "anthropic-compatible") {
    return "compatible";
  }

  const authType = String(connection?.authType || "").toLowerCase();
  if (authType === "oauth") return "oauth";
  if (authType === "cookie" || authType === "web-cookie") return "web-cookie";
  if (authType === "none" || authType === "no-auth" || authType === "free") return "no-auth";
  return "apikey";
}

function getProviderDisplayName(entry: DashboardProviderEntry): string {
  return entry.provider.name || entry.providerId;
}

function getCompatibleTemplateMode(entry: DashboardProviderEntry): CompatibleMode | null {
  if (!entry.provider.isCompatibleTemplate) return null;
  return entry.provider.compatibleMode === "openai" || entry.provider.compatibleMode === "anthropic"
    ? entry.provider.compatibleMode
    : null;
}

function buildCompatibleTemplateEntries(t: ProviderMessageTranslator): DashboardProviderEntry[] {
  return [
    {
      providerId: "__compatible-openai-template",
      provider: {
        id: "openai",
        name: providerText(t, "openAICompatible", "OpenAI 兼容"),
        color: "#10A37F",
        compatibleMode: "openai",
        isCompatibleTemplate: true,
      },
      stats: { total: 0 },
      displayAuthType: "compatible",
      toggleAuthType: "apikey",
      presetCategory: "compatible",
    },
    {
      providerId: "__compatible-anthropic-template",
      provider: {
        id: "anthropic",
        name: providerText(t, "anthropicCompatible", "Anthropic 兼容"),
        color: "#D97757",
        compatibleMode: "anthropic",
        isCompatibleTemplate: true,
      },
      stats: { total: 0 },
      displayAuthType: "compatible",
      toggleAuthType: "apikey",
      presetCategory: "compatible",
    },
  ];
}

function matchesDashboardQuery(
  queryValue: string | undefined | null,
  ...values: Array<string | undefined | null>
): boolean {
  const query = queryValue?.trim();
  if (!query) return true;

  return values.some((value) => matchesSearch(String(value || ""), query));
}

function firstPositiveNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function normalizeModelEndpoints(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const endpoints = Array.from(
    new Set(
      value.map((endpoint) => (typeof endpoint === "string" ? endpoint.trim() : "")).filter(Boolean)
    )
  );
  return endpoints.length > 0 ? endpoints : undefined;
}

function normalizeMarketplaceModel(model: unknown): MarketplaceModel | null {
  const record = model && typeof model === "object" ? (model as Record<string, any>) : {};
  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : typeof record.model === "string" && record.model.trim()
        ? record.model.trim()
        : "";
  if (!id) return null;

  const topProvider =
    record.top_provider && typeof record.top_provider === "object"
      ? (record.top_provider as Record<string, unknown>)
      : {};
  const name =
    (typeof record.name === "string" && record.name.trim()) ||
    (typeof record.displayName === "string" && record.displayName.trim()) ||
    id;

  return {
    id,
    name,
    contextLength: firstPositiveNumber(
      record.contextLength,
      record.context_length,
      record.inputTokenLimit,
      record.maxInputTokens,
      topProvider.context_length
    ),
    apiFormat: typeof record.apiFormat === "string" ? record.apiFormat : undefined,
    supportedEndpoints: normalizeModelEndpoints(record.supportedEndpoints),
    supportsReasoning: record.supportsReasoning === true || record.supportsThinking === true,
    supportsVision: record.supportsVision === true || record.vision === true,
    toolCalling: record.toolCalling === true || record.supportsTools === true,
  };
}

function mergeMarketplaceModel(
  modelsById: Map<string, MarketplaceModel>,
  model: MarketplaceModel | null
) {
  if (!model) return;
  const existing = modelsById.get(model.id);
  if (!existing) {
    modelsById.set(model.id, model);
    return;
  }

  modelsById.set(model.id, {
    ...existing,
    name: existing.name && existing.name !== existing.id ? existing.name : model.name,
    contextLength: existing.contextLength ?? model.contextLength,
    apiFormat: existing.apiFormat ?? model.apiFormat,
    supportedEndpoints: existing.supportedEndpoints ?? model.supportedEndpoints,
    supportsReasoning: existing.supportsReasoning || model.supportsReasoning,
    supportsVision: existing.supportsVision || model.supportsVision,
    toolCalling: existing.toolCalling || model.toolCalling,
  });
}

function getProviderModelsFromPayload(payload: unknown, providerId: string): unknown[] {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const directModels = record[providerId];
  if (Array.isArray(directModels)) return directModels;

  const models = record.models;
  if (Array.isArray(models)) return models;
  if (models && typeof models === "object") {
    const providerModels = (models as Record<string, unknown>)[providerId];
    if (Array.isArray(providerModels)) return providerModels;
  }

  return [];
}

function mergeModelMarketplaceItem(
  itemsById: Map<string, ModelMarketplaceItem>,
  entry: DashboardProviderEntry,
  model: MarketplaceModel
) {
  const key = model.id.trim().toLowerCase();
  const providerInfo = {
    providerId: entry.providerId,
    providerName: getProviderDisplayName(entry),
    provider: entry.provider,
    hasFree: providerEntryHasFree(entry),
  };
  const existing = itemsById.get(key);

  if (!existing) {
    itemsById.set(key, {
      ...model,
      providers: [providerInfo],
      hasFree: providerInfo.hasFree,
    });
    return;
  }

  if (!existing.providers.some((provider) => provider.providerId === entry.providerId)) {
    existing.providers.push(providerInfo);
  }
  existing.hasFree = existing.hasFree || providerInfo.hasFree;
  existing.name = existing.name && existing.name !== existing.id ? existing.name : model.name;
  existing.contextLength = existing.contextLength ?? model.contextLength;
  existing.apiFormat = existing.apiFormat ?? model.apiFormat;
  existing.supportedEndpoints = existing.supportedEndpoints ?? model.supportedEndpoints;
  existing.supportsReasoning = existing.supportsReasoning || model.supportsReasoning;
  existing.supportsVision = existing.supportsVision || model.supportsVision;
  existing.toolCalling = existing.toolCalling || model.toolCalling;
}

function getModelInitial(item: ModelMarketplaceItem): string {
  const text = (item.name || item.id || "M").trim();
  return text.charAt(0).toUpperCase();
}

function formatContextLength(tokens?: number): string | null {
  if (typeof tokens !== "number" || !Number.isFinite(tokens) || tokens <= 0) return null;
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : Number(millions.toFixed(1))}M`;
  }
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return String(tokens);
}

function getModelMarketplaceTags(item: ModelMarketplaceItem): string[] {
  const tags: string[] = [];
  tags.push(item.supportedEndpoints?.[0] || "chat");
  if (item.apiFormat === "responses") tags.push("responses");
  return Array.from(new Set(tags)).slice(0, 4);
}

type ProviderMessageTranslator = ((key: string, values?: Record<string, unknown>) => string) & {
  has?: (key: string) => boolean;
};

function providerText(
  t: ProviderMessageTranslator,
  key: string,
  fallback: string,
  values?: Record<string, unknown>
): string {
  if (typeof t.has === "function" && t.has(key)) {
    return t(key, values);
  }
  if (values) {
    return Object.entries(values).reduce(
      (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
      fallback
    );
  }
  return fallback;
}

function buildCategoryTabs(
  t: ProviderMessageTranslator
): Array<{ id: ChannelCategory; label: string; icon: string }> {
  return [
    { id: "all", label: providerText(t, "all", "全部"), icon: "apps" },
    { id: "apikey", label: providerText(t, "apiKeyLabel", "API Key"), icon: "key" },
    { id: "oauth", label: providerText(t, "oauthLabel", "OAuth"), icon: "verified_user" },
    { id: "compatible", label: providerText(t, "compatibleLabel", "兼容"), icon: "hub" },
    {
      id: "web-cookie",
      label: providerText(t, "webSessionLabel", "网页会话"),
      icon: "language",
    },
    { id: "no-auth", label: providerText(t, "noAuthLabel", "免密"), icon: "lock_open" },
  ];
}

type ProviderBatchTestResult = {
  connectionId?: string;
  connectionName?: string;
  provider?: string;
  valid?: boolean;
  latencyMs?: number;
  error?: string | null;
  testedAt?: string;
  statusCode?: number | string | null;
  diagnosis?: { type?: string; source?: string; code?: string | number | null };
};

type ProviderBatchTestResults = {
  mode?: string;
  results?: ProviderBatchTestResult[];
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
  };
  error?: string | { message?: string };
};

function getConnectionErrorTag(connection) {
  if (!connection) return null;

  const explicitType = connection.lastErrorType;
  if (explicitType === "runtime_error") return "Runtime";
  if (
    explicitType === "upstream_auth_error" ||
    explicitType === "auth_missing" ||
    explicitType === "token_refresh_failed" ||
    explicitType === "token_expired"
  ) {
    return "Auth";
  }
  if (explicitType === "upstream_rate_limited") return "Rate limited";
  if (explicitType === "upstream_unavailable") return "Server error";
  if (explicitType === "network_error") return "Network";

  const numericCode = Number(connection.errorCode);
  if (Number.isFinite(numericCode) && numericCode >= 400) {
    return String(numericCode);
  }

  const fromMessage = getErrorCode(connection.lastError);
  if (fromMessage === "401" || fromMessage === "403") return "Auth";
  if (fromMessage && fromMessage !== "ERR") return fromMessage;

  const msg = (connection.lastError || "").toLowerCase();
  if (msg.includes("runtime") || msg.includes("not runnable") || msg.includes("not installed"))
    return "Runtime";
  if (
    msg.includes("invalid api key") ||
    msg.includes("token invalid") ||
    msg.includes("revoked") ||
    msg.includes("unauthorized")
  )
    return "Auth";

  return "ERR";
}

export default function ProvidersPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<any[]>([]);
  const [providerNodes, setProviderNodes] = useState<any[]>([]);
  const [blockedProviders, setBlockedProviders] = useState<string[]>([]);
  const [expirations, setExpirations] = useState<any>(null);
  const [codexGlobalServiceMode, setCodexGlobalServiceMode] =
    useState<CodexGlobalServiceMode>("none");
  const [loading, setLoading] = useState(true);
  const [showProviderPresetModal, setShowProviderPresetModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeMarketplaceTab, setActiveMarketplaceTab] = useState<MarketplaceTab>("channels");
  const [activeChannelCategory, setActiveChannelCategory] = useState<ChannelCategory>("all");
  const [channelSearchQuery, setChannelSearchQuery] = useState("");
  const [testingMode, setTestingMode] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [selectedModelItem, setSelectedModelItem] = useState<ModelMarketplaceItem | null>(null);
  const [marketplaceModelsByProvider, setMarketplaceModelsByProvider] = useState<
    Record<string, MarketplaceModel[]>
  >({});
  const [loadingMarketplaceModels, setLoadingMarketplaceModels] = useState(false);
  const notify = useNotificationStore();
  const t = useTranslations("providers") as ProviderMessageTranslator;
  const tc = useTranslations("common");
  const ccCompatibleLabel = t("ccCompatibleLabel");
  const searchParams = useSearchParams();

  const marketplaceConnectionSnapshot = useMemo(() => {
    return JSON.stringify(
      connections
        .map((connection) => ({
          id: String(connection.id || ""),
          provider: String(connection.provider || ""),
          defaultModel:
            typeof connection.defaultModel === "string" ? connection.defaultModel.trim() : "",
        }))
        .filter((connection) => connection.id && connection.provider)
        .sort((a, b) => `${a.provider}:${a.id}`.localeCompare(`${b.provider}:${b.id}`))
    );
  }, [connections]);

  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) {
      setChannelSearchQuery(searchFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [connectionsRes, nodesRes, expirationsRes, settingsRes] = await Promise.all([
          fetch("/api/providers"),
          fetch("/api/provider-nodes"),
          fetch("/api/providers/expiration"),
          fetch("/api/settings", { cache: "no-store" }),
        ]);
        const connectionsData = await connectionsRes.json();
        const nodesData = await nodesRes.json();
        const expirationsData = await expirationsRes.json();
        const settingsData = settingsRes.ok ? await settingsRes.json() : null;
        if (connectionsRes.ok) setConnections(connectionsData.connections || []);
        if (nodesRes.ok) {
          setProviderNodes(nodesData.nodes || []);
        }
        if (expirationsRes.ok && expirationsData) setExpirations(expirationsData);
        if (settingsData && Array.isArray(settingsData.blockedProviders)) {
          setBlockedProviders(settingsData.blockedProviders);
        }
        setCodexGlobalServiceMode(getCodexGlobalServiceMode(settingsData));
      } catch (error) {
        console.log("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const connectionRefs = JSON.parse(marketplaceConnectionSnapshot) as Array<{
      id: string;
      provider: string;
      defaultModel: string;
    }>;

    if (connectionRefs.length === 0) {
      setMarketplaceModelsByProvider({});
      return;
    }

    let cancelled = false;
    const loadMarketplaceModels = async () => {
      setLoadingMarketplaceModels(true);
      try {
        const [syncedRes, customRes] = await Promise.all([
          fetch("/api/synced-available-models", { cache: "no-store" }),
          fetch("/api/provider-models", { cache: "no-store" }),
        ]);
        const syncedData = syncedRes.ok ? await syncedRes.json() : {};
        const customData = customRes.ok ? await customRes.json() : {};
        const providerIds = Array.from(new Set(connectionRefs.map((ref) => ref.provider)));
        const nextModelsByProvider: Record<string, MarketplaceModel[]> = {};

        for (const providerId of providerIds) {
          const modelsById = new Map<string, MarketplaceModel>();

          for (const model of getModelsByProviderId(providerId)) {
            mergeMarketplaceModel(modelsById, normalizeMarketplaceModel(model));
          }
          for (const model of getProviderModelsFromPayload(syncedData, providerId)) {
            mergeMarketplaceModel(modelsById, normalizeMarketplaceModel(model));
          }
          for (const model of getProviderModelsFromPayload(customData, providerId)) {
            mergeMarketplaceModel(modelsById, normalizeMarketplaceModel(model));
          }
          for (const ref of connectionRefs.filter((item) => item.provider === providerId)) {
            if (ref.defaultModel) {
              mergeMarketplaceModel(modelsById, {
                id: ref.defaultModel,
                name: ref.defaultModel,
              });
            }
          }

          nextModelsByProvider[providerId] = Array.from(modelsById.values());
        }

        if (!cancelled) setMarketplaceModelsByProvider(nextModelsByProvider);
      } catch (error) {
        console.log("Error fetching marketplace models:", error);
        if (!cancelled) setMarketplaceModelsByProvider({});
      } finally {
        if (!cancelled) setLoadingMarketplaceModels(false);
      }
    };

    loadMarketplaceModels();

    return () => {
      cancelled = true;
    };
  }, [marketplaceConnectionSnapshot]);

  const getProviderStats = (providerId, authType) => {
    const providerConnections = connections.filter((c) => {
      if (c.provider !== providerId) return false;
      if (authType === "free") return true;
      return c.authType === authType;
    });

    // Helper: check if connection is effectively active (cooldown expired)
    const getEffectiveStatus = (conn) => {
      const isCooldown =
        conn.rateLimitedUntil && new Date(conn.rateLimitedUntil).getTime() > Date.now();
      return conn.testStatus === "unavailable" && !isCooldown ? "active" : conn.testStatus;
    };

    const connected = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return status === "active" || status === "success";
    }).length;

    const errorConns = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return status === "error" || status === "expired" || status === "unavailable";
    });

    const error = errorConns.length;
    const total = providerConnections.length;

    // Check if all connections are manually disabled
    const allDisabled = total > 0 && providerConnections.every((c) => c.isActive === false);

    // Get latest error info
    const latestError = errorConns.sort(
      (a: any, b: any) =>
        (new Date(b.lastErrorAt || 0) as any) - (new Date(a.lastErrorAt || 0) as any)
    )[0];
    const errorCode = latestError ? getConnectionErrorTag(latestError) : null;
    const errorTime = latestError?.lastErrorAt ? getRelativeTime(latestError.lastErrorAt) : null;

    // Check expirations
    const providerExpirations =
      expirations?.list?.filter((e: any) => e.provider === providerId) || [];
    const hasExpired = providerExpirations.some((e: any) => e.status === "expired");
    const hasExpiringSoon = providerExpirations.some((e: any) => e.status === "expiring_soon");
    let expiryStatus = null;
    if (hasExpired) expiryStatus = "expired";
    else if (hasExpiringSoon) expiryStatus = "expiring_soon";

    const codexConnectionServiceTiers = [
      ...new Set(
        providerConnections
          .map((connection) =>
            getCodexEffectiveServiceTier(connection.providerSpecificData, "none")
          )
          .filter((tier) => tier !== "default")
      ),
    ];
    const codexServiceTier =
      providerId === "codex"
        ? codexGlobalServiceMode !== "none"
          ? codexGlobalServiceMode
          : codexConnectionServiceTiers.length === 1
            ? codexConnectionServiceTiers[0]
            : null
        : null;

    // Count API keys in "warning" state across all connections
    const warning = providerConnections.reduce((warnCount, conn) => {
      const health = (conn as any).providerSpecificData?.apiKeyHealth as
        | Record<string, { status: string }>
        | undefined;
      if (!health) return warnCount;
      return warnCount + Object.values(health).filter((h) => h.status === "warning").length;
    }, 0);

    return {
      connected,
      error,
      warning,
      total,
      errorCode,
      errorTime,
      allDisabled,
      expiryStatus,
      codexServiceTier,
    };
  };

  const updateConnectionInState = (connectionId: string, patch: Record<string, unknown>) => {
    setConnections((prev) =>
      prev.map((connection) =>
        connection.id === connectionId ? { ...connection, ...patch } : connection
      )
    );
  };

  const removeConnectionFromState = (connectionId: string) => {
    setConnections((prev) => prev.filter((connection) => connection.id !== connectionId));
  };

  const applyBatchTestResults = (results: ProviderBatchTestResult[] | undefined) => {
    if (!Array.isArray(results) || results.length === 0) return;

    const updates = new Map<string, Record<string, unknown>>();
    for (const result of results) {
      if (!result.connectionId || result.connectionId === "unknown") continue;
      const valid = result.valid === true;
      const testedAt = result.testedAt || new Date().toISOString();
      updates.set(result.connectionId, {
        testStatus: valid ? "active" : "error",
        lastError: valid
          ? null
          : result.error || providerText(t, "channelTestFailed", "渠道测试失败"),
        lastErrorAt: valid ? null : testedAt,
        lastTested: testedAt,
        latencyMs: typeof result.latencyMs === "number" ? result.latencyMs : undefined,
        lastErrorType: valid ? null : result.diagnosis?.type || null,
        lastErrorSource: valid ? null : result.diagnosis?.source || null,
        errorCode: valid ? null : result.diagnosis?.code || result.statusCode || null,
      });
    }

    if (updates.size === 0) return;
    setConnections((prev) =>
      prev.map((connection) =>
        updates.has(connection.id) ? { ...connection, ...updates.get(connection.id) } : connection
      )
    );
  };

  const handleBatchTest = async (mode, providerId = null) => {
    if (testingMode) return;
    setTestingMode(mode === "provider" ? providerId : mode);
    setTestResults(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000); // 90s max
    try {
      const res = await fetch("/api/providers/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, providerId }),
        signal: controller.signal,
      });
      let data: any;
      try {
        data = await res.json();
      } catch {
        // Response body is not valid JSON (e.g. truncated due to timeout)
        data = { error: t("providerTestFailed"), results: [], summary: null };
      }
      if (!res.ok) {
        const message = data?.error
          ? typeof data.error === "object"
            ? data.error.message || data.error.error || JSON.stringify(data.error)
            : String(data.error)
          : t("providerTestFailed");
        notify.error(message);
      }
      applyBatchTestResults(data?.results);
      setTestResults({
        ...data,
        // Normalize error: if API returns an error object { message, details }, extract the string
        error: data.error
          ? typeof data.error === "object"
            ? data.error.message || data.error.error || JSON.stringify(data.error)
            : String(data.error)
          : null,
      });
      if (data?.summary) {
        const { passed, failed, total } = data.summary;
        if (failed === 0) notify.success(t("allTestsPassed", { total }));
        else notify.warning(t("testSummary", { passed, failed, total }));
      }
    } catch (error: any) {
      const isAbort = error?.name === "AbortError";
      const msg = isAbort ? t("providerTestTimeout") : t("providerTestFailed");
      setTestResults({ error: msg, results: [], summary: null });
      notify.error(msg);
    } finally {
      clearTimeout(timeoutId);
      setTestingMode(null);
    }
  };

  const compatibleProviders = providerNodes
    .filter((node) => node.type === "openai-compatible")
    .map((node) => ({
      id: node.id,
      name: node.name || t("openaiCompatibleName"),
      color: "#10A37F",
      textIcon: "OC",
      apiType: node.apiType,
    }));

  const anthropicCompatibleProviders = providerNodes
    .filter(
      (node) => node.type === "anthropic-compatible" && !isClaudeCodeCompatibleProvider(node.id)
    )
    .map((node) => ({
      id: node.id,
      name: node.name || t("anthropicCompatibleName"),
      color: "#D97757",
      textIcon: "AC",
    }));

  const ccCompatibleProviders = providerNodes
    .filter(
      (node) => node.type === "anthropic-compatible" && isClaudeCodeCompatibleProvider(node.id)
    )
    .map((node) => ({
      id: node.id,
      name: node.name || ccCompatibleLabel,
      color: "#B45309",
      textIcon: "CC",
    }));

  const oauthProviderEntriesAll = withPresetCategory(
    buildStaticProviderEntries("oauth", getProviderStats),
    "oauth"
  );

  const blockedProviderSet = new Set(blockedProviders);
  const rawNoAuthEntriesAll = withPresetCategory(
    buildStaticProviderEntries("no-auth", getProviderStats),
    "no-auth"
  );
  const noAuthEntriesAll = rawNoAuthEntriesAll.filter(({ providerId, provider }) => {
    const alias = typeof provider.alias === "string" ? provider.alias : null;
    return !blockedProviderSet.has(providerId) && !(alias && blockedProviderSet.has(alias));
  });

  const apiKeyProviderEntriesAll = withPresetCategory(
    buildStaticProviderEntries("apikey", getProviderStats),
    "apikey"
  );
  const visibleApiKeyProviderEntriesAll = apiKeyProviderEntriesAll.filter(
    (entry) => !AGGREGATOR_PROVIDER_IDS.has(entry.providerId)
  );
  const webCookieProviderEntriesAll = withPresetCategory(
    buildStaticProviderEntries("web-cookie", getProviderStats),
    "web-cookie"
  );

  const compatibleProviderEntriesAll = [
    ...compatibleProviders.map((provider) => ({
      providerId: provider.id,
      provider,
      stats: getProviderStats(provider.id, "apikey"),
      displayAuthType: "compatible" as const,
      toggleAuthType: "apikey" as const,
      presetCategory: "compatible" as const,
    })),
    ...anthropicCompatibleProviders.map((provider) => ({
      providerId: provider.id,
      provider,
      stats: getProviderStats(provider.id, "apikey"),
      displayAuthType: "compatible" as const,
      toggleAuthType: "apikey" as const,
      presetCategory: "compatible" as const,
    })),
    ...ccCompatibleProviders.map((provider) => ({
      providerId: provider.id,
      provider,
      stats: getProviderStats(provider.id, "apikey"),
      displayAuthType: "compatible" as const,
      toggleAuthType: "apikey" as const,
      presetCategory: "compatible" as const,
    })),
  ];

  const staticProviderEntriesAll = dedupeProviderEntries([
    ...oauthProviderEntriesAll,
    ...noAuthEntriesAll,
    ...visibleApiKeyProviderEntriesAll,
    ...webCookieProviderEntriesAll,
  ] as DashboardProviderEntry[]);
  const providerPresetEntriesAll = dedupeProviderEntries([
    ...staticProviderEntriesAll,
    ...buildCompatibleTemplateEntries(t),
  ]);
  const dashboardProviderEntriesAll = dedupeProviderEntries([
    ...staticProviderEntriesAll,
    ...compatibleProviderEntriesAll,
  ]);
  const providerEntryById = new Map(
    dashboardProviderEntriesAll.map((entry) => [entry.providerId, entry])
  );
  const providerNodeById = new Map(providerNodes.map((node) => [node.id, node]));
  const channelProviderEntries = dedupeProviderEntries(
    Array.from(new Set(connections.map((connection) => connection.provider).filter(Boolean))).map(
      (providerId) => {
        const providerEntry = providerEntryById.get(providerId);
        if (providerEntry) return providerEntry;

        const providerNode = providerNodeById.get(providerId);
        return {
          providerId,
          provider: {
            id: providerId,
            name: providerNode?.name || providerId,
            color: providerNode?.color,
            apiType: providerNode?.apiType,
          },
          stats: {
            total: connections.filter((connection) => connection.provider === providerId).length,
          },
          displayAuthType: providerNode?.type ? "compatible" : "apikey",
          toggleAuthType: "apikey",
          presetCategory: providerNode?.type ? "compatible" : "apikey",
        } as DashboardProviderEntry;
      }
    )
  );
  const channelProviderEntryById = new Map(
    channelProviderEntries.map((entry) => [entry.providerId, entry])
  );
  const channelCategoryTabs = buildCategoryTabs(t);
  const channelCategoryCounts = channelCategoryTabs.reduce(
    (acc, tab) => {
      acc[tab.id] =
        tab.id === "all"
          ? connections.length
          : connections.filter(
              (connection) =>
                getChannelConnectionCategory(
                  connection,
                  channelProviderEntryById.get(connection.provider),
                  providerNodeById.get(connection.provider)
                ) === tab.id
            ).length;
      return acc;
    },
    {} as Record<ChannelCategory, number>
  );

  const configuredProviderEntries = dashboardProviderEntriesAll.filter(
    (entry) => Number(entry.stats?.total || 0) > 0
  );
  const visibleChannelConnections = connections.filter((connection) => {
    const providerEntry = channelProviderEntryById.get(connection.provider);
    const providerName = providerEntry
      ? getProviderDisplayName(providerEntry)
      : connection.provider;
    if (
      activeChannelCategory !== "all" &&
      getChannelConnectionCategory(
        connection,
        providerEntry,
        providerNodeById.get(connection.provider)
      ) !== activeChannelCategory
    ) {
      return false;
    }
    return matchesDashboardQuery(
      channelSearchQuery,
      connection.name,
      connection.displayName,
      connection.email,
      connection.defaultModel,
      connection.provider,
      providerName
    );
  });
  const activeConnectionCount = connections.filter(
    (connection) => connection.isActive !== false
  ).length;
  const errorConnectionCount = connections.filter((connection) =>
    ["error", "expired", "unavailable"].includes(String(connection.testStatus || ""))
  ).length;
  const modelMarketplaceItems: ModelMarketplaceItem[] = (() => {
    const itemsById = new Map<string, ModelMarketplaceItem>();
    for (const entry of channelProviderEntries) {
      for (const model of marketplaceModelsByProvider[entry.providerId] || []) {
        mergeModelMarketplaceItem(itemsById, entry, model);
      }
    }
    return Array.from(itemsById.values())
      .map((item) => ({
        ...item,
        providers: [...item.providers].sort((a, b) => a.providerName.localeCompare(b.providerName)),
      }))
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  })();
  const filteredModelMarketplaceItems = modelMarketplaceItems.filter(
    (item) =>
      (!showFreeOnly || item.hasFree) &&
      matchesDashboardQuery(
        modelSearchQuery,
        item.id,
        item.name,
        ...item.providers.flatMap((provider) => [provider.providerId, provider.providerName])
      )
  );
  const visibleModelMarketplaceItems = filteredModelMarketplaceItems.slice(0, 160);
  const hiddenModelMarketplaceCount = Math.max(
    filteredModelMarketplaceItems.length - visibleModelMarketplaceItems.length,
    0
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const showFirstProviderHint = shouldShowFirstProviderHint(connections.length, channelSearchQuery);

  return (
    <div className="flex flex-col gap-6">
      {showFirstProviderHint && (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center size-16 rounded-full bg-primary/10 mb-4">
              <span className="material-symbols-outlined text-[32px] text-primary">dns</span>
            </div>
            <h2 className="text-xl font-semibold text-text-main">
              {t("addFirstProvider") || "Add your first provider"}
            </h2>
            <p className="text-sm text-text-muted mt-2 max-w-md">
              {t("addFirstProviderDesc") ||
                "Connect an AI provider to start routing requests through OmniRoute. You can use free providers, API keys, or OAuth accounts."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button icon="add" onClick={() => router.push("/dashboard/providers/new")}>
                {providerText(t, "onboardingWizard", "Provider Onboarding Wizard")}
              </Button>
              <a
                href="https://docs.omniroute.io/providers"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-border text-text-muted hover:text-text-main hover:bg-bg-subtle transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">help</span>
                {t("learnMore") || "Learn more"}
              </a>
            </div>
          </div>
        </Card>
      )}

      <Card padding="sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="inline-flex w-fit rounded-lg border border-border bg-bg-subtle p-1"
            role="tablist"
            aria-label={providerText(t, "providerMarketplaceTabs", "Provider marketplace tabs")}
          >
            {[
              { id: "channels" as const, label: providerText(t, "channelMarketplace", "渠道广场") },
              { id: "models" as const, label: providerText(t, "modelMarketplace", "模型广场") },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeMarketplaceTab === tab.id}
                onClick={() => setActiveMarketplaceTab(tab.id)}
                className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                  activeMarketplaceTab === tab.id
                    ? "bg-surface text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon="add" onClick={() => setShowProviderPresetModal(true)}>
              {providerText(t, "addChannel", "新增渠道")}
            </Button>
            <Button icon="download" variant="secondary" onClick={() => setShowImportModal(true)}>
              {providerText(t, "importChannels", "导入渠道")}
            </Button>
            <Button
              icon="route"
              variant="secondary"
              onClick={() => router.push("/dashboard/providers/new")}
            >
              {providerText(t, "providerOnboarding", "配置向导")}
            </Button>
          </div>
        </div>
      </Card>

      {activeMarketplaceTab === "channels" ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card padding="sm">
              <p className="text-xs text-text-muted">{providerText(t, "channels", "渠道")}</p>
              <p className="mt-1 text-2xl font-semibold text-text-main">{connections.length}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-text-muted">{providerText(t, "enabled", "已启用")}</p>
              <p className="mt-1 text-2xl font-semibold text-text-main">{activeConnectionCount}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-text-muted">{providerText(t, "providers", "供应商")}</p>
              <p className="mt-1 text-2xl font-semibold text-text-main">
                {configuredProviderEntries.length}
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-text-muted">{providerText(t, "errors", "异常")}</p>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  errorConnectionCount > 0 ? "text-red-500" : "text-text-main"
                }`}
              >
                {errorConnectionCount}
              </p>
            </Card>
          </div>

          <Card padding="sm">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {channelCategoryTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveChannelCategory(tab.id)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                      activeChannelCategory === tab.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface text-text-muted hover:text-text-main"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                    <span>{tab.label}</span>
                    <span className="text-[10px] opacity-70">{channelCategoryCounts[tab.id]}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
                    search
                  </span>
                  <input
                    value={channelSearchQuery}
                    onChange={(event) => setChannelSearchQuery(event.target.value)}
                    placeholder={providerText(t, "searchChannels", "搜索已配置渠道")}
                    className="h-9 w-full rounded-control border border-border bg-bg px-9 text-sm text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-primary"
                  />
                  {channelSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setChannelSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:bg-bg-subtle hover:text-text-main"
                      aria-label={providerText(t, "clear", "清除")}
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>
                <Button
                  icon={testingMode === "all" ? "sync" : "play_arrow"}
                  variant="secondary"
                  loading={testingMode === "all"}
                  onClick={() => handleBatchTest("all")}
                  disabled={!!testingMode || connections.length === 0}
                >
                  {providerText(t, "testAll", "测试全部")}
                </Button>
              </div>
            </div>
          </Card>

          {visibleChannelConnections.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleChannelConnections.map((connection) => {
                const providerEntry = channelProviderEntryById.get(connection.provider);
                return (
                  <ChannelCard
                    key={connection.id}
                    connection={connection}
                    providerEntry={providerEntry}
                    models={marketplaceModelsByProvider[connection.provider] || []}
                    testing={testingMode === connection.id}
                    onTestStart={() => setTestingMode(connection.id)}
                    onTestEnd={() => setTestingMode(null)}
                    onConnectionUpdated={(patch) => updateConnectionInState(connection.id, patch)}
                    onConnectionDeleted={() => removeConnectionFromState(connection.id)}
                    onOpenProvider={() =>
                      router.push(`/dashboard/providers/${connection.provider}`)
                    }
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
              <span className="material-symbols-outlined text-[32px] text-text-muted">hub</span>
              <div>
                <h2 className="font-semibold text-text-main">
                  {providerText(t, "noConfiguredChannels", "暂无已配置渠道")}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {providerText(t, "chooseProviderPreset", "从供应商预设中新增一个渠道。")}
                </p>
              </div>
              <Button icon="add" onClick={() => setShowProviderPresetModal(true)}>
                {providerText(t, "addChannel", "新增渠道")}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <Card padding="sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
                  search
                </span>
                <input
                  value={modelSearchQuery}
                  onChange={(event) => setModelSearchQuery(event.target.value)}
                  placeholder={providerText(t, "searchModels", "搜索模型或供应商")}
                  className="h-9 w-full rounded-control border border-border bg-bg px-9 text-sm text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showFreeOnly ? "primary" : "secondary"}
                  icon="local_offer"
                  onClick={() => setShowFreeOnly((value) => !value)}
                >
                  {providerText(t, "freeOnly", "仅免费")}
                </Button>
                <span className="text-sm text-text-muted">
                  {loadingMarketplaceModels ? "..." : filteredModelMarketplaceItems.length}
                  {providerText(t, "modelsCountSuffix", " 个模型")}
                </span>
              </div>
            </div>
          </Card>

          {loadingMarketplaceModels ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : visibleModelMarketplaceItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleModelMarketplaceItems.map((item) => {
                const tags = getModelMarketplaceTags(item);

                return (
                  <button
                    key={item.id.toLowerCase()}
                    type="button"
                    onClick={() => setSelectedModelItem(item)}
                    className="flex min-h-[184px] flex-col rounded-lg border border-border bg-surface p-5 text-left transition-colors hover:border-primary/40 hover:bg-bg-subtle"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg text-sm font-medium text-text-main">
                        {getModelInitial(item)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-text-main">
                          {item.name || item.id}
                        </h3>
                        <p className="mt-1 truncate font-mono text-xs text-text-muted">{item.id}</p>
                      </div>
                      {(() => {
                        const ctx = formatContextLength(item.contextLength);
                        if (!ctx) return null;
                        return (
                          <span
                            className="shrink-0 rounded-full bg-bg-subtle px-2.5 py-1 text-xs font-medium text-text-main"
                            title={providerText(t, "contextWindowLabel", "{context} 上下文", {
                              context: ctx,
                            })}
                          >
                            {ctx}
                          </span>
                        );
                      })()}
                      <span className="shrink-0 rounded-full bg-bg-subtle px-2.5 py-1 text-xs font-medium text-text-main">
                        {providerText(t, "providerCount", "{count} 个提供商", {
                          count: item.providers.length,
                        })}
                      </span>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-8">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-xs text-text-main"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.hasFree && (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                          {providerText(t, "freeTierLabel", "免费")}
                        </span>
                      )}
                      {item.supportsReasoning && (
                        <span className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-xs text-text-main">
                          {providerText(t, "reasoning", "推理")}
                        </span>
                      )}
                      {item.supportsVision && (
                        <span className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-xs text-text-main">
                          {providerText(t, "vision", "视觉")}
                        </span>
                      )}
                      {item.toolCalling && (
                        <span className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-xs text-text-main">
                          {providerText(t, "tools", "工具")}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-xs font-medium text-text-main">
                        {providerText(t, "viewProviders", "查看提供商")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-sm text-text-muted">
              <span className="material-symbols-outlined text-[18px]">search_off</span>
              <span>{providerText(t, "noModelsMatch", "没有匹配的模型。")}</span>
            </div>
          )}

          {hiddenModelMarketplaceCount > 0 && (
            <p className="text-center text-xs text-text-muted">
              {providerText(
                t,
                "moreModelsHidden",
                "还有 {count} 个模型未显示，请继续搜索缩小范围。",
                {
                  count: hiddenModelMarketplaceCount,
                }
              )}
            </p>
          )}
        </>
      )}

      <Modal
        isOpen={showProviderPresetModal}
        onClose={() => setShowProviderPresetModal(false)}
        title={providerText(t, "providerPresetModalTitle", "新增渠道预设")}
        size="full"
        className="max-w-5xl"
        bodyClassName="p-0 overflow-hidden"
      >
        <ChannelPresetPicker
          entries={providerPresetEntriesAll}
          onCompatibleNodeCreated={(node) => setProviderNodes((prev) => [...prev, node])}
          onConfigureProvider={(providerId) => {
            setShowProviderPresetModal(false);
            router.push(`/dashboard/providers/${providerId}`);
          }}
          onConnectionCreated={(connection) => {
            setConnections((prev) => [...prev, connection]);
          }}
        />
      </Modal>

      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={providerText(t, "importChannelsTitle", "导入渠道")}
        size="lg"
      >
        <CcSwitchImportPanel
          onImported={(newConnections, newNodes) => {
            setConnections((prev) => [...prev, ...newConnections]);
            setProviderNodes((prev) => [...prev, ...newNodes]);
            setShowImportModal(false);
          }}
          onClose={() => setShowImportModal(false)}
        />
      </Modal>

      <Modal
        isOpen={selectedModelItem !== null}
        onClose={() => setSelectedModelItem(null)}
        title={selectedModelItem?.name || providerText(t, "viewProviders", "查看提供商")}
        size="md"
      >
        {selectedModelItem && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-bg-subtle p-3">
              <p className="truncate font-mono text-xs text-text-muted">{selectedModelItem.id}</p>
              <p className="mt-1 text-sm text-text-main">
                {providerText(t, "providersAvailable", "{count} 个提供商可用", {
                  count: selectedModelItem.providers.length,
                })}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {selectedModelItem.providers.map((provider) => (
                <button
                  key={provider.providerId}
                  type="button"
                  onClick={() => {
                    setSelectedModelItem(null);
                    router.push(`/dashboard/providers/${provider.providerId}`);
                  }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-primary/40 hover:bg-bg-subtle"
                >
                  <ProviderIcon
                    providerId={provider.provider.id || provider.providerId}
                    size={24}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-main">
                      {provider.providerName}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-text-muted">
                      {provider.providerId}
                    </span>
                  </span>
                  {provider.hasFree && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                      {providerText(t, "freeTierLabel", "免费")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Test Results Modal */}
      {testResults && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
          onClick={() => setTestResults(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-bg-primary border border-border rounded-xl w-full max-w-[600px] max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border bg-bg-primary/95 backdrop-blur-sm rounded-t-xl">
              <h3 className="font-semibold">{t("testResults")}</h3>
              <button
                onClick={() => setTestResults(null)}
                className="p-1 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors"
                aria-label={tc("close")}
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-5">
              <ProviderTestResultsView results={testResults} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Provider Test Results View (mirrors combo TestResultsView) ──────────────

type ChannelPresetPickerProps = {
  entries: DashboardProviderEntry[];
  onCompatibleNodeCreated: (node: CompatibleProviderNode) => void;
  onConnectionCreated: (connection: any) => void;
  onConfigureProvider: (providerId: string) => void;
};

function getAuthTypeLabel(t: ProviderMessageTranslator, authType: string): string {
  if (authType === "oauth") return providerText(t, "oauthLabel", "OAuth");
  if (authType === "free") return providerText(t, "freeTierLabel", "免费");
  if (authType === "no-auth") return providerText(t, "noAuthLabel", "免密");
  if (authType === "compatible") return providerText(t, "compatibleLabel", "兼容");
  if (authType === "web-cookie") return providerText(t, "webSessionLabel", "网页会话");
  return providerText(t, "apiKeyLabel", "API Key");
}

function getAuthTypeDescription(
  t: ProviderMessageTranslator,
  entry: DashboardProviderEntry
): string {
  const authType = getProviderCardAuthType(entry);
  if (authType === "oauth") {
    return providerText(t, "oauthProvidersDesc", "使用 OAuth 登录授权，OmniRoute 负责维护令牌。");
  }
  if (authType === "compatible") {
    return providerText(
      t,
      "compatibleProvidersDesc",
      "接入 OpenAI 或 Anthropic 兼容端点，适合自建网关和第三方中转。"
    );
  }
  if (authType === "no-auth") {
    return providerText(t, "noAuthProvidersDesc", "无需凭据即可使用的公开或本地能力。");
  }
  if (authType === "free") {
    return providerText(t, "freeAggregated", "包含免费额度或免费模型的服务商。");
  }
  return providerText(t, "apiKeyProvidersDesc", "使用 API Key 创建渠道，适合官方 API 或兼容接口。");
}

function ChannelCard({
  connection,
  providerEntry,
  models = [],
  testing,
  onTestStart,
  onTestEnd,
  onConnectionUpdated,
  onConnectionDeleted,
  onOpenProvider,
}: {
  connection: any;
  providerEntry?: DashboardProviderEntry;
  models: Array<{ id: string; name?: string }>;
  testing: boolean;
  onTestStart: () => void;
  onTestEnd: () => void;
  onConnectionUpdated: (patch: Record<string, unknown>) => void;
  onConnectionDeleted: () => void;
  onOpenProvider: () => void;
}) {
  const t = useTranslations("providers") as ProviderMessageTranslator;
  const notify = useNotificationStore();
  const emailsVisible = useEmailPrivacyStore((s) => s.emailsVisible);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const providerId = String(connection.provider || "");
  const provider = providerEntry?.provider || { id: providerId, name: providerId };
  const providerName = providerEntry ? getProviderDisplayName(providerEntry) : providerId;
  const authType =
    providerEntry?.displayAuthType === "compatible"
      ? "compatible"
      : String(connection.authType || providerEntry?.displayAuthType || "apikey");
  const channelName = pickDisplayValue(
    [connection.name, connection.displayName, connection.email],
    emailsVisible,
    providerName || providerText(t, "unnamedChannel", "未命名渠道")
  );
  const identity = pickDisplayValue([connection.displayName, connection.email], emailsVisible, "");
  const inactive = connection.isActive === false;
  const status = String(connection.testStatus || "").toLowerCase();
  const hasError = ["error", "expired", "unavailable", "banned", "credits_exhausted"].includes(
    status
  );
  const isHealthy = !inactive && (status === "active" || status === "success");
  const statusLabel = inactive
    ? providerText(t, "channelDisabled", "已停用")
    : isHealthy
      ? providerText(t, "channelHealthy", "正常")
      : hasError
        ? getConnectionErrorTag(connection) || providerText(t, "channelError", "异常")
        : providerText(t, "channelUntested", "未检测");
  const statusClass = inactive
    ? "bg-bg-subtle text-text-muted"
    : isHealthy
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : hasError
        ? "bg-red-500/10 text-red-500"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400";

  const handleToggle = async () => {
    if (toggleBusy) return;
    const nextActive = inactive;
    const previousActive = !inactive;
    setToggleBusy(true);
    onConnectionUpdated({ isActive: nextActive });
    try {
      const res = await fetch(`/api/providers/${connection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.message || providerText(t, "updateChannelFailed", "更新渠道失败");
        throw new Error(message);
      }
      notify.success(
        nextActive
          ? providerText(t, "channelEnabledToast", "渠道已启用")
          : providerText(t, "channelDisabledToast", "渠道已停用")
      );
    } catch (err) {
      onConnectionUpdated({ isActive: previousActive });
      notify.error(
        err instanceof Error ? err.message : providerText(t, "updateChannelFailed", "更新渠道失败")
      );
    } finally {
      setToggleBusy(false);
    }
  };

  const handleTest = async () => {
    if (testing) return;
    onTestStart();
    try {
      const res = await fetch(`/api/providers/${connection.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validationModelId: connection.defaultModel || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.message || providerText(t, "channelTestFailed", "渠道测试失败");
        throw new Error(message);
      }

      const valid = data?.valid === true;
      onConnectionUpdated({
        testStatus: valid ? "active" : "error",
        lastError: valid
          ? null
          : data?.error || providerText(t, "channelTestFailed", "渠道测试失败"),
        lastErrorAt: valid ? null : data?.testedAt || new Date().toISOString(),
        lastTested: data?.testedAt || new Date().toISOString(),
        latencyMs: typeof data?.latencyMs === "number" ? data.latencyMs : undefined,
        lastErrorType: valid ? null : data?.diagnosis?.type || null,
        lastErrorSource: valid ? null : data?.diagnosis?.source || null,
        errorCode: valid ? null : data?.diagnosis?.code || data?.statusCode || null,
      });
      if (valid) {
        notify.success(providerText(t, "channelTestPassed", "渠道测试通过"));
      } else {
        notify.error(data?.error || providerText(t, "channelTestFailed", "渠道测试失败"));
      }
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : providerText(t, "channelTestFailed", "渠道测试失败")
      );
    } finally {
      onTestEnd();
    }
  };

  const handleDelete = async () => {
    if (deleteBusy || testing) return;
    const confirmed = window.confirm(
      providerText(
        t,
        "deleteChannelConfirm",
        "确定删除渠道「{name}」吗？删除后该渠道凭据和已同步模型会被移除。",
        { name: channelName }
      )
    );
    if (!confirmed) return;

    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/providers/${connection.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.message || providerText(t, "deleteChannelFailed", "删除渠道失败");
        throw new Error(message);
      }
      onConnectionDeleted();
      notify.success(providerText(t, "channelDeletedToast", "渠道已删除"));
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : providerText(t, "deleteChannelFailed", "删除渠道失败")
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div
      className={`flex min-h-[168px] flex-col gap-4 rounded-lg border bg-surface p-4 transition-colors ${
        inactive ? "border-border opacity-75" : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${provider.color || "#64748b"}18` }}
        >
          <ProviderIcon providerId={provider.id || providerId} size={26} type="color" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-text-main">{channelName}</h3>
              <span className="shrink-0 rounded-full bg-bg-subtle px-2 py-0.5 text-[11px] font-medium text-text-muted">
                {getAuthTypeLabel(t, authType)}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${statusClass}`}>
                {statusLabel}
              </span>
              {typeof connection.latencyMs === "number" && connection.latencyMs >= 0 && (
                <span
                  className={`whitespace-nowrap text-xs tabular-nums ${
                    connection.latencyMs < 200
                      ? "text-emerald-500"
                      : connection.latencyMs < 500
                        ? "text-amber-500"
                        : connection.latencyMs < 1000
                          ? "text-orange-500"
                          : "text-red-500"
                  }`}
                >
                  {providerText(t, "latencySuffix", "{ms}ms", { ms: connection.latencyMs })}
                </span>
              )}
            </div>
          </div>
          <p className="mt-1 truncate text-xs text-text-muted">
            {providerName}
            {identity && identity !== channelName ? ` · ${identity}` : ""}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-wrap gap-1.5">
        {(models.length > 0 ? models : [{ id: connection.defaultModel || "-" }])
          .slice(0, 20)
          .map((model) => (
            <span
              key={model.id}
              className="inline-block truncate rounded-full bg-bg-subtle px-2.5 py-0.5 text-[11px] font-mono text-text-muted"
              title={model.name || model.id}
            >
              {model.id}
            </span>
          ))}
        {models.length > 20 && (
          <span className="inline-block rounded-full bg-bg-subtle px-2.5 py-0.5 text-[11px] text-text-muted">
            +{models.length - 20}
          </span>
        )}
      </div>

      {hasError && connection.lastError && (
        <p className="line-clamp-2 rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-500">
          {String(connection.lastError)}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button
          size="sm"
          icon="play_arrow"
          variant="secondary"
          loading={testing}
          disabled={inactive}
          onClick={handleTest}
        >
          {providerText(t, "test", "测试")}
        </Button>
        <Button size="sm" icon="open_in_new" variant="secondary" onClick={onOpenProvider}>
          {providerText(t, "details", "详情")}
        </Button>
        <Button
          size="sm"
          icon={inactive ? "toggle_on" : "toggle_off"}
          variant={inactive ? "secondary" : "ghost"}
          loading={toggleBusy}
          onClick={handleToggle}
        >
          {inactive ? providerText(t, "enable", "启用") : providerText(t, "disable", "停用")}
        </Button>
        <Button
          size="sm"
          icon="delete"
          variant="danger"
          loading={deleteBusy}
          disabled={testing}
          onClick={handleDelete}
        >
          {providerText(t, "delete", "删除")}
        </Button>
      </div>
    </div>
  );
}

function ChannelPresetPicker({
  entries,
  onCompatibleNodeCreated,
  onConnectionCreated,
  onConfigureProvider,
}: ChannelPresetPickerProps) {
  const t = useTranslations("providers") as ProviderMessageTranslator;
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ProviderPresetCategory | "all">("all");
  const [selectedProviderId, setSelectedProviderId] = useState("");

  const sortedEntries = [...entries].sort((a, b) =>
    getProviderDisplayName(a).localeCompare(getProviderDisplayName(b))
  );
  const categoryTabs = buildCategoryTabs(t);
  const categoryCounts = categoryTabs.reduce(
    (acc, tab) => {
      acc[tab.id] =
        tab.id === "all"
          ? sortedEntries.length
          : sortedEntries.filter((entry) => entry.presetCategory === tab.id).length;
      return acc;
    },
    {} as Record<ProviderPresetCategory | "all", number>
  );
  const categoryEntries = sortedEntries.filter(
    (entry) => activeCategory === "all" || entry.presetCategory === activeCategory
  );
  const visibleEntries = categoryEntries.filter((entry) =>
    matchesDashboardQuery(query, getProviderDisplayName(entry), entry.providerId)
  );
  const selectedEntry =
    visibleEntries.find((entry) => entry.providerId === selectedProviderId) ||
    visibleEntries[0] ||
    null;
  const selectedCompatibleMode = selectedEntry ? getCompatibleTemplateMode(selectedEntry) : null;
  const selectedModels =
    selectedEntry && !selectedCompatibleMode ? getModelsByProviderId(selectedEntry.providerId) : [];
  const modelPreview = selectedModels.slice(0, 10);
  const authType = selectedEntry ? getProviderCardAuthType(selectedEntry) : "apikey";
  const configuredCount = Number(selectedEntry?.stats?.total || 0);
  const handleCompatibleNodeCreated = (node: CompatibleProviderNode) => {
    onCompatibleNodeCreated(node);
    onConfigureProvider(node.id);
  };

  return (
    <div className="grid h-[min(680px,calc(100vh-190px))] min-h-[520px] grid-cols-1 md:grid-cols-[280px_1fr]">
      <aside className="flex min-h-0 flex-col border-b border-border bg-bg-subtle/60 md:border-b-0 md:border-r">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold text-text-main">
            {providerText(t, "serviceProviders", "服务商")}
          </h3>
          <div className="relative mt-3">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
              search
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={providerText(t, "searchProviders", "搜索服务商")}
              className="h-9 w-full rounded-control border border-border bg-surface px-9 text-sm text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-primary"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors ${
                  activeCategory === tab.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-text-muted hover:text-text-main"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-70">{categoryCounts[tab.id]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-2">
            {visibleEntries.map((entry) => {
              const isSelected = entry.providerId === selectedEntry?.providerId;
              const entryAuthType = getProviderCardAuthType(entry);
              const entryModelCount = getModelsByProviderId(entry.providerId).length;

              return (
                <button
                  key={entry.providerId}
                  type="button"
                  onClick={() => setSelectedProviderId(entry.providerId)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:border-primary/40"
                  }`}
                >
                  <span
                    className={`size-2.5 rounded-full ${
                      isSelected ? "bg-primary" : "bg-text-muted/30"
                    }`}
                  />
                  <ProviderIcon providerId={entry.provider.id || entry.providerId} size={22} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-main">
                      {getProviderDisplayName(entry)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-text-muted">
                      {getAuthTypeLabel(t, entryAuthType)}
                      {entryModelCount > 0
                        ? ` · ${providerText(t, "modelCount", "{count} 个模型", {
                            count: entryModelCount,
                          })}`
                        : ""}
                    </span>
                  </span>
                  {Number(entry.stats?.total || 0) > 0 && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      {entry.stats.total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {visibleEntries.length === 0 && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-text-muted">
              <span className="material-symbols-outlined text-[18px]">search_off</span>
              <span>{providerText(t, "noProvidersMatch", "没有匹配的服务商")}</span>
            </div>
          )}
        </div>
      </aside>

      <section className="min-h-0 overflow-y-auto p-5">
        {selectedEntry ? (
          selectedCompatibleMode ? (
            <CompatibleNodeInlinePanel
              mode={selectedCompatibleMode}
              onCreated={handleCompatibleNodeCreated}
            />
          ) : (
            <div className="flex min-h-full flex-col gap-5">
              <div className="flex items-start gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex size-12 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${selectedEntry.provider.color || "#64748b"}18` }}
                  >
                    <ProviderIcon
                      providerId={selectedEntry.provider.id || selectedEntry.providerId}
                      size={30}
                      type="color"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-text-main">
                      {getProviderDisplayName(selectedEntry)}
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      {getAuthTypeDescription(t, selectedEntry)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-bg-subtle p-3">
                  <p className="text-xs text-text-muted">
                    {providerText(t, "authMethod", "认证方式")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-main">
                    {getAuthTypeLabel(t, authType)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle p-3">
                  <p className="text-xs text-text-muted">
                    {providerText(t, "configured", "已配置")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-main">{configuredCount}</p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle p-3">
                  <p className="text-xs text-text-muted">
                    {providerText(t, "modelCountLabel", "模型数")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-main">
                    {selectedModels.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle p-3">
                  <p className="text-xs text-text-muted">{providerText(t, "freeTier", "免费层")}</p>
                  <p className="mt-1 text-sm font-semibold text-text-main">
                    {selectedEntry.provider.hasFree
                      ? providerText(t, "supported", "支持")
                      : providerText(t, "notMarked", "未标记")}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <ChannelConfigPanel
                  key={selectedEntry.providerId}
                  entry={selectedEntry}
                  authType={authType}
                  selectedModels={selectedModels}
                  onConfigureProvider={onConfigureProvider}
                  onConnectionCreated={onConnectionCreated}
                />

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-text-main">
                      {providerText(t, "supportedModels", "支持的模型")}
                    </h4>
                    {selectedModels.length > modelPreview.length && (
                      <span className="text-xs text-text-muted">
                        {providerText(t, "moreCount", "还有 {count} 个", {
                          count: selectedModels.length - modelPreview.length,
                        })}
                      </span>
                    )}
                  </div>
                  {modelPreview.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {modelPreview.map((model) => (
                        <span
                          key={model.id}
                          className="max-w-full truncate rounded-md border border-border bg-bg-subtle px-2 py-1 font-mono text-xs text-text-muted"
                          title={model.id}
                        >
                          {model.name || model.id}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-text-muted">
                      {providerText(
                        t,
                        "noBuiltinModelsHint",
                        "暂无内置模型列表，进入配置页后可同步或手动维护模型。"
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center p-5">
            <div className="text-sm text-text-muted">
              {providerText(t, "noProviderPresets", "暂无可用的服务商预设")}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

type CompatibleNodeFormState = {
  name: string;
  prefix: string;
  apiType: "chat" | "responses";
  baseUrl: string;
  chatPath: string;
  modelsPath: string;
  checkKey: string;
};

const COMPATIBLE_MODE_CONFIG: Record<
  CompatibleMode,
  {
    label: string;
    description: string;
    type: "openai-compatible" | "anthropic-compatible";
    defaultBaseUrl: string;
    defaultChatPath: string;
    hasApiType: boolean;
    hasModelsPath: boolean;
    prefixPlaceholder: string;
    baseUrlPlaceholder: string;
    chatPathPlaceholder: string;
  }
> = {
  openai: {
    label: "OpenAI 兼容",
    description: "适合 One API、New API、LiteLLM 等 OpenAI 风格接口。",
    type: "openai-compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultChatPath: "",
    hasApiType: true,
    hasModelsPath: true,
    prefixPlaceholder: "my-openai",
    baseUrlPlaceholder: "https://api.example.com/v1",
    chatPathPlaceholder: "/v1/chat/completions",
  },
  anthropic: {
    label: "Anthropic 兼容",
    description: "适合 Claude / Anthropic 消息接口兼容服务。",
    type: "anthropic-compatible",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultChatPath: "",
    hasApiType: false,
    hasModelsPath: true,
    prefixPlaceholder: "my-anthropic",
    baseUrlPlaceholder: "https://api.example.com",
    chatPathPlaceholder: "/messages",
  },
};

function createCompatibleNodeForm(mode: CompatibleMode): CompatibleNodeFormState {
  const config = COMPATIBLE_MODE_CONFIG[mode];
  return {
    name: "",
    prefix: "",
    apiType: "chat",
    baseUrl: config.defaultBaseUrl,
    chatPath: config.defaultChatPath,
    modelsPath: "",
    checkKey: "",
  };
}

function CompatibleNodeInlinePanel({
  mode,
  onCreated,
}: {
  mode: CompatibleMode;
  onCreated: (node: CompatibleProviderNode) => void;
}) {
  const t = useTranslations("providers") as ProviderMessageTranslator;
  const notify = useNotificationStore();
  const [form, setForm] = useState<CompatibleNodeFormState>(() => createCompatibleNodeForm(mode));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<"success" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const config = COMPATIBLE_MODE_CONFIG[mode];
  const configLabel = providerText(
    t,
    mode === "openai" ? "openAICompatible" : "anthropicCompatible",
    config.label
  );
  const configDescription = providerText(
    t,
    mode === "openai" ? "openAICompatibleDesc" : "anthropicCompatibleDesc",
    config.description
  );
  const hasRequiredFields = Boolean(form.name.trim() && form.prefix.trim() && form.baseUrl.trim());
  const canValidate = Boolean(form.checkKey.trim() && form.baseUrl.trim());

  useEffect(() => {
    setForm(createCompatibleNodeForm(mode));
    setShowAdvanced(false);
    setValidationResult(null);
    setError(null);
  }, [mode]);

  const updateForm = (field: keyof CompatibleNodeFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setValidationResult(null);
  };

  const buildNodeBody = () => {
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      prefix: form.prefix.trim(),
      baseUrl: form.baseUrl.trim(),
      type: config.type,
      chatPath: form.chatPath.trim(),
    };
    if (config.hasApiType) body.apiType = form.apiType;
    if (config.hasModelsPath) body.modelsPath = form.modelsPath.trim();
    return body;
  };

  const handleValidate = async () => {
    if (!canValidate || validating) return;
    setValidating(true);
    setError(null);
    setValidationResult(null);
    try {
      const body: Record<string, unknown> = {
        baseUrl: form.baseUrl.trim(),
        apiKey: form.checkKey.trim(),
        type: config.type,
      };
      if (config.hasModelsPath) body.modelsPath = form.modelsPath.trim();

      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.valid) {
        setValidationResult("failed");
        throw new Error(data?.error || providerText(t, "validationFailed", "校验失败"));
      }
      setValidationResult("success");
      notify.success(providerText(t, "compatibleEndpointValidationPassed", "兼容端点校验通过"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : providerText(t, "validationFailed", "校验失败");
      setError(message);
      notify.error(message);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!hasRequiredFields || saving) {
      if (!hasRequiredFields) {
        setError(providerText(t, "compatibleRequiredFields", "请填写名称、前缀和 Base URL"));
      }
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/provider-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildNodeBody()),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.node) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.message ||
              providerText(t, "createCompatibleEndpointFailed", "创建兼容端点失败");
        throw new Error(message);
      }

      onCreated(data.node);
      setForm(createCompatibleNodeForm(mode));
      setShowAdvanced(false);
      setValidationResult(null);
      notify.success(providerText(t, "compatibleProviderCreated", "兼容服务商已创建"));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : providerText(t, "createCompatibleEndpointFailed", "创建兼容端点失败");
      setError(message);
      notify.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full rounded-lg border border-dashed border-border bg-bg-subtle p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text-main">{configLabel}</h4>
          <p className="mt-1 text-sm text-text-muted">
            {providerText(
              t,
              "customCompatibleIntro",
              "如果服务商不在预设列表里，可以直接新增兼容端点。"
            )}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-text-muted">{configDescription}</p>

      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-muted">
              {providerText(t, "nameLabel", "名称")}
            </span>
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder={providerText(t, "customProviderNamePlaceholder", "例如：我的中转")}
              className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-muted">
              {providerText(t, "prefixLabel", "前缀")}
            </span>
            <input
              value={form.prefix}
              onChange={(event) => updateForm("prefix", event.target.value)}
              placeholder={config.prefixPlaceholder}
              className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
            />
          </label>
        </div>

        {config.hasApiType && (
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-muted">
              {providerText(t, "apiTypeLabel", "API 类型")}
            </span>
            <select
              value={form.apiType}
              onChange={(event) =>
                updateForm("apiType", event.target.value as CompatibleNodeFormState["apiType"])
              }
              className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
            >
              <option value="chat">Chat Completions</option>
              <option value="responses">Responses API</option>
            </select>
          </label>
        )}

        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-medium text-text-muted">Base URL</span>
          <input
            value={form.baseUrl}
            onChange={(event) => updateForm("baseUrl", event.target.value)}
            placeholder={config.baseUrlPlaceholder}
            className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
          />
        </label>

        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-main"
          onClick={() => setShowAdvanced((value) => !value)}
          aria-expanded={showAdvanced}
        >
          <span
            className={`material-symbols-outlined text-[16px] transition-transform ${
              showAdvanced ? "rotate-90" : ""
            }`}
          >
            chevron_right
          </span>
          {providerText(t, "advancedSettings", "高级设置")}
        </button>

        {showAdvanced && (
          <div className="grid gap-3 border-l-2 border-border pl-3">
            <label className="grid gap-1.5 text-sm">
              <span className="text-xs font-medium text-text-muted">Chat Path</span>
              <input
                value={form.chatPath}
                onChange={(event) => updateForm("chatPath", event.target.value)}
                placeholder={config.chatPathPlaceholder}
                className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
              />
            </label>

            {config.hasModelsPath && (
              <label className="grid gap-1.5 text-sm">
                <span className="text-xs font-medium text-text-muted">Models Path</span>
                <input
                  value={form.modelsPath}
                  onChange={(event) => updateForm("modelsPath", event.target.value)}
                  placeholder="/models"
                  className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
                />
              </label>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-muted">
              {providerText(t, "validationApiKeyLabel", "用于校验的 API Key")}
            </span>
            <input
              type="password"
              value={form.checkKey}
              onChange={(event) => updateForm("checkKey", event.target.value)}
              className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
            />
          </label>
          <div className="flex items-end">
            <Button
              icon="play_arrow"
              variant="secondary"
              loading={validating}
              disabled={!canValidate}
              onClick={handleValidate}
            >
              {providerText(t, "validate", "校验")}
            </Button>
          </div>
        </div>

        {validationResult && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              validationResult === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-red-500/20 bg-red-500/10 text-red-500"
            }`}
          >
            {validationResult === "success"
              ? providerText(t, "validationPassed", "校验通过")
              : providerText(t, "validationFailed", "校验失败")}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button icon="add" loading={saving} disabled={!hasRequiredFields} onClick={handleSubmit}>
            {providerText(t, "createCompatibleEndpoint", "创建兼容端点")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type ChannelConfigPanelProps = {
  entry: DashboardProviderEntry;
  authType: string;
  selectedModels: Array<{ id: string; name: string }>;
  onConfigureProvider: (providerId: string) => void;
  onConnectionCreated: (connection: any) => void;
};

function ChannelConfigPanel({
  entry,
  authType,
  selectedModels,
  onConfigureProvider,
  onConnectionCreated,
}: ChannelConfigPanelProps) {
  const t = useTranslations("providers") as ProviderMessageTranslator;
  const notify = useNotificationStore();
  const providerName = getProviderDisplayName(entry);
  const credentialOptional = providerAllowsOptionalApiKey(entry.providerId);
  const bulkSupported = supportsBulkApiKey(entry.providerId);
  const usesBaseUrl = isBaseUrlConfigurableProvider(entry.providerId);
  const defaultBaseUrl = getProviderBaseUrlDefault(entry.providerId);
  const canCreateWithCredential =
    authType === "apikey" || authType === "compatible" || authType === "web-cookie";
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [name, setName] = useState(providerName);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [priority, setPriority] = useState(1);
  const [defaultModel, setDefaultModel] = useState(selectedModels[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<"success" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const credentialLabel =
    authType === "web-cookie"
      ? providerText(t, "sessionCredential", "会话凭据")
      : providerText(t, "apiKeyLabel", "API Key");
  const parsedBulk = mode === "bulk" ? parseBulkApiKeys(apiKey) : { entries: [], warnings: [] };
  const canSubmit =
    mode === "bulk"
      ? parsedBulk.entries.length > 0
      : credentialOptional || apiKey.trim().length > 0;

  const buildProviderSpecificData = () => {
    if (!usesBaseUrl) return undefined;
    const checked = normalizeAndValidateHttpBaseUrl(baseUrl, defaultBaseUrl);
    if (checked.error) throw new Error(checked.error);
    return checked.value ? { baseUrl: checked.value } : undefined;
  };

  const handleValidate = async () => {
    if (mode === "bulk" || validating) return;
    if (!apiKey.trim() && !credentialOptional) {
      setError(
        providerText(t, "fillCredential", "请填写{credential}", { credential: credentialLabel })
      );
      return;
    }

    setValidating(true);
    setError(null);
    setValidationResult(null);
    try {
      const providerSpecificData = buildProviderSpecificData();
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: entry.providerId,
          apiKey: apiKey.trim() || undefined,
          validationModelId: defaultModel || undefined,
          baseUrl: providerSpecificData?.baseUrl || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.valid) {
        setValidationResult("failed");
        throw new Error(data?.error || providerText(t, "validationFailed", "验证失败"));
      }
      setValidationResult("success");
      notify.success(providerText(t, "credentialValidationPassed", "凭据验证通过"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : providerText(t, "validationFailed", "验证失败");
      setError(message);
      notify.error(message);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!canCreateWithCredential || saving) return;
    if (!canSubmit) {
      setError(
        providerText(t, "fillCredential", "请填写{credential}", { credential: credentialLabel })
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const providerSpecificData = buildProviderSpecificData();
      const createOne = async (connectionName: string, credential?: string) => {
        const res = await fetch("/api/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: entry.providerId,
            name: connectionName,
            apiKey: credential || undefined,
            priority: Number(priority) || 1,
            defaultModel: defaultModel || null,
            providerSpecificData,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            typeof data?.error === "string"
              ? data.error
              : data?.error?.message || providerText(t, "createChannelFailed", "创建渠道失败");
          throw new Error(message);
        }
        return data?.connection;
      };

      if (mode === "bulk") {
        const created = [];
        for (const item of parsedBulk.entries) {
          const connectionName = item.name.startsWith("Key ")
            ? `${providerName} ${item.name}`
            : item.name;
          const connection = await createOne(connectionName, item.apiKey);
          if (connection) created.push(connection);
        }
        created.forEach(onConnectionCreated);
        setApiKey("");
        notify.success(
          providerText(t, "channelsCreated", "已创建 {count} 个渠道", {
            count: created.length,
          })
        );
        return;
      }

      const connection = await createOne(name.trim() || providerName, apiKey.trim() || undefined);
      if (connection) {
        onConnectionCreated(connection);
      }
      setApiKey("");
      notify.success(providerText(t, "channelCreated", "渠道已创建"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : providerText(t, "createChannelFailed", "创建渠道失败");
      setError(message);
      notify.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!canCreateWithCredential) {
    const isNoAuth = authType === "no-auth";
    return (
      <div className="rounded-lg border border-border p-4">
        <h4 className="text-sm font-semibold text-text-main">
          {isNoAuth
            ? providerText(t, "noConfigRequired", "无需配置")
            : providerText(t, "authConfig", "授权配置")}
        </h4>
        <p className="mt-2 text-sm text-text-muted">
          {isNoAuth
            ? providerText(
                t,
                "noAuthConfigHint",
                "该服务商不需要创建凭据渠道，模型会直接出现在可用目录中。"
              )
            : providerText(
                t,
                "authConfigHint",
                "该服务商使用专属授权或导入流程，请从这里发起配置。"
              )}
        </p>
        {!isNoAuth && (
          <Button
            icon="open_in_new"
            className="mt-4"
            onClick={() => onConfigureProvider(entry.providerId)}
          >
            {providerText(t, "startAuthConfig", "发起授权配置")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-text-main">
          {providerText(t, "configureChannel", "配置渠道")}
        </h4>
        {bulkSupported && (
          <div className="inline-flex rounded-md border border-border bg-bg-subtle p-0.5">
            {[
              { id: "single" as const, label: providerText(t, "single", "单个") },
              { id: "bulk" as const, label: providerText(t, "bulk", "批量") },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode(item.id);
                  setValidationResult(null);
                  setError(null);
                }}
                className={`h-6 rounded px-2 text-xs font-medium transition-colors ${
                  mode === item.id
                    ? "bg-surface text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-3">
        {mode === "single" && (
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-muted">
              {providerText(t, "channelName", "渠道名称")}
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
            />
          </label>
        )}

        {usesBaseUrl && (
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-muted">Base URL</span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={getProviderBaseUrlPlaceholder(entry.providerId)}
              className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
            />
            {getProviderBaseUrlHint(entry.providerId, t) && (
              <span className="text-xs text-text-muted">
                {getProviderBaseUrlHint(entry.providerId, t)}
              </span>
            )}
          </label>
        )}

        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-medium text-text-muted">
            {credentialLabel}
            {credentialOptional ? providerText(t, "optionalSuffix", "（可选）") : ""}
          </span>
          <textarea
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              setValidationResult(null);
            }}
            placeholder={
              mode === "bulk"
                ? providerText(t, "bulkKeyPlaceholder", "每行一个 Key，或使用 name|key")
                : authType === "web-cookie"
                  ? providerText(t, "sessionCredentialPlaceholder", "粘贴会话凭据")
                  : "sk-..."
            }
            rows={mode === "bulk" ? 6 : 4}
            className="min-h-[96px] resize-y rounded-control border border-border bg-bg px-3 py-2 font-mono text-sm text-text-main outline-none focus:border-primary"
          />
          <span className="text-xs text-text-muted">
            {mode === "bulk"
              ? providerText(t, "bulkKeyHint", "支持 name|key 格式；空行和 # 开头的注释会被跳过。")
              : providerText(
                  t,
                  "singleChannelHint",
                  "每次创建一个渠道；专属字段和高级选项仍可在详情页继续维护。"
                )}
          </span>
        </label>

        {mode === "bulk" && (
          <div className="rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-muted">
            {providerText(t, "recognizedKeys", "已识别 {count} 个 Key", {
              count: parsedBulk.entries.length,
            })}
            {parsedBulk.warnings.length > 0 && (
              <div className="mt-1 text-amber-600 dark:text-amber-400">
                {parsedBulk.warnings.join("；")}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[110px_1fr]">
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-muted">
              {providerText(t, "priority", "优先级")}
            </span>
            <input
              type="number"
              min={1}
              max={100}
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
              className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-muted">
              {providerText(t, "defaultTestModel", "默认测试模型")}
            </span>
            <select
              value={defaultModel}
              onChange={(event) => setDefaultModel(event.target.value)}
              className="h-9 rounded-control border border-border bg-bg px-3 text-sm text-text-main outline-none focus:border-primary"
            >
              <option value="">{providerText(t, "notSpecified", "不指定")}</option>
              {selectedModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name || model.id}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        {validationResult && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              validationResult === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-red-500/20 bg-red-500/10 text-red-500"
            }`}
          >
            {validationResult === "success"
              ? providerText(t, "validationPassed", "验证通过")
              : providerText(t, "validationFailed", "验证失败")}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button icon="add" loading={saving} disabled={!canSubmit} onClick={handleSubmit}>
            {mode === "bulk"
              ? providerText(t, "bulkCreate", "批量创建")
              : providerText(t, "createChannel", "创建渠道")}
          </Button>
          {mode === "single" && (
            <Button
              icon="play_arrow"
              variant="secondary"
              loading={validating}
              disabled={!canSubmit}
              onClick={handleValidate}
            >
              {providerText(t, "validate", "验证")}
            </Button>
          )}
          <Button
            icon="open_in_new"
            variant="secondary"
            onClick={() => onConfigureProvider(entry.providerId)}
          >
            {providerText(t, "advancedConfig", "高级配置")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProviderTestResultsView({ results }: { results: ProviderBatchTestResults }) {
  const t = useTranslations("providers");
  const tc = useTranslations("common");
  const emailsVisible = useEmailPrivacyStore((s) => s.emailsVisible);

  // Guard: never crash on malformed/null results (would trigger error boundary)
  if (!results || typeof results !== "object") {
    return null;
  }

  if (results.error && (!results.results || results.results.length === 0)) {
    return (
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-red-500 text-[32px] mb-2 block">error</span>
        <p className="text-sm text-red-400">
          {typeof results.error === "object"
            ? results.error?.message || JSON.stringify(results.error)
            : String(results.error)}
        </p>
      </div>
    );
  }

  const summary = results.summary ?? null;
  const mode = results.mode ?? "";
  const items = Array.isArray(results.results) ? results.results : [];

  const modeLabel =
    {
      oauth: t("oauthLabel"),
      free: tc("free"),
      apikey: t("apiKeyLabel"),
      compatible: t("compatibleLabel"),
      provider: t("providerLabel"),
      all: tc("all"),
    }[mode] || mode;

  return (
    <div className="flex flex-col gap-3">
      {/* Summary header */}
      {summary && (
        <div className="flex items-center gap-3 text-xs mb-1">
          <span className="text-text-muted">{t("modeTest", { mode: modeLabel })}</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
            {t("passedCount", { count: summary.passed })}
          </span>
          {summary.failed > 0 && (
            <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">
              {t("failedCount", { count: summary.failed })}
            </span>
          )}
          <span className="text-text-muted ml-auto">
            {t("testedCount", { count: summary.total })}
          </span>
        </div>
      )}

      {/* Individual results */}
      {items.map((r, i) => (
        <div
          key={r.connectionId || i}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.03]"
        >
          <span
            className={`material-symbols-outlined text-[16px] ${
              r.valid ? "text-emerald-500" : "text-red-500"
            }`}
          >
            {r.valid ? "check_circle" : "error"}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-medium">
              {pickDisplayValue([r.connectionName], emailsVisible, r.connectionName)}
            </span>
            <span className="text-text-muted ml-1.5">({r.provider})</span>
          </div>
          {r.latencyMs !== undefined && (
            <span className="text-text-muted font-mono tabular-nums">
              {t("millisecondsAbbr", { value: r.latencyMs })}
            </span>
          )}
          <span
            className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
              r.valid ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            }`}
          >
            {r.valid ? t("okShort") : r.diagnosis?.type || t("errorShort")}
          </span>
        </div>
      ))}

      {items.length === 0 && (
        <div className="text-center py-4 text-text-muted text-sm">
          {t("noActiveConnectionsInGroup")}
        </div>
      )}
    </div>
  );
}
