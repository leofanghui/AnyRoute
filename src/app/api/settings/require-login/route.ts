import { NextResponse } from "next/server";

import { getSettings, updateSettings } from "@/lib/db/settings";
import {
  hasManagementPasswordConfigured,
  hashManagementPassword,
} from "@/lib/auth/managementPassword";
import { updateRequireLoginSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import { getNodeRuntimeSupport } from "@/shared/utils/nodeRuntimeSupport.ts";

function getNodeCompatibility() {
  const { nodeVersion, nodeCompatible } = getNodeRuntimeSupport();
  return { nodeVersion, nodeCompatible };
}

function isBootstrapSecurityWindow(settings: Record<string, unknown>) {
  return !hasManagementPasswordConfigured(settings);
}

export async function GET() {
  const nodeInfo = getNodeCompatibility();

  try {
    const settings = await getSettings();
    const requireLogin = settings.requireLogin !== false;
    const hasPassword = hasManagementPasswordConfigured(settings);
    const setupComplete = settings.setupComplete === true;

    return NextResponse.json({ requireLogin, hasPassword, setupComplete, ...nodeInfo });
  } catch (error) {
    console.error("[API] Error fetching require-login settings:", error);
    return NextResponse.json(
      { requireLogin: true, hasPassword: true, setupComplete: true, ...nodeInfo },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  const settings = await getSettings();
  if (!isBootstrapSecurityWindow(settings) && !(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(updateRequireLoginSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof validation.data.requireLogin === "boolean") {
      updates.requireLogin = validation.data.requireLogin;
    }
    if (validation.data.password) {
      updates.password = await hashManagementPassword(validation.data.password);
    }

    await updateSettings(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error updating require-login settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
