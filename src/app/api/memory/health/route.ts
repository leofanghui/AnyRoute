import { NextResponse } from "next/server";
import { verifyExtractionPipeline } from "@/lib/memory/verify";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  try {
    const result = await verifyExtractionPipeline("health-check");
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { working: false, latencyMs: 0, error: sanitizeErrorMessage(err) },
      { status: 500 }
    );
  }
}
