/**
 * GET  /api/tools/traffic-inspector/requests — list buffer with optional filters
 * DELETE /api/tools/traffic-inspector/requests — clear the entire buffer
 *
 * LOCAL_ONLY enforced by routeGuard (no extra check needed here).
 */

import { buildErrorBody } from "@omniroute/open-sse/utils/error.ts";
import { InspectorListQuerySchema } from "@/shared/schemas/inspector";
import { globalTrafficBuffer } from "@/mitm/inspector/buffer";
import type { ListFilters } from "@/mitm/inspector/types";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request): Promise<Response> {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const url = new URL(request.url);
  const rawQuery: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    rawQuery[key] = value;
  });

  const parsed = InspectorListQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return new Response(
      JSON.stringify(buildErrorBody(400, parsed.error.issues[0]?.message ?? "Invalid query")),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const filters: ListFilters = {
    profile: parsed.data.profile,
    host: parsed.data.host,
    agent: parsed.data.agent as ListFilters["agent"],
    status: parsed.data.status,
    source: parsed.data.source,
    sessionId: parsed.data.sessionId,
  };

  const requests = globalTrafficBuffer.list(filters);
  return Response.json({ requests, total: requests.length });
}

export async function DELETE(): Promise<Response> {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  globalTrafficBuffer.clear();
  return new Response(null, { status: 204 });
}
