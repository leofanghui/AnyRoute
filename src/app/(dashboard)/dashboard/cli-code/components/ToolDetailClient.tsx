"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CLI_TOOLS } from "@/shared/constants/cliTools";
import { PROVIDER_ID_TO_ALIAS, getModelsByProviderId } from "@/shared/constants/models";
import type { ModelPoolClient } from "@/shared/utils/modelPool";
import {
  AntigravityToolCard,
  ClaudeDesktopToolCard,
  ClaudeToolCard,
  CodexDesktopToolCard,
  ClineToolCard,
  CodexToolCard,
  CopilotToolCard,
  CustomCliCard,
  DefaultToolCard,
  DroidToolCard,
  HermesAgentToolCard,
  KiloToolCard,
  OpenClawToolCard,
} from "./index";

export interface ToolDetailClientProps {
  toolId: string;
  category: "code" | "agent";
}

const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL;
const MODEL_POOL_TOOL_IDS = new Set(["claude", "claude-desktop", "codex", "codex-desktop"]);

function maskApiKey(key: string) {
  if (!key) return "";
  if (key.length <= 12) return `${key.slice(0, 4)}****`;
  return `${key.slice(0, 8)}****${key.slice(-4)}`;
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

export default function ToolDetailClient({ toolId, category }: ToolDetailClientProps) {
  const tCommon = useTranslations("cliCommon");
  const tool = CLI_TOOLS[toolId];

  const [connections, setConnections] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<any[]>([]);
  const [modelPoolModels, setModelPoolModels] = useState<any[]>([]);
  const [modelPoolLoaded, setModelPoolLoaded] = useState(false);
  const [providerNodes, setProviderNodes] = useState<any[]>([]);
  const [modelMappings, setModelMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.log("Error fetching connections:", error);
    }
  }, []);

  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/cli-tools/keys");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.keys) && data.keys.length > 0) {
          setApiKeys(data.keys);
          return;
        }
      }

      if (category !== "code") {
        setApiKeys([]);
        return;
      }

      const createRes = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Cli-code 自动接入" }),
      });
      if (!createRes.ok) {
        setApiKeys([]);
        return;
      }

      const created = await createRes.json();
      if (created?.id && created?.key) {
        setApiKeys([
          {
            ...created,
            rawKey: created.key,
            key: maskApiKey(created.key),
          },
        ]);
      }
    } catch (error) {
      console.log("Error fetching API keys:", error);
    }
  }, [category]);

  const fetchCloudSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setCloudEnabled(data.cloudEnabled || false);
      }
    } catch (error) {
      console.log("Error loading cloud settings:", error);
    }
  }, []);

  const fetchDynamicModels = useCallback(async () => {
    try {
      const res = await fetch("/v1/models");
      if (res.ok) {
        const data = await res.json();
        setDynamicModels(data?.data || []);
      }
    } catch (error) {
      console.log("Error fetching dynamic models:", error);
    }
  }, []);

  const fetchProviderNodes = useCallback(async () => {
    try {
      const res = await fetch("/api/provider-nodes");
      if (res.ok) {
        const data = await res.json();
        setProviderNodes(data.nodes || []);
      }
    } catch (error) {
      console.log("Error fetching provider nodes:", error);
    }
  }, []);

  const fetchModelPool = useCallback(async () => {
    if (!MODEL_POOL_TOOL_IDS.has(toolId)) {
      setModelPoolLoaded(true);
      return;
    }

    const client = toolId === "claude" || toolId === "claude-desktop" ? "claude" : "codex";
    try {
      const res = await fetch(`/api/model-pool?client=${client}`);
      if (res.ok) {
        const data = await res.json();
        setModelPoolModels(Array.isArray(data.models) ? data.models : []);
      }
    } catch (error) {
      console.log("Error fetching model pool:", error);
    } finally {
      setModelPoolLoaded(true);
    }
  }, [toolId]);

  useEffect(() => {
    let cancelled = false;
    // "Load data on mount" pattern: fetch* callbacks call setState internally
    // after async resolution. The cancelled flag prevents setState after unmount.
    // The react-hooks/set-state-in-effect rule flags this pattern conservatively
    // (it cannot distinguish sync vs async setState), but this is the canonical
    // way to load remote data on mount until we migrate to use()/Suspense.
    Promise.all([
      fetchConnections(),
      fetchApiKeys(),
      fetchCloudSettings(),
      fetchDynamicModels(),
      fetchProviderNodes(),
      fetchModelPool(),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    fetchConnections,
    fetchApiKeys,
    fetchCloudSettings,
    fetchDynamicModels,
    fetchProviderNodes,
    fetchModelPool,
  ]);

  const getActiveProviders = useCallback(() => {
    return connections.filter((c) => c.isActive !== false);
  }, [connections]);

  const getAllAvailableModels = useCallback(() => {
    const activeProviders = getActiveProviders();
    const models: any[] = [];
    const seenModels = new Set<string>();
    const providerNodeById = new Map(providerNodes.map((node) => [node.id, node]));

    activeProviders.forEach((conn) => {
      const providerNode = providerNodeById.get(conn.provider);
      const alias = getConnectionPrefix(conn, providerNode);
      const providerModels = getModelsByProviderId(conn.provider);
      providerModels.forEach((m: any) => {
        const modelValue = `${alias}/${m.id}`;
        if (!seenModels.has(modelValue)) {
          seenModels.add(modelValue);
          models.push({
            value: modelValue,
            label: `${alias}/${m.id}`,
            provider: conn.provider,
            alias,
            connectionId: conn.id,
            connectionName: conn.name,
            modelId: m.id,
          });
        }
      });
    });

    const activeAliases = new Set(
      activeProviders.map((c) => {
        const providerNode = providerNodeById.get(c.provider);
        return getConnectionPrefix(c, providerNode);
      })
    );
    const activeProviderIds = new Set(activeProviders.map((c) => c.provider));
    dynamicModels.forEach((dm) => {
      const rawId = dm?.id ?? dm;
      const modelId = typeof rawId === "string" ? rawId : "";
      if (!modelId || seenModels.has(modelId)) return;
      const slashIdx = modelId.indexOf("/");
      if (slashIdx === -1) return;
      const alias = modelId.substring(0, slashIdx);
      const bareModel = modelId.substring(slashIdx + 1);
      const ownedBy = typeof dm?.owned_by === "string" ? dm.owned_by : "";
      const matchedConnection = activeProviders.find(
        (conn) =>
          conn.provider === ownedBy ||
          conn.provider === alias ||
          getConnectionPrefix(conn, providerNodeById.get(conn.provider)) === alias
      );
      if (!matchedConnection && !activeAliases.has(alias) && !activeProviderIds.has(alias)) return;
      seenModels.add(modelId);
      models.push({
        value: modelId,
        label: modelId,
        provider: matchedConnection?.provider || alias,
        alias,
        connectionId: matchedConnection?.id,
        connectionName: matchedConnection?.name || "",
        modelId: bareModel,
        source: "imported",
      });
    });

    return models;
  }, [getActiveProviders, dynamicModels, providerNodes]);

  const handleModelMappingChange = useCallback((alias: string, targetModel: string) => {
    setModelMappings((prev) => {
      if (prev[alias] === targetModel) return prev;
      return { ...prev, [alias]: targetModel };
    });
  }, []);

  const getBaseUrl = useCallback(() => {
    if (cloudEnabled && CLOUD_URL) return CLOUD_URL;
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  }, [cloudEnabled]);

  if (!tool) return null;

  const activeProviders = getActiveProviders();
  const rawAvailableModels = getAllAvailableModels();
  const modelPoolClient: ModelPoolClient =
    toolId === "claude" || toolId === "claude-desktop"
      ? "claude"
      : toolId === "codex" || toolId === "codex-desktop"
        ? "codex"
        : "all";
  const availableModels = MODEL_POOL_TOOL_IDS.has(toolId)
    ? modelPoolLoaded
      ? modelPoolModels
      : []
    : rawAvailableModels;
  const hasActiveProviders = availableModels.length > 0;

  const backCategory = category === "code" ? "/dashboard/cli-code" : "/dashboard/cli-agents";
  const categoryLabel =
    category === "code" ? tCommon("concept.code.title") : tCommon("concept.agent.title");

  // Common props passed to every specialized card.
  // isExpanded is always true in the detail page (D23).
  const cardProps: any = {
    tool,
    isExpanded: true,
    onToggle: () => {},
    baseUrl: getBaseUrl(),
    apiKeys,
    batchStatus: null,
    lastConfiguredAt: null,
    activeProviders,
    hasActiveProviders,
    cloudEnabled,
    availableModels,
  };

  const renderCard = () => {
    switch (toolId) {
      case "claude":
        return (
          <ClaudeToolCard
            {...cardProps}
            modelMappings={modelMappings}
            onModelMappingChange={handleModelMappingChange}
          />
        );
      case "claude-desktop":
        return <ClaudeDesktopToolCard {...cardProps} />;
      case "codex":
        return <CodexToolCard {...cardProps} />;
      case "codex-desktop":
        return <CodexDesktopToolCard {...cardProps} />;
      case "droid":
        return <DroidToolCard {...cardProps} />;
      case "openclaw":
        return <OpenClawToolCard {...cardProps} />;
      case "cline":
        return <ClineToolCard {...cardProps} />;
      case "kilo":
        return <KiloToolCard {...cardProps} />;
      case "copilot":
        return <CopilotToolCard {...cardProps} />;
      case "hermes-agent":
        return <HermesAgentToolCard {...cardProps} />;
      case "antigravity":
        return <AntigravityToolCard {...cardProps} />;
      case "custom":
        return <CustomCliCard {...cardProps} />;
      default:
        if (tool.configType === "mitm") {
          return <AntigravityToolCard {...cardProps} />;
        }
        return <DefaultToolCard toolId={toolId} {...cardProps} />;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Back navigation */}
      <div className="flex items-center gap-2">
        <Link
          href={backCategory}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {categoryLabel}
        </Link>
        <span className="text-text-muted">/</span>
        <span className="text-sm font-medium">{tool.name}</span>
      </div>

      {/* Tool header */}
      <div className="flex items-center gap-3 flex-wrap">
        {tool.vendor && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-surface border border-border text-text-muted">
            {tool.vendor}
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
          {categoryLabel}
        </span>
        {tool.baseUrlSupport && tool.baseUrlSupport !== "none" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400">
            <span className="material-symbols-outlined text-[12px]">link</span>
            {tool.baseUrlSupport === "full"
              ? tCommon("card.baseUrlFull")
              : tCommon("card.baseUrlPartial")}
          </span>
        )}
      </div>

      {/* Specialized card — always expanded */}
      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="h-24 rounded-xl bg-surface animate-pulse" />
        </div>
      ) : (
        renderCard()
      )}
    </div>
  );
}
