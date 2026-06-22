import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCliToolsAuth } from "@/lib/api/requireCliToolsAuth";
import { deleteCliToolLastConfigured, saveCliToolLastConfigured } from "@/lib/db/cliToolState";
import { ensureCliConfigWriteAllowed } from "@/shared/services/cliRuntime";
import { getOrCreateApiKey } from "@/shared/services/apiKeyResolver";
import {
  CLAUDE_DESKTOP_DEFAULT_MAPPINGS,
  getClaudeDesktopStatus,
  resetClaudeDesktopProfile,
  writeClaudeDesktopProfile,
} from "@/shared/services/claudeDesktopConfig";

const mappingSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  targetModel: z.string().min(1),
  supports1m: z.boolean().optional(),
});

const saveSchema = z.object({
  gatewayBaseUrl: z.string().url(),
  keyId: z.string().optional().nullable(),
  mappings: z.array(mappingSchema).min(1),
});

export async function GET(request: Request) {
  const authError = await requireCliToolsAuth(request);
  if (authError) return authError;

  try {
    return NextResponse.json(await getClaudeDesktopStatus());
  } catch {
    return NextResponse.json({ error: "Failed to read Claude Desktop settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireCliToolsAuth(request);
  if (authError) return authError;

  const writeGuard = ensureCliConfigWriteAllowed();
  if (writeGuard) {
    return NextResponse.json({ error: writeGuard }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const apiKey = await getOrCreateApiKey(parsed.data.keyId);
    const defaultById = new Map(
      CLAUDE_DESKTOP_DEFAULT_MAPPINGS.map((mapping) => [mapping.id, mapping])
    );
    const mappings = parsed.data.mappings.map((mapping) => ({
      ...(defaultById.get(mapping.id) || {
        id: mapping.id,
        name: mapping.name || mapping.id,
        supports1m: mapping.supports1m ?? true,
      }),
      targetModel: mapping.targetModel,
    }));

    const status = await writeClaudeDesktopProfile({
      apiKey,
      gatewayBaseUrl: parsed.data.gatewayBaseUrl,
      mappings,
    });
    saveCliToolLastConfigured("claude-desktop");
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to write Claude Desktop settings" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await requireCliToolsAuth(request);
  if (authError) return authError;

  const writeGuard = ensureCliConfigWriteAllowed();
  if (writeGuard) {
    return NextResponse.json({ error: writeGuard }, { status: 403 });
  }

  try {
    const status = await resetClaudeDesktopProfile();
    deleteCliToolLastConfigured("claude-desktop");
    return NextResponse.json({ success: true, ...status });
  } catch {
    return NextResponse.json({ error: "Failed to reset Claude Desktop settings" }, { status: 500 });
  }
}
