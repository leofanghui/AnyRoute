/**
 * Endpoint Category Definitions — API key endpoint restrictions.
 *
 * Each category maps a stable ID to a set of `/v1/` route prefixes.
 * The `resolveEndpointCategory()` function maps an incoming request path
 * to its category for policy enforcement.
 *
 * Empty `allowedEndpoints` on a key = all endpoints allowed (backward compatible).
 *
 * @module shared/constants/endpointCategories
 */

export interface EndpointCategory {
  id: string;
  label: string;
  description: string;
  prefixes: string[];
}

export const ENDPOINT_CATEGORIES: readonly EndpointCategory[] = [
  {
    id: "chat",
    label: "Chat / Responses",
    description: "Chat completions and Responses API requests",
    prefixes: ["/v1/chat/completions", "/v1/responses"],
  },
  {
    id: "models",
    label: "Models",
    description: "List available models (read-only)",
    prefixes: ["/v1/models"],
  },
] as const;

/**
 * Sorted longest-prefix-first so the most specific match wins
 * (e.g. `/v1/chat/completions` before `/v1/chat`).
 */
const SORTED_PREFIXES: readonly { prefix: string; categoryId: string }[] =
  ENDPOINT_CATEGORIES.flatMap((cat) =>
    cat.prefixes.map((prefix) => ({ prefix, categoryId: cat.id }))
  ).sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Map a request pathname to its endpoint category ID.
 * Returns `null` if the path doesn't match any category (e.g. management routes).
 */
export function resolveEndpointCategory(pathname: string): string | null {
  for (const { prefix, categoryId } of SORTED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return categoryId;
    }
  }
  return null;
}
