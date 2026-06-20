import { NextResponse } from "next/server";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import { listEmbeddingProviders } from "@/lib/memory/embedding";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error.ts";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const providers = await listEmbeddingProviders();
    return NextResponse.json({ providers });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
