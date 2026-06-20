import { NextResponse } from "next/server";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

/**
 * @deprecated Use /api/rate-limits instead.
 * This route redirects to the consolidated rate-limits endpoint.
 */

export async function GET(request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const url = new URL(request.url);
  url.pathname = "/api/rate-limits";
  return NextResponse.redirect(url, 308);
}

export async function POST(request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const url = new URL(request.url);
  url.pathname = "/api/rate-limits";
  return NextResponse.redirect(url, 308);
}
