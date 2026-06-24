export const HIDEABLE_SIDEBAR_ITEM_IDS = [
  "home",
  "api-manager",
  "endpoints",
  "providers",
  "combos",
  "cli-code",
  "analytics",
  "costs",
  "logs",
  "health",
  "settings-general",
  "settings-appearance",
  "settings-security",
  "settings-routing",
  "settings-resilience",
  "settings-models-dev",
  "settings-sidebar",
  "docs",
  "changelog",
] as const;

export type HideableSidebarItemId = (typeof HIDEABLE_SIDEBAR_ITEM_IDS)[number];

export type SidebarSectionId =
  | "home"
  | "omni-proxy"
  | "analytics"
  | "costs"
  | "monitoring"
  | "configuration"
  | "help";

export interface SidebarItemDefinition {
  id: HideableSidebarItemId;
  href: string;
  i18nKey: string;
  subtitleKey?: string;
  labelFallback?: string;
  subtitleFallback?: string;
  icon: string;
  exact?: boolean;
  external?: boolean;
}

export interface SidebarItemGroup {
  type: "group";
  id: string;
  titleKey: string;
  titleFallback: string;
  items: readonly SidebarItemDefinition[];
}

export type SidebarSectionChild = SidebarItemDefinition | SidebarItemGroup;

export interface SidebarSectionDefinition {
  id: SidebarSectionId;
  titleKey: string;
  titleFallback: string;
  children: readonly SidebarSectionChild[];
  showTitle?: boolean;
  visibility?: "always" | "debug";
  defaultPinned?: boolean;
}

export function getSectionItems(
  section: SidebarSectionDefinition | { children: readonly SidebarSectionChild[] }
): readonly SidebarItemDefinition[] {
  return section.children.flatMap((child) =>
    "type" in child && child.type === "group" ? child.items : [child as SidebarItemDefinition]
  );
}

const HOME_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "home",
    href: "/home",
    i18nKey: "home",
    subtitleKey: "homeSubtitle",
    icon: "home",
    exact: true,
  },
];

const OMNI_PROXY_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "endpoints",
    href: "/dashboard/endpoint",
    i18nKey: "endpoints",
    subtitleKey: "endpointsSubtitle",
    icon: "api",
  },
  {
    id: "api-manager",
    href: "/dashboard/api-manager",
    i18nKey: "apiManager",
    subtitleKey: "apiManagerSubtitle",
    icon: "vpn_key",
  },
  {
    id: "providers",
    href: "/dashboard/providers",
    i18nKey: "providers",
    subtitleKey: "providersSubtitle",
    icon: "dns",
  },
  {
    id: "combos",
    href: "/dashboard/combos",
    i18nKey: "combos",
    subtitleKey: "combosSubtitle",
    icon: "layers",
  },
  {
    id: "cli-code",
    href: "/dashboard/cli-code",
    i18nKey: "cliCode",
    subtitleKey: "cliCodeSubtitle",
    icon: "terminal",
  },
];

const ANALYTICS_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "analytics",
    href: "/dashboard/analytics",
    i18nKey: "usage",
    subtitleKey: "usageSubtitle",
    icon: "analytics",
  },
];

const COSTS_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "costs",
    href: "/dashboard/costs",
    i18nKey: "costsOverview",
    subtitleKey: "costsOverviewSubtitle",
    icon: "account_balance_wallet",
  },
];

const MONITORING_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "logs",
    href: "/dashboard/logs",
    i18nKey: "logs",
    subtitleKey: "logsSubtitle",
    icon: "description",
  },
  {
    id: "health",
    href: "/dashboard/health",
    i18nKey: "health",
    subtitleKey: "healthSubtitle",
    icon: "health_and_safety",
  },
];

const CONFIGURATION_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "settings-general",
    href: "/dashboard/settings/general",
    i18nKey: "settingsGeneral",
    subtitleKey: "settingsGeneralSubtitle",
    icon: "tune",
  },
  {
    id: "settings-appearance",
    href: "/dashboard/settings/appearance",
    i18nKey: "settingsAppearance",
    subtitleKey: "settingsAppearanceSubtitle",
    icon: "palette",
  },
  {
    id: "settings-security",
    href: "/dashboard/settings/security",
    i18nKey: "settingsSecurity",
    subtitleKey: "settingsSecuritySubtitle",
    icon: "shield",
  },
  {
    id: "settings-routing",
    href: "/dashboard/settings/routing",
    i18nKey: "settingsRouting",
    subtitleKey: "settingsRoutingSubtitle",
    icon: "route",
  },
  {
    id: "settings-resilience",
    href: "/dashboard/settings/resilience",
    i18nKey: "settingsResilience",
    subtitleKey: "settingsResilienceSubtitle",
    icon: "health_and_safety",
  },
  {
    id: "settings-models-dev",
    href: "/dashboard/settings/models-dev",
    i18nKey: "settingsModelsDev",
    subtitleKey: "settingsModelsDevSubtitle",
    icon: "database",
  },
  {
    id: "settings-sidebar",
    href: "/dashboard/settings/sidebar",
    i18nKey: "settingsSidebar",
    subtitleKey: "settingsSidebarSubtitle",
    icon: "view_sidebar",
  },
];

