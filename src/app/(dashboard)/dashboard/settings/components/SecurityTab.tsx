"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Modal, Toggle } from "@/shared/components";
import { useTranslations } from "next-intl";

type SecuritySettings = {
  requireLogin?: boolean;
  requireApiKey?: boolean;
  hasPassword?: boolean;
};

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (record.error && typeof record.error === "object") {
    const error = record.error as Record<string, unknown>;
    if (typeof error.message === "string") return error.message;
  }
  return fallback;
}

export default function SecurityTab() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const text = (key: string, fallback: string) =>
    typeof t.has === "function" && t.has(key) ? t(key) : fallback;
  const commonText = (key: string, fallback: string) =>
    typeof common.has === "function" && common.has(key) ? common(key) : fallback;

  const [settings, setSettings] = useState<SecuritySettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [requireLoginModalOpen, setRequireLoginModalOpen] = useState(false);
  const [pendingRequireLogin, setPendingRequireLogin] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(text("failedToLoad", "Failed to load settings."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patchSettings = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(readErrorMessage(data, text("failedUpdate", "Failed to update settings.")));
    }
    setSettings((prev) => ({
      ...prev,
      ...((data as { settings?: SecuritySettings })?.settings || data || {}),
    }));
    setStatus(text("savedSuccessfully", "Saved successfully."));
  };

  const updateRequireApiKey = async (checked: boolean) => {
    setSaving(true);
    setStatus("");
    try {
      await patchSettings({ requireApiKey: checked });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : text("failedUpdate", "Update failed."));
    } finally {
      setSaving(false);
    }
  };

  const requestRequireLoginChange = (checked: boolean) => {
    if (settings.hasPassword) {
      setPendingRequireLogin(checked);
      setCurrentPassword("");
      setStatus("");
      setRequireLoginModalOpen(true);
      return;
    }
    void updateRequireLogin(checked, "");
  };

  const updateRequireLogin = async (checked: boolean, password: string) => {
    setSaving(true);
    setStatus("");
    try {
      await patchSettings({
        requireLogin: checked,
        ...(password ? { currentPassword: password } : {}),
      });
      setRequireLoginModalOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : text("failedUpdate", "Update failed."));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (passwords.next !== passwords.confirm) {
      setStatus(text("passwordsNoMatch", "Passwords do not match."));
      return;
    }
    if (!passwords.next) {
      setStatus(text("passwordRequired", "Password is required."));
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      await patchSettings({
        newPassword: passwords.next,
        ...(settings.hasPassword ? { currentPassword: passwords.current } : {}),
      });
      setSettings((prev) => ({ ...prev, hasPassword: true }));
      setPasswords({ current: "", next: "", confirm: "" });
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : text("failedUpdatePassword", "Update failed.")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              shield
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{text("security", "Security")}</h2>
            <p className="text-sm text-text-muted">
              {text("securityDesc", "Protect dashboard access and API requests.")}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">{text("requireLogin", "Require dashboard login")}</p>
              <p className="text-sm text-text-muted">
                {text("requireLoginDesc", "Require authentication for dashboard management pages.")}
              </p>
            </div>
            <Toggle
              checked={settings.requireLogin === true}
              onChange={requestRequireLoginChange}
              disabled={loading || saving}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">{text("requireApiKey", "Require API key")}</p>
              <p className="text-sm text-text-muted">
                {text("requireApiKeyDesc", "Require bearer keys for inference API requests.")}
              </p>
            </div>
            <Toggle
              checked={settings.requireApiKey === true}
              onChange={updateRequireApiKey}
              disabled={loading || saving}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-5">
          <h3 className="text-lg font-semibold">
            {text("managementPassword", "Management password")}
          </h3>
          <p className="text-sm text-text-muted">
            {text("managementPasswordDesc", "Set or rotate the password used for dashboard login.")}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {settings.hasPassword && (
            <Input
              type="password"
              label={text("currentPassword", "Current password")}
              value={passwords.current}
              onChange={(event) =>
                setPasswords((prev) => ({ ...prev, current: event.target.value }))
              }
              disabled={saving}
            />
          )}
          <Input
            type="password"
            label={text("newPassword", "New password")}
            value={passwords.next}
            onChange={(event) => setPasswords((prev) => ({ ...prev, next: event.target.value }))}
            disabled={saving}
          />
          <Input
            type="password"
            label={text("confirmPassword", "Confirm password")}
            value={passwords.confirm}
            onChange={(event) => setPasswords((prev) => ({ ...prev, confirm: event.target.value }))}
            disabled={saving}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={changePassword} disabled={saving || loading}>
            {saving ? commonText("saving", "Saving...") : commonText("save", "Save")}
          </Button>
          {status && <span className="text-sm text-text-muted">{status}</span>}
        </div>
      </Card>

      <Modal
        isOpen={requireLoginModalOpen}
        onClose={() => !saving && setRequireLoginModalOpen(false)}
        title={text("currentPassword", "Current password")}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            {text(
              "enterCurrentPassword",
              "Enter your current password to change dashboard login enforcement."
            )}
          </p>
          <Input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            disabled={saving}
            autoFocus
          />
          {status && <p className="text-sm text-red-500">{status}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setRequireLoginModalOpen(false)}
              disabled={saving}
            >
              {commonText("cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => {
                if (pendingRequireLogin !== null) {
                  void updateRequireLogin(pendingRequireLogin, currentPassword);
                }
              }}
              disabled={saving || !currentPassword}
            >
              {commonText("confirm", "Confirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
