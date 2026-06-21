import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  setTimeout(() => {
    process.kill(process.pid, "SIGTERM");
  }, 500);

  return NextResponse.json({ status: "restarting" });
}