const HELP_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "docs",
    href: "/docs",
    i18nKey: "docs",
    subtitleKey: "docsSubtitle",
    icon: "menu_book",
    external: true,
  },
  {
    id: "changelog",
    href: "/dashboard/changelog",
    i18nKey: "changelog",
    subtitleKey: "changelogSubtitle",
    icon: "campaign",
  },
];

export const SIDEBAR_SECTIONS: readonly SidebarSectionDefinition[] = [
  {
    id: "home",
    titleKey: "home",
    titleFallback: "Home",
    children: HOME_ITEMS,
    showTitle: false,
  },
  {
    id: "omni-proxy",
    titleKey: "omniProxySection",
    titleFallback: "OmniProxy",
    children: OMNI_PROXY_ITEMS,
    defaultPinned: true,
  },
  {
    id: "analytics",
    titleKey: "analyticsSection",
    titleFallback: "Analytics",
    children: ANALYTICS_ITEMS,
  },
  {
    id: "costs",
    titleKey: "costsSection",
    titleFallback: "Costs",
    children: COSTS_ITEMS,
  },
  {
    id: "monitoring",
    titleKey: "monitoringSection",
    titleFallback: "Monitoring",
    children: MONITORING_ITEMS,
  },
  {
    id: "configuration",
    titleKey: "configurationSection",
    titleFallback: "Configuration",
    children: CONFIGURATION_ITEMS,
  },
  {
    id: "help",
    titleKey: "helpSection",
    titleFallback: "Help",
    children: HELP_ITEMS,
  },
] as const;

export const HIDDEN_SIDEBAR_ITEMS_SETTING_KEY = "hiddenSidebarItems";
export const SIDEBAR_SECTION_ORDER_KEY = "sidebarSectionOrder";
export const SIDEBAR_ITEM_ORDER_KEY = "sidebarItemOrder";
export const SIDEBAR_PRESET_KEY = "sidebarActivePreset";
export const SIDEBAR_SETTINGS_UPDATED_EVENT = "omniroute:settings-updated";

export const SIDEBAR_PRESET_IDS = ["minimal"] as const;
export const SIDEBAR_LEGACY_PRESET_IDS = ["all", "developer", "admin"] as const;
export const ACCEPTED_SIDEBAR_PRESET_IDS = [
  ...SIDEBAR_PRESET_IDS,
  ...SIDEBAR_LEGACY_PRESET_IDS,
] as const;

export type SidebarPresetId = (typeof SIDEBAR_PRESET_IDS)[number];
export type AcceptedSidebarPresetId = (typeof ACCEPTED_SIDEBAR_PRESET_IDS)[number];

export interface SidebarPresetDefinition {
  id: SidebarPresetId;
  icon: string;
  hiddenItems: HideableSidebarItemId[];
}

export const SIDEBAR_PRESETS: readonly SidebarPresetDefinition[] = [
  { id: "minimal", icon: "minimize", hiddenItems: [] },
];

export function normalizeSidebarPresetId(value: unknown): SidebarPresetId | null {
  if (typeof value !== "string") return null;
  if (!ACCEPTED_SIDEBAR_PRESET_IDS.includes(value as AcceptedSidebarPresetId)) return null;
  return "minimal";
}

export type SidebarItemOrder = Partial<Record<SidebarSectionId, string[]>>;

export function applySectionOrder(
  sections: readonly SidebarSectionDefinition[],
  order: SidebarSectionId[]
): SidebarSectionDefinition[] {
  if (order.length === 0) return [...sections];
  const knownIds = new Set(sections.map((s) => s.id));
  const validOrder = order.filter((id) => knownIds.has(id));
  const orderMap = new Map(validOrder.map((id, i) => [id, i]));
  return [...sections].sort((a, b) => {
    const ai = orderMap.get(a.id) ?? validOrder.length + sections.indexOf(a);
    const bi = orderMap.get(b.id) ?? validOrder.length + sections.indexOf(b);
    return ai - bi;
  });
}

export function applyItemOrder(
  children: readonly SidebarSectionChild[],
  order: string[]
): SidebarSectionChild[] {
  if (order.length === 0) return [...children];
  const getChildId = (c: SidebarSectionChild): string =>
    "type" in c && c.type === "group" ? c.id : (c as SidebarItemDefinition).id;
  const knownIds = new Set(children.map(getChildId));
  const validOrder = order.filter((id) => knownIds.has(id));
  const orderMap = new Map(validOrder.map((id, i) => [id, i]));
  return [...children].sort((a, b) => {
    const aId = getChildId(a);
    const bId = getChildId(b);
    const ai = orderMap.get(aId) ?? validOrder.length + children.indexOf(a);
    const bi = orderMap.get(bId) ?? validOrder.length + children.indexOf(b);
    return ai - bi;
  });
}

export function normalizeHiddenSidebarItems(value: unknown): HideableSidebarItemId[] {
  if (!Array.isArray(value)) return [];
  const hiddenItems = new Set<HideableSidebarItemId>();
  for (const item of value) {
    if (
      typeof item === "string" &&
      HIDEABLE_SIDEBAR_ITEM_IDS.includes(item as HideableSidebarItemId)
    ) {
      hiddenItems.add(item as HideableSidebarItemId);
    }
  }
  return [...hiddenItems];
}
