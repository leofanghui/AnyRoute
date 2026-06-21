"use client";

import { useCallback, useState } from "react";
import { Button, Card } from "@/shared/components";

type ZedImportCardProps = {
  fetchConnections: () => Promise<void>;
  notify: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
};

const ZED_MANUAL_PROVIDER_OPTIONS = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Gemini" },
  { id: "mistral", label: "Mistral" },
  { id: "xai", label: "xAI" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "deepseek", label: "DeepSeek" },
] as const;

export default function ZedImportCard({ fetchConnections, notify }: ZedImportCardProps) {
  const [provider, setProvider] = useState("openai");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  const handleManualImport = useCallback(async () => {
    const trimmedToken = token.trim();
    if (saving || !trimmedToken) return;

    setSaving(true);
    try {
      const res = await fetch("/api/providers/zed/manual-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token: trimmedToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        notify.error(data.error?.message ?? data.error ?? "Manual import failed");
        return;
      }

      notify.success(`Imported ${provider} token from Zed`);
      setToken("");
      await fetchConnections();
    } catch (error: unknown) {
      notify.error(error instanceof Error ? error.message : "Manual import failed");
    } finally {
      setSaving(false);
    }
  }, [fetchConnections, notify, provider, saving, token]);

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">edit</span>
            Manual Zed Token Import
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Paste an API key copied from Zed AI settings and save it as an OmniRoute provider
            connection.
          </p>
        </div>

        <div className="flex gap-2 flex-col sm:flex-row">
          <select
            className="input input-sm"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            aria-label="Provider"
          >
            {ZED_MANUAL_PROVIDER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="password"
            className="input input-sm flex-1"
            placeholder="Paste API key"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <Button
            size="sm"
            variant="secondary"
            icon={saving ? "sync" : "upload"}
            onClick={handleManualImport}
            disabled={saving || !token.trim()}
          >
            {saving ? "Saving..." : "Import"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
