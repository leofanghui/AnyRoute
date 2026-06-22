import { NextResponse } from "next/server";

import { handleChat } from "@/sse/handlers/chat";
import { extractApiKey, isValidApiKey } from "@/sse/services/auth";
import { resolveClaudeDesktopModel } from "@/shared/services/claudeDesktopConfig";

async function rejectInvalidApiKey(request: Request) {
  const apiKey = extractApiKey(request, { allowUrl: false });
  if (!apiKey) return null;
  if (await isValidApiKey(apiKey)) return null;
  return NextResponse.json({ error: { message: "Invalid API key" } }, { status: 401 });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function POST(request: Request) {
  const authError = await rejectInvalidApiKey(request);
  if (authError) return authError;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  if (typeof body.model === "string" && body.model.trim()) {
    body = {
      ...body,
      model: await resolveClaudeDesktopModel(body.model.trim()),
    };
  }

  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  const nextRequest = new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: request.signal,
  });

  return handleChat(nextRequest, {
    endpoint: "/v1/messages",
    body,
    headers: Object.fromEntries(headers.entries()),
  });
}
