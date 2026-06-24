"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Toggle } from "@/shared/components";
import { useTranslations } from "next-intl";

type MinimalSettings = {
  instanceName?: string;
  requireLogin?: boolean;
  requireApiKey?: boolean;
  hasPassword?: boolean;
  apiPort?: number;
  dashboardPort?: number;
};

export default function SystemStorageTab() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
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
        if (!cancelled) setStatus(t("failedToLoad"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

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
      setSettings((prev) => ({ ...prev, ...(data.settings || data) }));
      setStatus(t("savedSuccessfully"));
    } catch {
      setStatus(t("failedUpdate"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">{t("generalSettingsTitle")}</h2>
          <p className="text-sm text-text-muted">{t("generalSettingsDesc")}</p>
        </div>

        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-medium">{t("appName")}</span>
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
              <p className="font-medium">{t("requireLogin")}</p>
              <p className="text-sm text-text-muted">{t("requireLoginDesc")}</p>
            </div>
            <Toggle
              checked={settings.requireLogin === true}
              onChange={(checked) => setSettings((prev) => ({ ...prev, requireLogin: checked }))}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">{t("requireApiKey")}</p>
              <p className="text-sm text-text-muted">{t("requireApiKeyDesc")}</p>
            </div>
            <Toggle
              checked={settings.requireApiKey === true}
              onChange={(checked) => setSettings((prev) => ({ ...prev, requireApiKey: checked }))}
            />
          </div>

          <div className="grid gap-3 text-sm text-text-muted sm:grid-cols-2">
            <div>
              {t("apiPort")}: {settings.apiPort ?? t("unknown")}
            </div>
            <div>
              {t("dashboardPort")}: {settings.dashboardPort ?? t("unknown")}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={loading || saving}>
              {saving ? tc("saving") : tc("save")}
            </Button>
            {status && <span className="text-sm text-text-muted">{status}</span>}
          </div>
        </div>
      </Card>
    </div>
  );
}
