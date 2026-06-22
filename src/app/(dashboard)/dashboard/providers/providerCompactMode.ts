import { IDE_PROVIDER_IDS } from "@/shared/constants/providers";
import {
  buildCompactProviderEntries,
  resolveDashboardProviderInfo,
  type ProviderEntry,
} from "./providerPageUtils";

type ProviderCategoryEntries<TProvider> = ProviderEntry<TProvider>[];

export interface CompactProviderEntryOptions<TProvider> {
  activeCategory: string;
  showFreeOnly: boolean;
  freeSectionEntries: ProviderCategoryEntries<TProvider>;
  compatibleProviderEntries: ProviderCategoryEntries<TProvider>;
  oauthProviderEntries: ProviderCategoryEntries<TProvider>;
  ideProviderEntries: ProviderCategoryEntries<TProvider>;
  noAuthEntries: ProviderCategoryEntries<TProvider>;
  llmProviderEntries: ProviderCategoryEntries<TProvider>;
  enterpriseProviderEntries: ProviderCategoryEntries<TProvider>;
  webCookieProviderEntries: ProviderCategoryEntries<TProvider>;
}

function getCompactProviderEntryGroups<TProvider>({
  activeCategory,
  showFreeOnly,
  freeSectionEntries,
  compatibleProviderEntries,
  oauthProviderEntries,
  ideProviderEntries,
  noAuthEntries,
  llmProviderEntries,
  enterpriseProviderEntries,
  webCookieProviderEntries,
}: CompactProviderEntryOptions<TProvider>): ProviderEntry<TProvider>[][] {
  const oauthEntries = oauthProviderEntries.filter(
    (entry) => !IDE_PROVIDER_IDS.has(entry.providerId)
  );
  const apiKeyEntries = [llmProviderEntries, enterpriseProviderEntries];

  if (showFreeOnly) return [freeSectionEntries];

  if (activeCategory === "compatible") return [compatibleProviderEntries];
  if (activeCategory === "oauth") return [oauthEntries];
  if (activeCategory === "ide") return [ideProviderEntries];
  if (activeCategory === "no-auth") return [noAuthEntries];
  if (activeCategory === "apikey") return apiKeyEntries;
  if (activeCategory === "webcookie") return [webCookieProviderEntries];

  return [
    compatibleProviderEntries,
    oauthEntries,
    ideProviderEntries,
    webCookieProviderEntries,
    llmProviderEntries,
    enterpriseProviderEntries,
    noAuthEntries,
  ];
}

export function buildCompactProviderEntriesForPage<TProvider>(
  options: CompactProviderEntryOptions<TProvider>
): ProviderEntry<TProvider>[] {
  return buildCompactProviderEntries(getCompactProviderEntryGroups(options), {
    deferNoAuth: options.activeCategory !== "no-auth",
  });
}

const CATEGORY_AUTH_TYPES: Record<string, string> = {
  "no-auth": "no-auth",
  "upstream-proxy": "upstream-proxy",
  "web-cookie": "web-cookie",
  local: "local",
};

export function getCompactProviderAuthType<TProvider>(
  entry: ProviderEntry<TProvider>,
  showFreeOnly: boolean
): string {
  if (showFreeOnly && entry.toggleAuthType === "free") return "free";
  if (entry.displayAuthType === "compatible") return "compatible";

  const info = resolveDashboardProviderInfo(entry.providerId);
  if (!info) return entry.displayAuthType;

  return CATEGORY_AUTH_TYPES[info.category] ?? entry.displayAuthType;
}
