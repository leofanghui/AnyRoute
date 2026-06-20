/**
 * GET /api/tools/traffic-inspector/requests/[id] — fetch a single intercepted request
 *
 * LOCAL_ONLY enforced by routeGuard.
 */

import { buildErrorBody } from "@omniroute/open-sse/utils/error.ts";
import { globalTrafficBuffer } from "@/mitm/inspector/buffer";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const { id } = await params;
  const entry = globalTrafficBuffer.get(id);
  if (!entry) {
    return new Response(JSON.stringify(buildErrorBody(404, "Request not found")), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  return Response.json(entry);
}
