"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Card, ManualConfigModal, ModelSelectModal } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";

import CliStatusBadge from "./CliStatusBadge";

const MODEL_ROWS = [
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-8", name: "Claude Opus 4.8" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
];

type Mapping = {
  id: string;
  name: string;
  targetModel: string;
  supports1m?: boolean;
};

export default function ClaudeDesktopToolCard({
  tool,
  isExpanded = false,
  onToggle = () => {},
  activeProviders,
  availableModels,
  hasActiveProviders,
  apiKeys,
  baseUrl,
  batchStatus,
  lastConfiguredAt,
}) {
  const [status, setStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<any>(null);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [showManualConfig, setShowManualConfig] = useState(false);

  const gatewayBaseUrl = useMemo(
    () => `${String(baseUrl || "").replace(/\/+$/, "")}/api/claude-desktop`,
    [baseUrl]
  );

  useEffect(() => {
    if (apiKeys?.length > 0 && !selectedApiKey) {
      setSelectedApiKey(apiKeys[0].id);
    }
  }, [apiKeys, selectedApiKey]);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/cli-tools/claude-desktop-settings");
      const data = await res.json();
      setStatus(data);
      const nextMappings: Record<string, string> = {};
      for (const mapping of data.mappings || []) {
        nextMappings[mapping.id] = mapping.targetModel;
      }
      if (Object.keys(nextMappings).length > 0) {
        setMappings(nextMappings);
      } else {
        for (const model of tool.defaultModels || []) {
          nextMappings[model.id] = model.defaultValue || "";
        }
        setMappings(nextMappings);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "读取 Claude Desktop 状态失败" });
    } finally {
      setLoadingStatus(false);
    }
  }, [tool.defaultModels]);

  useEffect(() => {
    if (isExpanded && !status && !loadingStatus) {
      void fetchStatus();
    }
  }, [fetchStatus, isExpanded, status, loadingStatus]);

  const getMappingPayload = (): Mapping[] =>
    MODEL_ROWS.map((row) => ({
      id: row.id,
      name: row.name,
      targetModel:
        mappings[row.id] ||
        tool.defaultModels?.find((model) => model.id === row.id)?.defaultValue ||
        row.id,
      supports1m: true,
    }));

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/claude-desktop-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId: selectedApiKey || null,
          gatewayBaseUrl,
          mappings: getMappingPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "写入 Claude Desktop 配置失败"
        );
      }
      setStatus(data);
      setMessage({
        type: "success",
        text: "已写入 Claude Desktop 3P Gateway 配置，重启 Claude Desktop 后生效。",
      });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "写入 Claude Desktop 配置失败" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/claude-desktop-settings", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "重置 Claude Desktop 配置失败"
        );
      }
      setStatus(data);
      setMessage({ type: "success", text: "已移除 AnyRoute Claude Desktop profile。" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "重置 Claude Desktop 配置失败" });
    } finally {
      setResetting(false);
    }
  };

  const handleModelSelect = (model: any) => {
    if (!editingModel) return;
    setMappings((prev) => ({ ...prev, [editingModel]: model.value }));
  };

  const manualConfigs = [
    {
      filename:
        status?.profilePath || "Claude-3p/configLibrary/00000000-0000-4000-8000-000000201280.json",
      content: JSON.stringify(
        {
          coworkEgressAllowedHosts: ["*"],
          disableDeploymentModeChooser: true,
          inferenceGatewayApiKey: "<API_KEY_FROM_DASHBOARD>",
          inferenceGatewayAuthScheme: "bearer",
          inferenceGatewayBaseUrl: gatewayBaseUrl,
          inferenceProvider: "gateway",
          inferenceModels: getMappingPayload().map((mapping) => ({
            name: mapping.id,
            labelOverride: mapping.targetModel,
            supports1m: true,
          })),
        },
        null,
        2
      ),
    },
  ];

  const effectiveConfigStatus = status
    ? status.configured
      ? "configured"
      : status.supported
        ? "not_configured"
        : "not_installed"
    : batchStatus?.configStatus || null;

  return (
    <Card padding="sm" className="overflow-hidden">
      <div className="flex items-center justify-between hover:cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="size-8 flex items-center justify-center shrink-0">
            <ProviderIcon providerId="claude" size={32} type="color" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{tool.name}</h3>
              <CliStatusBadge
                effectiveConfigStatus={effectiveConfigStatus}
                batchStatus={batchStatus}
                lastConfiguredAt={lastConfiguredAt}
              />
            </div>
            <p className="text-xs text-text-muted truncate">
              Claude Desktop 通过 3P Gateway 路由到 OmniRoute
            </p>
          </div>
        </div>
        <span
          className={`material-symbols-outlined text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span className="material-symbols-outlined animate-spin text-[18px]">
                progress_activity
              </span>
              正在读取 Claude Desktop 配置
            </div>
          ) : null}

          {status && !status.supported ? (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm">
              <span className="material-symbols-outlined text-yellow-500 text-[18px]">warning</span>
              <div>
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  当前平台暂不支持自动写入
                </p>
                <p className="text-text-muted">{status.reason}</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">
                Gateway
              </span>
              <span className="material-symbols-outlined text-text-muted text-[14px]">
                arrow_forward
              </span>
              <input
                type="text"
                value={gatewayBaseUrl}
                readOnly
                className="flex-1 px-2 py-1.5 bg-surface rounded border border-border text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">
                API Key
              </span>
              <span className="material-symbols-outlined text-text-muted text-[14px]">
                arrow_forward
              </span>
              {apiKeys.length > 0 ? (
                <select
                  value={selectedApiKey}
                  onChange={(event) => setSelectedApiKey(event.target.value)}
                  className="flex-1 px-2 py-1.5 bg-surface rounded text-xs border border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {apiKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.key}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="flex-1 text-xs text-text-muted px-2 py-1.5">
                  没有可用 API Key，保存时会自动创建。
                </span>
              )}
            </div>

            {MODEL_ROWS.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">
                  {row.name}
                </span>
                <span className="material-symbols-outlined text-text-muted text-[14px]">
                  arrow_forward
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingModel(row.id)}
                  disabled={!hasActiveProviders}
                >
                  选择模型
                </Button>
                <input
                  type="text"
                  value={mappings[row.id] || ""}
                  onChange={(event) =>
                    setMappings((prev) => ({ ...prev, [row.id]: event.target.value }))
                  }
                  placeholder="provider/model"
                  className="flex-1 px-2 py-1.5 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            ))}
          </div>

          {status?.profilePath ? (
            <div className="text-xs text-text-muted">
              配置文件：<span className="font-mono">{status.profilePath}</span>
            </div>
          ) : null}

          {message ? (
            <div
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {message.type === "success" ? "check_circle" : "error"}
              </span>
              <span>{message.text}</span>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={status?.supported === false}
              loading={saving}
            >
              <span className="material-symbols-outlined text-[14px] mr-1">save</span>
              写入 Claude Desktop
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!status?.configured}
              loading={resetting}
            >
              <span className="material-symbols-outlined text-[14px] mr-1">restore</span>
              重置
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowManualConfig(true)}>
              <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>
              手动配置
            </Button>
          </div>
        </div>
      )}

      <ModelSelectModal
        isOpen={!!editingModel}
        onClose={() => setEditingModel(null)}
        onSelect={handleModelSelect}
        selectedModel={editingModel ? mappings[editingModel] : ""}
        activeProviders={activeProviders}
        availableModels={availableModels}
        title="选择要路由到的 OmniRoute 模型"
      />

      <ManualConfigModal
        isOpen={showManualConfig}
        onClose={() => setShowManualConfig(false)}
        title="Claude Desktop 手动配置"
        configs={manualConfigs}
      />
    </Card>
  );
}
