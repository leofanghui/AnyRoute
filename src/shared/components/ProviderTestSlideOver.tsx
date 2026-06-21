"use client";

import { useState } from "react";

import { Button, Card } from "@/shared/components";

interface SlideOverProvider {
  name: string;
}

interface ProviderTestSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
  provider: SlideOverProvider;
  staticIconPath?: string | null;
  initialTab?: string;
}

export default function ProviderTestSlideOver({
  isOpen,
  onClose,
  providerId,
  provider,
}: ProviderTestSlideOverProps) {
  const [status, setStatus] = useState("");
  const [testing, setTesting] = useState(false);

  if (!isOpen) return null;

  const runTest = async () => {
    setTesting(true);
    setStatus("");
    try {
      const res = await fetch(`/api/providers/${encodeURIComponent(providerId)}/test`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Connection test failed.");
      setStatus(data?.message || "Connection test completed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" />
      <Card className="relative w-full max-w-md p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{provider.name}</h2>
            <p className="text-sm text-text-muted">Connection test</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={runTest} disabled={testing}>
            {testing ? "Testing..." : "Run test"}
          </Button>
          {status && <span className="text-sm text-text-muted">{status}</span>}
        </div>
      </Card>
    </div>
  );
}
