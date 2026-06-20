import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getCallLogById } from "@/lib/usageDb";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request, { params }) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  try {
    const authError = await requireManagementAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const log = await getCallLogById(id);

    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    return NextResponse.json(log);
  } catch (error) {
    console.error("[API ERROR] /api/usage/call-logs/[id] failed:", error);
    return NextResponse.json({ error: "Failed to fetch log" }, { status: 500 });
  }
}
