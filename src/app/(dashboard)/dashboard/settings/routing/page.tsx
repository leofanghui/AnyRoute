"use client";

import { useTranslations } from "next-intl";
import RoutingTab from "../components/RoutingTab";
import ComboDefaultsTab from "../components/ComboDefaultsTab";

export default function SettingsRoutingPage() {
  const t = useTranslations("settings");
  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted">{t("routingSettingsIntro")}</p>
      <ComboDefaultsTab />
      <RoutingTab />
    </div>
  );
}
