/**
 * Re-exports GET/PUT from settings/compression for the context caveman config endpoint.
 * 在 Lean 模式下被 /api/context 前缀守卫拦截。
 */
import { GET as __GET, PUT as __PUT } from "@/app/api/settings/compression/route";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request, ctx?: unknown): Promise<Response> {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;
  return (__GET as (req: Request, ctx?: unknown) => Promise<Response>)(request, ctx);
}

export async function PUT(request: Request, ctx?: unknown): Promise<Response> {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;
  return (__PUT as (req: Request, ctx?: unknown) => Promise<Response>)(request, ctx);
}
