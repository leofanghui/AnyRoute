/**
 * Lean Profile 配置 — chat-only 路由器主线开关。
 *
 * 通过 OMNIROUTE_LEAN_MODE=1 一键收敛到主线版本。所有旁支模块源代码原样保留，
 * 仅在注册表 / 路由 / 导航三层按白名单过滤。设为 0/false 或不设可恢复完整功能。
 *
 * 后续要加回某个功能：把对应键加进相应白名单即可，无需改业务代码。
 *
 * 详见：docs/security/LEAN_PROFILE.md
 */

import type { RoutingStrategyValue } from "@/shared/constants/routingStrategies";
import type { HideableSidebarItemId } from "@/shared/constants/sidebarVisibility";

export function isLeanMode(): boolean {
  const raw = process.env.OMNIROUTE_LEAN_MODE;
  if (typeof raw !== "string") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** 主线必留的 open-sse executor 注册键（含别名） */
export const LEAN_ALLOWED_EXECUTORS: ReadonlySet<string> = new Set([
  "codex",
  "bedrock",
  "vertex",
  "vertex-partner",
  "azure-openai",
  "cloudflare-ai",
  "cf",
  "gemini-business",
  "gembiz",
]);

/** 主线必留的一级 /api/<前缀>/ */
export const LEAN_ALLOWED_API_PREFIXES: ReadonlySet<string> = new Set([
  "v1",
  "auth",
  "init",
  "health",
  "monitoring",
  "providers",
  "keys",
  "models",
  "settings",
  "oauth",
  "admin",
  "internal",
]);

/** 主线必留的 /api/v1/<子路径>/ */
export const LEAN_ALLOWED_V1_SUBPATHS: ReadonlySet<string> = new Set([
  "chat",
  "messages",
  "responses",
  "completions",
  "models",
  "me",
  "_helpers",
  "_shared",
]);

/** 主线必留的 combo 路由策略（依赖 web/TLS client 的策略已剔除） */
export const LEAN_ALLOWED_ROUTING_STRATEGIES: ReadonlySet<RoutingStrategyValue> =
  new Set<RoutingStrategyValue>([
    "priority",
    "weighted",
    "round-robin",
    "fill-first",
    "p2c",
    "random",
    "least-used",
    "cost-optimized",
    "reset-aware",
    "reset-window",
    "strict-random",
    "auto",
    "lkgp",
  ]);

/** Lean 模式下隐藏的侧边栏项 ID */
export const LEAN_HIDDEN_SIDEBAR_ITEMS: ReadonlySet<HideableSidebarItemId> =
  new Set<HideableSidebarItemId>([
    "embedded-services",
    "combos",
    "combos-live",
    "quota",
    "context-settings",
    "context-caveman",
    "context-rtk",
    "context-headroom",
    "context-session-dedup",
    "context-ccr",
    "context-llmlingua",
    "context-lite",
    "context-aggressive",
    "context-ultra",
    "context-combos",
    "compression-studio",
    "cli-code",
    "cli-agents",
    "acp-agents",
    "cloud-agents",
    "agent-bridge",
    "traffic-inspector",
    "api-endpoints",
    "webhooks",
    "proxy",
    "mitm-proxy",
    "1proxy",
    "analytics",
    "analytics-combo-health",
    "analytics-utilization",
    "costs",
    "cache",
    "analytics-compression",
    "analytics-search",
    "analytics-evals",
    "provider-stats",
    "activity",
    "logs-proxy",
    "logs-console",
    "logs-activity",
    "costs-pricing",
    "costs-budget",
    "costs-free-tiers",
    "costs-quota-share",
    "free-provider-rankings",
    "audit",
    "audit-mcp",
    "audit-a2a",
    "translator",
    "playground",
    "search-tools",
    "memory",
    "skills",
    "agent-skills",
    "mcp",
    "a2a",
    "plugins",
    "leaderboard",
    "profile",
  ] as HideableSidebarItemId[]);

export function isExecutorAllowed(key: string): boolean {
  if (!isLeanMode()) return true;
  return LEAN_ALLOWED_EXECUTORS.has(key);
}

export function isApiPrefixAllowed(prefix: string): boolean {
  if (!isLeanMode()) return true;
  return LEAN_ALLOWED_API_PREFIXES.has(prefix);
}

export function isV1SubpathAllowed(sub: string): boolean {
  if (!isLeanMode()) return true;
  return LEAN_ALLOWED_V1_SUBPATHS.has(sub);
}

export function isRoutingStrategyAllowed(s: string): boolean {
  if (!isLeanMode()) return true;
  return LEAN_ALLOWED_ROUTING_STRATEGIES.has(s as RoutingStrategyValue);
}

export function isSidebarItemHiddenByLean(id: string): boolean {
  if (!isLeanMode()) return false;
  return LEAN_HIDDEN_SIDEBAR_ITEMS.has(id as HideableSidebarItemId);
}
