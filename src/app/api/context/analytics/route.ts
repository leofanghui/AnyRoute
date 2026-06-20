/**
 * Re-exports the GET function from the analytics/compression route for the context analytics endpoint.
 * 在 Lean 模式下被 /api/context 前缀守卫拦截。
 */
import { GET as __GET } from "@/app/api/analytics/compression/route";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request, ctx?: unknown): Promise<Response> {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;
  return (__GET as (req: Request, ctx?: unknown) => Promise<Response>)(request, ctx);
}
