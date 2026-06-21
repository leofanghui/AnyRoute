"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Toggle } from "@/shared/components";

type MinimalSettings = {
  instanceName?: string;
  requireLogin?: boolean;
  requireApiKey?: boolean;
  hasPassword?: boolean;
  apiPort?: number;
  dashboardPort?: number;
};

export default function SystemStorageTab() {
  const [settings, setSettings] = useState<MinimalSettings>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {
        if (!cancelled) setStatus("Failed to load settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: settings.instanceName || "",
          requireLogin: settings.requireLogin === true,
          requireApiKey: settings.requireApiKey === true,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      setSettings((prev) => ({ ...prev, ...data.settings }));
      setStatus("Settings saved.");
    } catch {
      setStatus("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">General</h2>
          <p className="text-sm text-text-muted">Minimal runtime settings for the local router.</p>
        </div>

        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Instance name</span>
            <Input
              value={settings.instanceName || ""}
              disabled={loading}
              placeholder="OmniRoute"
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, instanceName: event.target.value }))
              }
            />
          </label>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">Require dashboard login</p>
              <p className="text-sm text-text-muted">Protect dashboard management pages.</p>
            </div>
            <Toggle
              checked={settings.requireLogin === true}
              onChange={(checked) => setSettings((prev) => ({ ...prev, requireLogin: checked }))}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">Require API key</p>
              <p className="text-sm text-text-muted">Require bearer keys for API requests.</p>
            </div>
            <Toggle
              checked={settings.requireApiKey === true}
              onChange={(checked) => setSettings((prev) => ({ ...prev, requireApiKey: checked }))}
            />
          </div>

          <div className="grid gap-3 text-sm text-text-muted sm:grid-cols-2">
            <div>API port: {settings.apiPort ?? "unknown"}</div>
            <div>Dashboard port: {settings.dashboardPort ?? "unknown"}</div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={loading || saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            {status && <span className="text-sm text-text-muted">{status}</span>}
          </div>
        </div>
      </Card>
    </div>
  );
}
