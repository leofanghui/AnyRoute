export const SELF_USAGE_SCOPE = "self:usage";

export const DEFAULT_SELF_SERVICE_SCOPES = [SELF_USAGE_SCOPE] as const;

export function hasSelfUsageScope(scopes: readonly string[] | null | undefined): boolean {
  return Array.isArray(scopes) && scopes.includes(SELF_USAGE_SCOPE);
}

export function normalizeSelfServiceScopesForCreate(
  scopes: readonly string[] | null | undefined
): string[] {
  const normalized = new Set((scopes ?? []).filter((scope) => typeof scope === "string" && scope));
  normalized.add(SELF_USAGE_SCOPE);
  return [...normalized];
}
