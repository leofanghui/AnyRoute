import { CORS_HEADERS } from "@/shared/utils/cors";
import { ollamaModels } from "@omniroute/open-sse/config/ollamaModels.ts";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function GET() {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  return new Response(JSON.stringify(ollamaModels), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
