import { NextResponse } from "next/server";
import { enableTailscaleTunnel } from "@/lib/tailscaleTunnel";
import { parseOptionalJsonBody, requireTailscaleAuth, tailscaleEnableSchema } from "../routeUtils";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireTailscaleAuth(request);
  if (authError) return authError;

  const parsed = await parseOptionalJsonBody(request, tailscaleEnableSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const result = await enableTailscaleTunnel(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to enable Tailscale Funnel",
      },
      { status: 500 }
    );
  }
}
