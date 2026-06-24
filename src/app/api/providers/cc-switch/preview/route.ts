import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { buildErrorBody } from "@omniroute/open-sse/utils/error";
import {
  getCcSwitchDbPath,
  parseCcSwitchDb,
  parseCcSwitchSql,
  stripApiKeys,
} from "@/lib/import/ccSwitchParser";

const SQL_BODY_LIMIT = 11 * 1024 * 1024;

const previewSchema = z.object({
  source: z.enum(["local", "upload"]).default("local"),
  sql: z.string().max(SQL_BODY_LIMIT).optional(),
});

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) rawBody = JSON.parse(text);
  } catch {
    return NextResponse.json(buildErrorBody(400, "Invalid JSON body"), { status: 400 });
  }

  const parsed = previewSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(buildErrorBody(400, "Validation failed"), { status: 400 });
  }

  const { source, sql } = parsed.data;

  try {
    if (source === "upload") {
      if (!sql || !sql.trim()) {
        return NextResponse.json(buildErrorBody(400, "Missing sql field for upload source"), {
          status: 400,
        });
      }
      const providers = await parseCcSwitchSql(sql);
      return NextResponse.json({ providers: stripApiKeys(providers), source: "upload" });
    }

    const dbPath = getCcSwitchDbPath();
    let buffer: Buffer;
    try {
      buffer = (await fs.readFile(dbPath)) as Buffer;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        return NextResponse.json(
          { error: "No local cc-switch installation found", code: "no_local_db", path: dbPath },
          { status: 404 }
        );
      }
      return NextResponse.json(buildErrorBody(500, "Could not read cc-switch database"), {
        status: 500,
      });
    }

    const providers = await parseCcSwitchDb(buffer);
    return NextResponse.json({ providers: stripApiKeys(providers), source: "local" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse cc-switch data";
    return NextResponse.json(buildErrorBody(400, message), { status: 400 });
  }
}
