import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET() {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  try {
    const filePath = path.join(process.cwd(), "docs/guides/CODEX-CLI-CONFIGURATION.md");
    const content = await readFile(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: "Guide not found" }, { status: 404 });
  }
}
