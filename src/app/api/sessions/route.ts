import { NextResponse } from "next/server";
import {
  getActiveSessions,
  getActiveSessionCount,
  getAllActiveSessionCountsByKey,
} from "@omniroute/open-sse/services/sessionManager.ts";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET() {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  try {
    const sessions = getActiveSessions();
    const count = getActiveSessionCount();
    const byApiKey = getAllActiveSessionCountsByKey();
    return NextResponse.json({ count, sessions, byApiKey });
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error) }, { status: 500 });
  }
}
