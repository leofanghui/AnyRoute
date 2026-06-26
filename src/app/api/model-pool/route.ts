import { NextResponse } from "next/server";

import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { buildModelPoolSources, normalizeModelPoolClient } from "@/lib/modelPoolSources";
import { buildModelPoolOptions } from "@/shared/utils/modelPool";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const client = normalizeModelPoolClient(searchParams.get("client"));
    const sources = await buildModelPoolSources({ client });
    const models = buildModelPoolOptions(sources, client, { requireVerified: true });
    const verifiedSources = models.flatMap((model) => model.sources);
    return NextResponse.json({
      models,
      sources: verifiedSources,
      total: models.length,
      sourceTotal: verifiedSources.length,
    });
  } catch (error) {
    console.log("Error building model pool:", error);
    return NextResponse.json({ error: "Failed to build model pool" }, { status: 500 });
  }
}
