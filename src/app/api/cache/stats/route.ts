import { NextRequest, NextResponse } from "next/server";
import { getPromptCache } from "@/lib/cacheLayer";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error.ts";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(req: NextRequest) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cache = getPromptCache();
    const stats = cache.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cache = getPromptCache();
    cache.clear();
    return NextResponse.json({ success: true, message: "Cache cleared" });
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error) }, { status: 500 });
  }
}
