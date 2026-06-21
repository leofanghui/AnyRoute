"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Button, Card, CardSkeleton } from "@/shared/components";
import { useDisplayBaseUrl } from "@/shared/hooks";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

type APIPageClientProps = {
  machineId: string;
};

type ModelSummary = {
  id: string;
  owned_by?: string;
  type?: string;
};

type EndpointRow = {
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
};

const CORE_ENDPOINTS: EndpointRow[] = [
  {
    method: "POST",
    path: "/v1/chat/completions",
    title: "Chat completions",
    description: "OpenAI-compatible chat requests through the active provider or combo.",
  },
  {
    method: "POST",
    path: "/v1/responses",
    title: "Responses",
    description: "Responses API facade mapped onto the retained chat pipeline.",
  },
  {
    method: "GET",
    path: "/v1/models",
    title: "Models",
    description: "Model catalog visible to API clients.",
  },
  {
    method: "POST",
    path: "/api/v1/chat/completions",
    title: "Versioned chat",
    description: "Versioned API route for clients pinned to the /api/v1 namespace.",
  },
  {
    method: "POST",
    path: "/api/v1/responses",
    title: "Versioned responses",
    description: "Versioned Responses API route.",
  },
  {
    method: "GET",
    path: "/api/v1/models",
    title: "Versioned models",
    description: "Versioned model listing route.",
  },
];

export default function APIPageClient({ machineId }: Readonly<APIPageClientProps>) {
  const displayBaseUrl = useDisplayBaseUrl();
  const { copied, copy } = useCopyToClipboard();
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const response = await fetch("/v1/models", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (!cancelled) {
          setModels(Array.isArray(payload.data) ? payload.data : []);
        }
      } catch (error) {
        if (!cancelled) {
          setModelsError(error instanceof Error ? error.message : "Unable to load models");
          setModels([]);
        }
      } finally {
        if (!cancelled) {
          setModelsLoading(false);
        }
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const modelGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const model of models) {
      const key = model.type || "chat";
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [models]);

  const machineLabel = machineId || "local";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-text-main">Endpoint</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Minimal API surface for chat, responses, model discovery, providers, and routing combos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/api-manager">
            <Button variant="secondary">API keys</Button>
          </Link>
          <Link href="/dashboard/providers">
            <Button variant="secondary">Providers</Button>
          </Link>
          <Link href="/dashboard/combos">
            <Button>Combos</Button>
          </Link>
        </div>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Base URL
            </p>
            <div className="mt-3 flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-sm text-text-main">
                {displayBaseUrl}
              </code>
              <button
                onClick={() => copy(displayBaseUrl, "base-url")}
                className="rounded-md border border-border/70 px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-main"
              >
                {copied === "base-url" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-sidebar/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Instance
            </p>
            <p className="mt-2 text-sm text-text-main">{machineLabel}</p>
            <p className="mt-1 text-xs text-text-muted">
              Extended protocol, tunnel, sync, and external context modules are not included in this
              minimal source profile.
            </p>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        {CORE_ENDPOINTS.map((endpoint) => {
          const absoluteUrl = `${displayBaseUrl}${endpoint.path}`;
          return (
            <Card key={`${endpoint.method}-${endpoint.path}`} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-border/70 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                      {endpoint.method}
                    </span>
                    <h2 className="text-sm font-semibold text-text-main">{endpoint.title}</h2>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">{endpoint.description}</p>
                </div>
                <button
                  onClick={() => copy(absoluteUrl, endpoint.path)}
                  className="shrink-0 rounded-md border border-border/70 px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-main"
                >
                  {copied === endpoint.path ? "Copied" : "Copy"}
                </button>
              </div>
              <code className="mt-3 block truncate rounded-md bg-background/70 px-3 py-2 text-xs text-text-main">
                {absoluteUrl}
              </code>
            </Card>
          );
        })}
      </section>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-main">Model catalog</h2>
            <p className="mt-1 text-xs text-text-muted">
              Models returned by the retained /v1/models endpoint.
            </p>
          </div>
          <Link href="/dashboard/providers" className="text-xs font-medium text-primary">
            Manage providers
          </Link>
        </div>

        {modelsLoading ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : modelsError ? (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
            Failed to load models: {modelsError}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-sidebar/40 p-3">
              <p className="text-xs text-text-muted">Total models</p>
              <p className="mt-1 text-2xl font-semibold text-text-main">{models.length}</p>
            </div>
            {modelGroups.slice(0, 5).map(([type, count]) => (
              <div key={type} className="rounded-lg border border-border/70 bg-sidebar/40 p-3">
                <p className="text-xs capitalize text-text-muted">{type}</p>
                <p className="mt-1 text-2xl font-semibold text-text-main">{count}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
