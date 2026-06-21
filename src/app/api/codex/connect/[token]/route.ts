import { NextResponse } from "next/server";
import { finalizeTokens } from "@/lib/oauth/providers";
import { persistOAuthConnection } from "@/lib/oauth/connectionPersistence";
import {
  claimDeviceFlowTicket,
  completeDeviceFlowTicket,
  peekDeviceFlowTicket,
  releaseDeviceFlowTicket,
} from "@/lib/oauth/deviceFlowTickets";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { oauthDeviceCompleteSchema } from "@/shared/validation/schemas";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";

const PROVIDER = "codex";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticket = peekDeviceFlowTicket(token);
  if (!ticket || ticket.provider !== PROVIDER || ticket.status !== "pending") {
    return NextResponse.json(
      { valid: false, error: "This link is invalid, already used, or expired." },
      { status: 404 }
    );
  }
  return NextResponse.json({
    valid: true,
    provider: ticket.provider,
    expiresAt: new Date(ticket.expiresAt).toISOString(),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let rawBody: any;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(oauthDeviceCompleteSchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const ticket = claimDeviceFlowTicket(token, PROVIDER);
  if (!ticket) {
    return NextResponse.json(
      { success: false, error: "This link is invalid, already used, or expired." },
      { status: 410 }
    );
  }

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    id_token: idToken,
    expires_in: expiresIn,
  } = validation.data;

  try {
    const tokenData = await finalizeTokens(PROVIDER, {
      access_token: accessToken,
      refresh_token: refreshToken,
      id_token: idToken,
      expires_in: expiresIn,
    });

    const connection = await persistOAuthConnection(PROVIDER, tokenData, ticket.connectionId);
    completeDeviceFlowTicket(token, {
      connectionId: connection.id,
      email: connection.email ?? null,
    });

    return NextResponse.json({
      success: true,
      connection: { id: connection.id, provider: connection.provider, email: connection.email },
    });
  } catch (err: any) {
    releaseDeviceFlowTicket(token);
    console.error("Codex public device-flow completion error:", err);
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(err?.message) || "Failed to save connection" },
      { status: 500 }
    );
  }
}
