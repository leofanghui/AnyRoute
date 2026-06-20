import { NextResponse } from "next/server";
import {
  getRtkFilterCatalog,
  getRtkFilterLoadDiagnostics,
} from "@omniroute/open-sse/services/compression/engines/rtk/filterLoader";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return NextResponse.json({
    filters: getRtkFilterCatalog(),
    diagnostics: getRtkFilterLoadDiagnostics(),
  });
}
