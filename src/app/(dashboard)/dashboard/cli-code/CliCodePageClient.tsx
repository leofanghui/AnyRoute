"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, CardSkeleton } from "@/shared/components";
import { CLI_TOOLS } from "@/shared/constants/cliTools";
import { EXPECTED_CODE_COUNT } from "@/shared/schemas/cliCatalog";
import { CliToolCard, CliConceptCard } from "@/shared/components/cli";
import { useToolBatchStatuses } from "@/shared/hooks/cli/useToolBatchStatuses";
import type { CliCatalogEntry } from "@/shared/schemas/cliCatalog";

// ── Static catalogue slice ────────────────────────────────────────────────────

const CODE_TOOLS: [string, CliCatalogEntry][] = Object.entries(CLI_TOOLS).filter(
  ([, tool]) => tool.category === "code" && tool.baseUrlSupport !== "none"
) as [string, CliCatalogEntry][];
const PRIMARY_TOOL_IDS = ["claude", "claude-desktop", "codex", "codex-desktop"];
const primaryTools = PRIMARY_TOOL_IDS.map((id) => [id, CLI_TOOLS[id]] as [string, CliCatalogEntry])
  .filter(([, tool]) => !!tool)
  .filter(([, tool]) => tool.category === "code" && tool.baseUrlSupport !== "none");
const primaryToolIdSet = new Set(primaryTools.map(([id]) => id));
const secondaryTools = CODE_TOOLS.filter(([id]) => !primaryToolIdSet.has(id));

// Cardinality guard (D15) — non-blocking, log only
if (CODE_TOOLS.length !== EXPECTED_CODE_COUNT) {
  console.warn(
    `[CliCodePage] Expected ${EXPECTED_CODE_COUNT} code tools, found ${CODE_TOOLS.length}. ` +
      "Check F1 catalog edits."
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProviderConnection {
  isActive?: boolean;
  [key: string]: unknown;
}

interface ProvidersResponse {
  connections?: ProviderConnection[];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CliCodePageClientProps {
  machineId: string;
}

export default function CliCodePageClient({ machineId: _machineId }: CliCodePageClientProps) {
  const t = useTranslations("cliCode");
  const tCommon = useTranslations("cliCommon");

  // ── Batch statuses ──────────────────────────────────────────────────────────
  const { statuses, loading, refetch } = useToolBatchStatuses();

  // ── Providers ───────────────────────────────────────────────────────────────
  const [hasActiveProviders, setHasActiveProviders] = useState<boolean>(false);
  const [providersLoading, setProvidersLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/providers")
      .then<ProvidersResponse>((res) =>
        res.ok ? res.json() : Promise.resolve({ connections: [] })
      )
      .then((data) => {
        if (cancelled) return;
        const active = (data.connections ?? []).filter((c) => c.isActive !== false);
        setHasActiveProviders(active.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasActiveProviders(false);
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Filters ─────────────────────────────────────────────────────────────────
  // ── Filtered tools ──────────────────────────────────────────────────────────
  // ── Render ───────────────────────────────────────────────────────────────────
  const isLoadingOverall = loading || providersLoading;

  return (
    <div className="flex flex-col gap-6">
      {/* Concept card */}
      <CliConceptCard currentType="code" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-text-main leading-tight">{t("pageTitle")}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t("pageSubtitle")}</p>
        </div>

        {/* Refresh button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={refetch}
          icon="refresh"
          aria-label={tCommon("card.refreshDetection")}
        >
          {tCommon("card.refreshDetection")}
        </Button>
      </div>

      {/* Empty state — no active providers */}
      {!providersLoading && !hasActiveProviders && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-500 flex-shrink-0">warning</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {tCommon("detail.noActiveProviders")}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {tCommon("detail.noActiveProvidersDesc")}
            </p>
            <Link
              href="/dashboard/providers"
              className="inline-flex items-center gap-1 mt-2 text-xs text-primary font-medium hover:underline"
            >
              {tCommon("detail.openProviders")}
            </Link>
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoadingOverall ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-main">推荐接入</h2>
                <p className="text-xs text-text-muted">
                  优先配置 Claude 和 Codex，模型从统一模型池中选择。
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {primaryTools.map(([id, tool]) => (
                <CliToolCard
                  key={id}
                  tool={tool}
                  batchStatus={statuses?.[id] ?? null}
                  detailHref={`/dashboard/cli-code/${id}`}
                  hasActiveProviders={hasActiveProviders}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text-main">更多工具</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {secondaryTools.map(([id, tool]) => (
                <CliToolCard
                  key={id}
                  tool={tool}
                  batchStatus={statuses?.[id] ?? null}
                  detailHref={`/dashboard/cli-code/${id}`}
                  hasActiveProviders={hasActiveProviders}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
