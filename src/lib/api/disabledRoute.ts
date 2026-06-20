/**
 * Lean Profile 的 410 短路 helper。
 *
 * 路由层使用方式：
 *   export async function GET(request: Request) {
 *     const guard = disabledRouteIfLean(request);
 *     if (guard) return guard;
 *     // ... 原逻辑
 *   }
 *
 * 详见：docs/security/LEAN_PROFILE.md
 */

import { CORS_HEADERS } from "@/shared/utils/cors";
import { buildErrorBody } from "@omniroute/open-sse/utils/error.ts";
import {
  isLeanMode,
  isApiPrefixAllowed,
  isV1SubpathAllowed,
} from "@/lib/config/leanProfile";

const LEAN_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "X-OmniRoute-Lean": "1",
  "X-Feature-Disabled": "1",
};

function build410(featureLabel: string): Response {
  const body = buildErrorBody(410, `Feature disabled in lean mode: ${featureLabel}`);
  return new Response(JSON.stringify(body), {
    status: 410,
    headers: { ...CORS_HEADERS, ...LEAN_HEADERS },
  });
}

/** 永远返回 410（用于硬关闭某条路由，不依赖 lean 状态） */
export function disabledRouteResponse(featureLabel = "this endpoint"): Response {
  return build410(featureLabel);
}

/** 一级前缀（/api/<prefix>/...）守卫 */
export function disabledRouteIfLean(request: Request): Response | null {
  if (!isLeanMode()) return null;
  const url = new URL(request.url);
  const segs = url.pathname.split("/").filter(Boolean);
  if (segs.length < 2 || segs[0] !== "api") return null;
  const prefix = segs[1];
  if (isApiPrefixAllowed(prefix)) return null;
  return build410(`/api/${prefix}`);
}

/** v1 子路径（/api/v1/<sub>/...）守卫 */
export function disabledV1RouteIfLean(request: Request): Response | null {
  if (!isLeanMode()) return null;
  const url = new URL(request.url);
  const segs = url.pathname.split("/").filter(Boolean);
  if (segs.length < 3 || segs[0] !== "api" || segs[1] !== "v1") return null;
  const sub = segs[2];
  if (isV1SubpathAllowed(sub)) return null;
  return build410(`/api/v1/${sub}`);
}
