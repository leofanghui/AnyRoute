"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "./Button";
import Card from "./Card";
import NoAuthProviderToggle from "./NoAuthProviderToggle";

interface NoAuthAccountCardProps {
  providerId: string;
  providerName: string;
  generateAccountId: () => string;
  dataKey?: string;
  description?: string;
  addLabel?: string;
  enabled?: boolean;
  savingEnabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
}

interface Connection {
  id: string;
  provider: string;
  providerSpecificData?: Record<string, any>;
}

export default function NoAuthAccountCard({
  providerId,
  providerName,
  generateAccountId,
  dataKey = "fingerprints",
  description = "Ready to use without signup. Add accounts for rate-limit rotation.",
  addLabel = "Add Account",
  enabled = true,
  savingEnabled = false,
  onEnabledChange,
}: NoAuthAccountCardProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        setConnections(
          (data.connections || []).filter(
            (connection: Connection) => connection.provider === providerId
          )
        );
      }
    } catch (err) {
      console.error("Failed to fetch connections:", err);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  const allAccountIds = connections.flatMap(
    (connection) => connection.providerSpecificData?.[dataKey] || []
  );
  const conn = connections[0];

  const handleAddAccount = async () => {
    setAdding(true);
    try {
      const accountId = generateAccountId();
      if (connections.length === 0) {
        const res = await fetch("/api/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: providerId,
            name: `${providerName} Account 1`,
            providerSpecificData: { [dataKey]: [accountId] },
          }),
        });
        if (!res.ok) throw new Error("Failed to create connection");
      } else {
        const res = await fetch(`/api/providers/${conn.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerSpecificData: { [dataKey]: [...allAccountIds, accountId] },
          }),
        });
        if (!res.ok) throw new Error("Failed to update connection");
      }
      await fetchConnections();
    } catch (err) {
      console.error("Failed to add account:", err);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    if (!conn) return;
    try {
      const res = await fetch(`/api/providers/${conn.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerSpecificData: {
            [dataKey]: allAccountIds.filter((id) => id !== accountId),
          },
        }),
      });
      if (res.ok) await fetchConnections();
    } catch (err) {
      console.error("Failed to remove account:", err);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-500">
            <span className="material-symbols-outlined text-[20px]">lock_open</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">No authentication required</p>
            <p className="text-xs text-text-muted">{description}</p>
          </div>
        </div>
        <NoAuthProviderToggle
          className="w-full justify-end sm:w-auto"
          enabled={enabled}
          saving={savingEnabled}
          onEnabledChange={onEnabledChange}
        />
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">
            Accounts ({loading ? "..." : allAccountIds.length})
          </span>
          <Button size="sm" icon="add" onClick={handleAddAccount} disabled={adding || !enabled}>
            {adding ? "Adding..." : addLabel}
          </Button>
        </div>

        {!loading && allAccountIds.length === 0 && (
          <p className="py-2 text-xs text-text-muted">
            Using auto-generated account. Click &quot;{addLabel}&quot; for rate-limit rotation.
          </p>
        )}

        {!loading && allAccountIds.length > 0 && (
          <div
            data-testid="noauth-account-grid"
            className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            {allAccountIds.map((id, index) => (
              <div
                key={id}
                data-account-id={id}
                className="group flex items-center gap-2 rounded-lg border border-border bg-bg/40 px-2.5 py-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg text-[10px] font-medium text-text-muted">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">
                  {String(id).slice(0, 10)}...
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveAccount(id)}
                  className="shrink-0 rounded p-1 text-text-muted opacity-0 transition-colors hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                  aria-label="Remove account"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
