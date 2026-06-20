import { NextResponse } from "next/server";
import { getDiversityReport } from "../../../../../open-sse/services/autoCombo/providerDiversity";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export const dynamic = "force-dynamic";

export async function GET() {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  try {
    const report = getDiversityReport();
    return NextResponse.json(report);
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(error) }, { status: 500 });
  }
}
