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
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<any>(null);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);

  const gatewayBaseUrl = useMemo(
    () => `${String(baseUrl || "").replace(/\/+$/, "")}/api/claude-desktop`,
    [baseUrl]
  );

  const getModelDisplayLabel = useCallback(
    (value: string) => {
      if (!value) return "";
      const model = (availableModels || []).find((item: any) => item?.value === value);
      return model?.label || model?.name || value;
    },
    [availableModels]
  );

  const getModelConnectionId = useCallback(
    (value: string) => {
      if (!value) return "";
      const model = (availableModels || []).find((item: any) => item?.value === value);
      return typeof model?.connectionId === "string" ? model.connectionId : "";
    },
    [availableModels]
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
        setSelectedModel(
          nextMappings["claude-sonnet-4-6"] || Object.values(nextMappings).find(Boolean) || ""
        );
      } else {
        for (const model of tool.defaultModels || []) {
          nextMappings[model.id] = model.defaultValue || "";
        }
        setMappings(nextMappings);
        setSelectedModel(Object.values(nextMappings).find(Boolean) || "");
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
        selectedModel ||
        tool.defaultModels?.find((model) => model.id === row.id)?.defaultValue ||
        row.id,
      supports1m: true,
    }));

  const getVerificationModels = () => [
    ...new Set(
      getMappingPayload()
        .map((mapping) => mapping.targetModel)
        .filter(Boolean)
    ),
  ];

  const verifyCurrentConfig = async () => {
    const models = getVerificationModels();
    if (models.length === 0) return null;

    setVerifying(true);
    try {
      const modelConnections = Object.fromEntries(
        models
          .map((model) => [model, getModelConnectionId(model)])
          .filter(([, connectionId]) => Boolean(connectionId))
      );
      const res = await fetch("/api/cli-tools/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "claude-desktop",
          models,
          ...(Object.keys(modelConnections).length > 0 ? { modelConnections } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      const results = Array.isArray(data?.results) ? data.results : [data].filter(Boolean);

      const failed = results.filter((result) => result?.status === "error" || result?.ok === false);
      if (failed.length > 0) {
        return {
          ok: false,
          error: failed
            .map(
              (result) =>
                `${result.model}: ${
                  result?.diagnosis?.message ||
                  result?.probes?.claude?.error ||
                  result.error ||
                  "验证失败"
                }`
            )
            .join("；"),
        };
      }

      if (!res.ok || (data?.status !== "ok" && data?.status !== "partial")) {
        return {
          ok: false,
          error: data?.diagnosis?.message || data?.error || "Claude Desktop Gateway 链路验证失败",
        };
      }

      const partial = results.find((result) => result?.status === "partial" || result?.partial);
      if (partial) {
        return {
          ok: true,
          partial: true,
          error: `${partial.model}: ${
            partial?.diagnosis?.message ||
            partial?.probes?.claude_stream?.error ||
            partial?.probes?.claude_tools?.error ||
            partial.error ||
            "部分能力未通过验证。"
          }`,
        };
      }

      return { ok: true, partial: false, error: "" };
    } finally {
      setVerifying(false);
    }
  };

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
      await fetchBackups();
      const verification = await verifyCurrentConfig();
      if (verification?.ok && verification.partial) {
        setMessage({
          type: "success",
          text: `已写入 Claude Desktop 配置，基础链路可用；部分能力需注意：${verification.error}。重启后生效。`,
        });
      } else if (verification?.ok) {
        setMessage({
          type: "success",
          text: "已写入 Claude Desktop 配置，Gateway 链路验证通过，重启后生效。",
        });
      } else if (verification) {
        setMessage({
          type: "error",
          text: `配置已写入，但 Gateway 链路验证失败：${verification.error}`,
        });
      } else {
        setMessage({
          type: "success",
          text: "已写入 Claude Desktop 3P Gateway 配置，重启 Claude Desktop 后生效。",
        });
      }
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
      await fetchBackups();
      setMessage({ type: "success", text: "已移除 AnyRoute Claude Desktop profile。" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "重置 Claude Desktop 配置失败" });
    } finally {
      setResetting(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch("/api/cli-tools/backups?tool=claude-desktop");
      const data = await res.json();
      if (res.ok) setBackups(data.backups || []);
    } catch (error) {
      console.log("Error fetching Claude Desktop backups:", error);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    setRestoringBackup(backupId);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "claude-desktop", backupId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "恢复备份失败");
      }
      setMessage({ type: "success", text: "已恢复 Claude Desktop 备份。" });
      await fetchStatus();
      await fetchBackups();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "恢复备份失败" });
    } finally {
      setRestoringBackup(null);
    }
  };

  const handleModelSelect = (model: any) => {
    if (!editingModel) return;
    if (editingModel === "default") {
      setSelectedModel(model.value);
      return;
    }
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
                目标模型
              </span>
              <span className="material-symbols-outlined text-text-muted text-[14px]">
                arrow_forward
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingModel("default")}
                disabled={!hasActiveProviders}
              >
                选择模型
              </Button>
              <span
                className="flex-1 px-2 py-1.5 bg-surface rounded border border-border text-xs text-text-main truncate"
                title={getModelDisplayLabel(selectedModel)}
              >
                {getModelDisplayLabel(selectedModel) || "选择模型"}
              </span>
            </div>

            <button
              type="button"
              className="ml-[8.5rem] flex items-center gap-1 text-xs text-text-muted hover:text-text-main"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              aria-expanded={showAdvancedSettings}
            >
              <span
                className={`material-symbols-outlined text-[14px] transition-transform ${showAdvancedSettings ? "rotate-90" : ""}`}
              >
                chevron_right
              </span>
              高级设置
            </button>

            {showAdvancedSettings ? (
              <>
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

                <div className="ml-[8.5rem] flex">
                  <Button variant="ghost" size="sm" onClick={() => setShowManualConfig(true)}>
                    <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>
                    手动配置
                  </Button>
                </div>
              </>
            ) : null}
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
              disabled={status?.supported === false || !selectedModel}
              loading={saving || verifying}
            >
              <span className="material-symbols-outlined text-[14px] mr-1">save</span>
              {verifying ? "验证中" : "写入 Claude Desktop"}
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
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowBackups(!showBackups);
                if (!showBackups) void fetchBackups();
              }}
            >
              <span className="material-symbols-outlined text-[14px] mr-1">history</span>
              备份
              {backups.length > 0 && ` (${backups.length})`}
            </Button>
          </div>

          {showBackups ? (
            <div className="mt-2 p-3 bg-surface border border-border rounded-lg">
              <h4 className="text-xs font-semibold text-text-main mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">history</span>
                配置备份
              </h4>
              {backups.length === 0 ? (
                <p className="text-xs text-text-muted">暂无备份</p>
              ) : (
                <div className="space-y-1.5">
                  {backups.map((backup) => (
                    <div
                      key={backup.id}
                      className="flex items-center gap-2 px-2 py-1.5 bg-black/5 dark:bg-white/5 rounded text-xs"
                    >
                      <span className="material-symbols-outlined text-[14px] text-text-muted">
                        description
                      </span>
                      <span className="flex-1 truncate font-mono" title={backup.id}>
                        {backup.id}
                      </span>
                      <span className="text-text-muted whitespace-nowrap">
                        {new Date(backup.createdAt).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleRestoreBackup(backup.id)}
                        disabled={restoringBackup === backup.id}
                        className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        {restoringBackup === backup.id ? "..." : "恢复"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      <ModelSelectModal
        isOpen={!!editingModel}
        onClose={() => setEditingModel(null)}
        onSelect={handleModelSelect}
        selectedModel={
          editingModel === "default" ? selectedModel : editingModel ? mappings[editingModel] : ""
        }
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
