import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { explainRouteByRequestId } from "@/lib/usage/routeExplain";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  try {
    const authError = await requireManagementAuth(request);
    if (authError) return authError;

    const { requestId } = await params;
    const explanation = await explainRouteByRequestId(requestId);

    if (!explanation) {
      return NextResponse.json({ error: "Routing decision not found" }, { status: 404 });
    }

    return NextResponse.json(explanation);
  } catch (error) {
    console.error("[API ERROR] /api/routing/decisions/[requestId] failed:", error);
    return NextResponse.json({ error: "Failed to explain routing decision" }, { status: 500 });
  }
}
