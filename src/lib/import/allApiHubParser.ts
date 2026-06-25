export type AllApiHubProvider = {
  id: string;
  appType: "all-api-hub";
  name: string;
  baseUrl: string;
  apiKey: string;
  apiKeyMasked: string;
  protocol: "openai";
  apiType: "chat";
  siteType?: string;
  username?: string;
  disabled?: boolean;
};

export type AllApiHubPreviewProvider = Omit<AllApiHubProvider, "apiKey">;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 3) + "..." + key.slice(-3);
}

function sanitizeBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(?:chat\/completions|responses|completions|models)(?:\?[^#]*)?$/i, "");
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeNamePart(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildDisplayName(account: Record<string, unknown>, baseUrl: string): string {
  const siteName =
    normalizeNamePart(account.site_name) || hostnameFromUrl(baseUrl) || "ALL-API-Hub";
  const info = asRecord(account.account_info);
  const username = normalizeNamePart(info.username);
  const id = normalizeNamePart(account.id);
  if (username && username !== siteName && id) return `${siteName} (${username} #${id.slice(-6)})`;
  if (username && username !== siteName) return `${siteName} (${username})`;
  if (id) return `${siteName} (#${id.slice(-6)})`;
  return siteName;
}

function extractAccount(account: unknown): AllApiHubProvider | null {
  const record = asRecord(account);
  const id = normalizeNamePart(record.id);
  const rawBaseUrl = normalizeNamePart(record.site_url);
  const baseUrl = sanitizeBaseUrl(rawBaseUrl);
  if (!id || !baseUrl || !isHttpUrl(baseUrl)) return null;

  const accountInfo = asRecord(record.account_info);
  const apiKey = normalizeNamePart(accountInfo.access_token);
  if (!apiKey) return null;

  return {
    id,
    appType: "all-api-hub",
    name: buildDisplayName(record, baseUrl),
    baseUrl,
    apiKey,
    apiKeyMasked: maskApiKey(apiKey),
    protocol: "openai",
    apiType: "chat",
    siteType: normalizeNamePart(record.site_type) || undefined,
    username: normalizeNamePart(accountInfo.username) || undefined,
    disabled: record.disabled === true,
  };
}

export function parseAllApiHubJson(jsonText: string): AllApiHubProvider[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid ALL-API-Hub JSON file");
  }

  const root = asRecord(parsed);
  const accountsRoot = asRecord(root.accounts);
  const accounts = Array.isArray(accountsRoot.accounts) ? accountsRoot.accounts : null;
  if (!accounts) {
    throw new Error("Invalid ALL-API-Hub backup: missing accounts.accounts");
  }

  return accounts.map(extractAccount).filter(Boolean) as AllApiHubProvider[];
}

export function stripAllApiHubApiKeys(providers: AllApiHubProvider[]): AllApiHubPreviewProvider[] {
  return providers.map(({ apiKey: _apiKey, ...rest }) => rest);
}
