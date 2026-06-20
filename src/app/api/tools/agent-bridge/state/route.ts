/**
 * GET /api/tools/agent-bridge/state
 * Returns global MITM server status + per-agent detection/status.
 * LOCAL_ONLY: registered in routeGuard.ts
 */
import { getMitmStatus, getAllAgentsStatus } from "@/mitm/manager";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { createErrorResponse } from "@/lib/api/errorResponse";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(): Promise<Response> {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  try {
    const [server, agents] = await Promise.all([getMitmStatus(), getAllAgentsStatus()]);
    return Response.json({ server, agents });
  } catch (err) {
    const msg = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
    return createErrorResponse({ status: 500, message: msg });
  }
}
