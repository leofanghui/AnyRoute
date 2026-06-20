import { NextResponse } from "next/server";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import { engineStatus } from "@/lib/memory/retrieval";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error.ts";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await engineStatus();
    return NextResponse.json(status);
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
