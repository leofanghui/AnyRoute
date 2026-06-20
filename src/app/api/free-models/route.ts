import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { FREE_MODEL_BUDGETS } from "@omniroute/open-sse/config/freeModelCatalog";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

// GET /api/free-models - List free model budgets for plugin enrichment
export async function GET(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const models = FREE_MODEL_BUDGETS.map((m) => ({
      provider: m.provider,
      modelId: m.modelId,
      displayName: m.displayName,
      monthlyTokens: m.monthlyTokens,
      creditTokens: m.creditTokens,
      freeType: m.freeType,
      poolKey: m.poolKey,
      tos: m.tos,
    }));

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Error fetching free models:", error);
    return NextResponse.json({ models: [] });
  }
}
