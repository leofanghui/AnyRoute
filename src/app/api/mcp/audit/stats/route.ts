import { NextResponse } from "next/server";
import { getAuditStats } from "@omniroute/open-sse/mcp-server/audit";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  try {
    const stats = await getAuditStats();
    return NextResponse.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load MCP audit stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
