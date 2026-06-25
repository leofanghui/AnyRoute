"use client";

import { useState, useRef } from "react";
import { Button } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import { useTranslations } from "next-intl";

type PreviewProvider = {
  id: string;
  appType: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  protocol: "anthropic" | "openai";
  apiType?: "chat" | "responses";
  category?: string;
  iconColor?: string;
  siteType?: string;
  username?: string;
  disabled?: boolean;
};

type ImportResult = {
  success: number;
  failed: number;
  total: number;
  created: Record<string, unknown>[];
  createdNodes: Record<string, unknown>[];
  errors: Array<{ index: number; name: string; message: string }>;
};

type ProviderMessageTranslator = ((key: string, values?: Record<string, unknown>) => string) & {
  has?: (key: string) => boolean;
};

type ImportSource = "cc-switch-local" | "cc-switch-upload" | "all-api-hub-upload";

const ALL_API_HUB_SOURCE = "all-api-hub-upload";
const CC_SWITCH_LOCAL_SOURCE = "cc-switch-local";
const CC_SWITCH_UPLOAD_SOURCE = "cc-switch-upload";
const SOURCE_TABS = [
  { id: CC_SWITCH_LOCAL_SOURCE, labelKey: "importSourceLocal", fallback: "本地探测" },
  { id: CC_SWITCH_UPLOAD_SOURCE, labelKey: "importSourceUpload", fallback: "上传导出文件" },
  {
    id: ALL_API_HUB_SOURCE,
    labelKey: "importSourceAllApiHub",
    fallback: "ALL-API-Hub JSON",
  },
] as const;

const APP_TYPE_TABS = [
  { id: "all", labelKey: "all", fallback: "All" },
  { id: "claude", labelKey: "claude", fallback: "Claude" },
  { id: "codex", labelKey: "codex", fallback: "Codex" },
] as const;

