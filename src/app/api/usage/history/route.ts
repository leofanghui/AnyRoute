import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getUsageStats } from "@/lib/usageDb";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const stats = await getUsageStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching usage stats:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}
