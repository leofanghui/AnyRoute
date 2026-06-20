import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function POST(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const response = NextResponse.json({ success: true, message: "Shutting down..." });

  setTimeout(() => {
    process.kill(process.pid, "SIGTERM");
  }, 500);

  return response;
}
