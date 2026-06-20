import { getSyncedAvailableModels, getAllSyncedAvailableModels } from "@/lib/db/models";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

/**
 * GET /api/synced-available-models?provider=<id>
 * List synced available models for a provider (or all providers).
 */
export async function GET(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  try {
    if (!(await isAuthenticated(request))) {
      return Response.json(
        { error: { message: "Authentication required", type: "invalid_api_key" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (provider) {
      const models = await getSyncedAvailableModels(provider);
      return Response.json({ models });
    }

    const allModels = await getAllSyncedAvailableModels();
    return Response.json(allModels);
  } catch {
    return Response.json(
      { error: { message: "Failed to fetch synced available models", type: "server_error" } },
      { status: 500 }
    );
  }
}
