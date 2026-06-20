/**
 * POST /api/tools/agent-bridge/cert/regenerate
 * Regenerates the MITM self-signed certificate. Overwrites the existing one.
 * LOCAL_ONLY: registered in routeGuard.ts
 */
import { generateCert } from "@/mitm/cert/generate";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { createErrorResponse } from "@/lib/api/errorResponse";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function POST(): Promise<Response> {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  try {
    // generateCert checks for existing files — force-regenerate by deleting first
    // is not in scope; the function is idempotent (returns existing paths). If a
    // caller needs a fresh cert they must delete the old one manually. We expose
    // whatever generateCert decides.
    const result = await generateCert();
    return Response.json({ ok: true, certPath: result.cert, keyPath: result.key });
  } catch (err) {
    const msg = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
    return createErrorResponse({ status: 500, message: msg });
  }
}
