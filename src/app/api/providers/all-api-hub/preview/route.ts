import { NextResponse } from "next/server";
import { z } from "zod";

import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { parseAllApiHubJson, stripAllApiHubApiKeys } from "@/lib/import/allApiHubParser";
import { buildErrorBody } from "@omniroute/open-sse/utils/error";

const JSON_BODY_LIMIT = 11 * 1024 * 1024;

const previewSchema = z.object({
  json: z.string().max(JSON_BODY_LIMIT),
});

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(buildErrorBody(400, "Invalid JSON body"), { status: 400 });
  }

  const parsed = previewSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(buildErrorBody(400, "Validation failed"), { status: 400 });
  }

  try {
    const providers = parseAllApiHubJson(parsed.data.json);
    return NextResponse.json({
      providers: stripAllApiHubApiKeys(providers),
      source: "all-api-hub",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse ALL-API-Hub data";
    return NextResponse.json(buildErrorBody(400, message), { status: 400 });
  }
}
