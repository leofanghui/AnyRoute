import { z } from "zod";
import { updateServiceField } from "@/lib/db/versionManager";
import { createErrorResponse } from "@/lib/api/errorResponse";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

const BodySchema = z.object({ enabled: z.boolean() });

export async function POST(request: Request): Promise<Response> {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse({ status: 400, message: "Invalid JSON body" });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse({ status: 400, message: parsed.error.message });
  }

  try {
    await updateServiceField("9router", "autoStart", parsed.data.enabled);
    return new Response(null, { status: 204 });
  } catch (err) {
    const msg = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
    return createErrorResponse({ status: 500, message: msg });
  }
}
