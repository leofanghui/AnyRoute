import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getCavemanRuleMetadata } from "@omniroute/open-sse/services/compression/cavemanRules";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(req: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(req);
  if (authError) return authError;

  return NextResponse.json({
    rules: getCavemanRuleMetadata(),
  });
}
