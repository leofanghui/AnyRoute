import { NextResponse } from "next/server";
import { MCP_TOOLS, MCP_TOOL_MAP } from "@omniroute/open-sse/mcp-server/schemas/tools";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  try {
    return NextResponse.json({
      total: MCP_TOOLS.length,
      mappedTotal: Object.keys(MCP_TOOL_MAP).length,
      tools: MCP_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        scopes: [...tool.scopes],
        phase: tool.phase,
        auditLevel: tool.auditLevel,
        sourceEndpoints: [...tool.sourceEndpoints],
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load MCP tools";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
