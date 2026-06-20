import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getWebSessionPoolHealth } from "@omniroute/open-sse/services/webSessionPoolHealth";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const report = getWebSessionPoolHealth();
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err) || "Failed to get session pool health" },
      { status: 500 }
    );
  }
}
