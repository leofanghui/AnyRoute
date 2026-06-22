import { NextResponse } from "next/server";

import { extractApiKey, isValidApiKey } from "@/sse/services/auth";
import { getClaudeDesktopStatus } from "@/shared/services/claudeDesktopConfig";

async function rejectInvalidApiKey(request: Request) {
  const apiKey = extractApiKey(request, { allowUrl: false });
  if (!apiKey) return null;
  if (await isValidApiKey(apiKey)) return null;
  return NextResponse.json({ error: { message: "Invalid API key" } }, { status: 401 });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function GET(request: Request) {
  const authError = await rejectInvalidApiKey(request);
  if (authError) return authError;

  const status = await getClaudeDesktopStatus();
  const models = status.mappings.map((mapping) => ({
    type: "model",
    id: mapping.id,
    display_name: mapping.targetModel,
    created_at: "2024-01-01T00:00:00Z",
    supports1m: mapping.supports1m,
  }));

  return NextResponse.json({
    data: models,
    has_more: false,
    first_id: models[0]?.id ?? null,
    last_id: models[models.length - 1]?.id ?? null,
  });
}