function pt(
  t: ProviderMessageTranslator,
  key: string,
  fallback: string,
  values?: Record<string, unknown>
): string {
  if (typeof t.has === "function" && t.has(key)) return t(key, values);
  if (values) {
    return Object.entries(values).reduce(
      (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
      fallback
    );
  }
  return fallback;
}

export default function CcSwitchImportPanel({
  onImported,
  onClose,
}: {
  onImported: (connections: Record<string, unknown>[], nodes: Record<string, unknown>[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations("providers") as ProviderMessageTranslator;
  const notify = useNotificationStore();

  const [source, setSource] = useState<ImportSource>(CC_SWITCH_LOCAL_SOURCE);
  const [providers, setProviders] = useState<PreviewProvider[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detecting, setDetecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [uploadSql, setUploadSql] = useState<string | null>(null);
  const [uploadJson, setUploadJson] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appTypeFilter, setAppTypeFilter] = useState<"all" | "claude" | "codex">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const isAllApiHubSource = source === ALL_API_HUB_SOURCE;
  const hasAppTypeTabs = providers.some((p) => p.appType === "claude" || p.appType === "codex");
  const filteredProviders =
    appTypeFilter === "all" ? providers : providers.filter((p) => p.appType === appTypeFilter);

  const resetPreview = () => {
    setDetected(false);
    setProviders([]);
    setSelectedIds(new Set());
    setResult(null);
    setError(null);
    setAppTypeFilter("all");
  };

  const getPreviewEndpoint = () =>
    isAllApiHubSource ? "/api/providers/all-api-hub/preview" : "/api/providers/cc-switch/preview";

  const getImportEndpoint = () =>
    isAllApiHubSource ? "/api/providers/all-api-hub/import" : "/api/providers/cc-switch/import";

  const getUploadPayloadKey = () => (isAllApiHubSource ? "json" : "sql");

  const getUploadContent = () => (isAllApiHubSource ? uploadJson : uploadSql);

  const handleDetect = async () => {
    setDetecting(true);
    setError(null);
    setProviders([]);
    setSelectedIds(new Set());
    setResult(null);
    try {
      const body: Record<string, unknown> = {};
      if (!isAllApiHubSource) {
        body.source = source === CC_SWITCH_UPLOAD_SOURCE ? "upload" : "local";
      }
      const uploadContent = getUploadContent();
      if ((source === CC_SWITCH_UPLOAD_SOURCE || source === ALL_API_HUB_SOURCE) && uploadContent) {
        body[getUploadPayloadKey()] = uploadContent;
      } else if (source !== CC_SWITCH_LOCAL_SOURCE) {
        throw new Error("Missing upload content");
      }

      const res = await fetch(getPreviewEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data?.code === "no_local_db"
            ? pt(t, "importNoLocalDb", "未找到本地 cc-switch 安装")
            : data?.error?.message ||
              data?.error ||
              (isAllApiHubSource
                ? pt(t, "importInvalidJson", "无效的 JSON 文件")
                : pt(t, "importInvalidSql", "无效的导出文件"));
        setError(typeof msg === "string" ? msg : String(msg));
        return;
      }
      const list: PreviewProvider[] = data.providers || [];
      setProviders(list);
      setSelectedIds(new Set(list.filter((p) => p.disabled !== true).map((p) => p.id)));
      setDetected(true);
      if (list.length === 0) {
        setError(
          isAllApiHubSource
            ? pt(t, "importNoProvidersAllApiHub", "未找到可导入的 ALL-API-Hub 供应商")
            : pt(t, "importNoProviders", "未找到可导入的供应商（仅支持有 API Key 的第三方供应商）")
        );
      }
    } catch {
      setError(pt(t, "importResultFailed", "导入失败"));
    } finally {
      setDetecting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (isAllApiHubSource) {
        setUploadJson(reader.result as string);
      } else {
        setUploadSql(reader.result as string);
      }
      resetPreview();
    };
    reader.readAsText(file);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedIds.size === 0 || importing) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        selectedIds: Array.from(selectedIds),
      };
      if (!isAllApiHubSource) {
        body.source = source === CC_SWITCH_UPLOAD_SOURCE ? "upload" : "local";
      }
      const uploadContent = getUploadContent();
      if ((source === CC_SWITCH_UPLOAD_SOURCE || source === ALL_API_HUB_SOURCE) && uploadContent) {
        body[getUploadPayloadKey()] = uploadContent;
      }

      const res = await fetch(getImportEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: ImportResult = await res.json();
      setResult(data);

      if (data.failed === 0 && data.success > 0) {
        notify.success(
          pt(t, "importResultSuccess", "成功导入 {success} 个渠道", { success: data.success })
        );
        onImported(data.created, data.createdNodes);
      } else if (data.success > 0) {
        notify.warning(
          pt(t, "importResultPartial", "成功 {success} 个，失败 {failed} 个", {
            success: data.success,
            failed: data.failed,
          })
        );
        onImported(data.created, data.createdNodes);
      } else {
        notify.error(pt(t, "importResultFailed", "导入失败"));
      }
    } catch {
      notify.error(pt(t, "importResultFailed", "导入失败"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="inline-flex w-fit rounded-lg border border-border bg-bg-subtle p-1"
        role="tablist"
      >
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={source === tab.id}
            onClick={() => {
              setSource(tab.id);
              resetPreview();
              if (fileRef.current) {
                fileRef.current.value = "";
              }
            }}
            className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
              source === tab.id
                ? "bg-surface text-text-main shadow-sm"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            {pt(t, tab.labelKey, tab.fallback)}
          </button>
        ))}
      </div>

      {source !== CC_SWITCH_LOCAL_SOURCE && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">
            {isAllApiHubSource
              ? pt(t, "importAllApiHubUploadHint", "上传 ALL-API-Hub 导出的 JSON 文件")
              : pt(t, "importUploadHint", "上传 cc-switch 导出的 .sql 文件")}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={isAllApiHubSource ? ".json,application/json" : ".sql"}
            onChange={handleFileChange}
            className="text-sm text-text-main file:mr-3 file:rounded-md file:border file:border-border file:bg-bg-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-main hover:file:bg-bg"
          />
        </div>
      )}

      {!detected && !result && (
        <Button
          icon="search"
          loading={detecting}
          disabled={
            detecting ||
            ((source === CC_SWITCH_UPLOAD_SOURCE || source === ALL_API_HUB_SOURCE) &&
              !getUploadContent())
          }
          onClick={handleDetect}
        >
          {detecting
            ? pt(t, "importDetecting", "正在探测...")
            : isAllApiHubSource
              ? pt(t, "importDetectAllApiHub", "解析 ALL-API-Hub")
              : pt(t, "importDetect", "探测 cc-switch")}
        </Button>
      )}

      {error && !result && (
        <div className="rounded-lg border border-border bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {providers.length > 0 && !result && (
        <>
          {hasAppTypeTabs && (
            <div
              className="inline-flex w-fit rounded-lg border border-border bg-bg-subtle p-1"
              role="tablist"
            >
              {APP_TYPE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={appTypeFilter === tab.id}
                  onClick={() => setAppTypeFilter(tab.id)}
                  className={`h-7 rounded-md px-3 text-xs font-medium transition-colors ${
                    appTypeFilter === tab.id
                      ? "bg-surface text-text-main shadow-sm"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  {pt(t, tab.labelKey, tab.fallback)}
                  <span className="ml-1 text-text-muted">
                    (
                    {tab.id === "all"
                      ? providers.length
                      : providers.filter((p) => p.appType === tab.id).length}
                    )
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (selectedIds.size === filteredProviders.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(filteredProviders.map((p) => p.id)));
                }
              }}
              className="text-sm font-medium text-primary hover:underline"
            >
              {selectedIds.size === filteredProviders.length
                ? pt(t, "importDeselectAll", "取消全选")
                : pt(t, "importSelectAll", "全选")}
            </button>
            <span className="text-sm text-text-muted">
              {pt(t, "importSelected", "已选 {count} 个", { count: selectedIds.size })}
            </span>
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-bg-subtle text-left text-xs text-text-muted">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2">{pt(t, "importProviderName", "名称")}</th>
                  <th className="px-3 py-2">{pt(t, "importProviderUrl", "地址")}</th>
                  <th className="px-3 py-2">{pt(t, "importProviderProtocol", "协议")}</th>
                  <th className="px-3 py-2">Key</th>
                </tr>
              </thead>
              <tbody>
                {filteredProviders.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => toggleSelection(p.id)}
                    className={`cursor-pointer border-t border-border transition-colors hover:bg-bg-subtle ${
                      p.disabled ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelection(p.id)}
                        className="accent-primary"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-text-main">
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        {p.disabled && (
                          <span className="rounded-full bg-text-muted/10 px-2 py-0.5 text-[11px] text-text-muted">
                            {pt(t, "importDisabled", "已停用")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs text-text-muted">
                      {p.baseUrl}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.protocol === "anthropic"
                            ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {p.protocol === "anthropic" ? "Anthropic" : "OpenAI"}
                      </span>
                      {p.siteType && (
                        <div className="mt-1 text-[11px] text-text-muted">{p.siteType}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-text-muted">
                      {p.apiKeyMasked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button
              icon="download"
              loading={importing}
              disabled={importing || selectedIds.size === 0}
              onClick={handleImport}
            >
              {importing
                ? pt(t, "importImporting", "正在导入...")
                : pt(t, "importExecute", "导入选中")}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              {pt(t, "cancel", "取消")}
            </Button>
          </div>
        </>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div
            className={`rounded-lg border px-4 py-3 text-sm font-medium ${
              result.failed === 0
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}
          >
            {result.failed === 0
              ? pt(t, "importResultSuccess", "成功导入 {success} 个渠道", {
                  success: result.success,
                })
              : pt(t, "importResultPartial", "成功 {success} 个，失败 {failed} 个", {
                  success: result.success,
                  failed: result.failed,
                })}
          </div>
          {result.errors.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg-subtle p-3">
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-500">
                  <span className="font-medium">{err.name}</span>: {err.message}
                </p>
              ))}
            </div>
          )}
          <Button variant="secondary" onClick={onClose}>
            {pt(t, "close", "关闭")}
          </Button>
        </div>
      )}
    </div>
  );
}
