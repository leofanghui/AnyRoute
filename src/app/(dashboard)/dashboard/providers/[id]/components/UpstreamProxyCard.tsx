"use client";

// Phase 1t.7 extraction — Issue #3501
import Link from "next/link";
import { Card } from "@/shared/components";
import { providerText } from "../providerPageHelpers";
import type { ProviderMessageTranslator } from "../providerPageHelpers";

interface UpstreamProxyCardProps {
  t: ProviderMessageTranslator;
}

export default function UpstreamProxyCard({ t }: UpstreamProxyCardProps) {
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {providerText(t, "upstreamProxyManagedTitle", "Managed via Upstream Proxy Settings")}
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {providerText(
              t,
              "upstreamProxyManagedDescription",
              "This provider is configured as an upstream proxy layer. Manage routing from provider controls or minimal settings."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/providers"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-main hover:border-primary/40 hover:text-text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-base">hub</span>
            {providerText(t, "openProviders", "Open Providers")}
          </Link>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-main hover:border-primary/40 hover:text-text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-base">settings</span>
            {t("openSettings")}
          </Link>
        </div>
      </div>
    </Card>
  );
}
