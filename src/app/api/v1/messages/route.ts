import { handleChat } from "@/sse/handlers/chat";
import { handleCorsOptions } from "@/shared/utils/cors";
import { withInjectionGuard } from "@/middleware/promptInjectionGuard";

export async function OPTIONS() {
  return handleCorsOptions();
}

async function postHandler(request: Request) {
  let body: Record<string, unknown> | null = null;
  try {
    body = await request
      .clone()
      .json()
      .catch(() => null);
  } catch {
    body = null;
  }

  return handleChat(request, {
    endpoint: "/v1/messages",
    ...(body ? { body } : {}),
    headers: Object.fromEntries(request.headers.entries()),
  });
}

export const POST = withInjectionGuard(postHandler);
