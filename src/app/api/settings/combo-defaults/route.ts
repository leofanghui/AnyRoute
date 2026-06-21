import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { updateComboDefaultsSchema } from "@/shared/validation/schemas";

const LEGACY_COMBO_RESILIENCE_KEYS = new Set([
  "timeoutMs",
  "healthCheckEnabled",
  "healthCheckTimeoutMs",
]);

function sanitizeComboRuntimeConfig(config?: Record<string, any> | null) {
  if (!config || typeof config !== "object") return {};
  return Object.fromEntries(
    Object.entries(config).filter(
      ([key, value]) =>
        value !== undefined && value !== null && !LEGACY_COMBO_RESILIENCE_KEYS.has(key)
    )
  );
}

function sanitizeProviderOverrides(overrides?: Record<string, any> | null) {
  if (!overrides || typeof overrides !== "object") return {};
  return Object.fromEntries(
    Object.entries(overrides).map(([providerId, config]) => [
      providerId,
      sanitizeComboRuntimeConfig(config),
    ])
  );
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const settings: any = await getSettings();
    const comboDefaults = sanitizeComboRuntimeConfig(settings.comboDefaults);
    const providerOverrides = sanitizeProviderOverrides(settings.providerOverrides);
    return NextResponse.json({
      comboDefaults:
        Object.keys(comboDefaults).length > 0
          ? comboDefaults
          : {
              strategy: "priority",
              maxRetries: 1,
              retryDelayMs: 2000,
              fallbackDelayMs: 0,
              handoffThreshold: 0.85,
              handoffModel: "",
              maxMessagesForSummary: 30,
              maxComboDepth: 3,
              trackMetrics: true,
              reasoningTokenBufferEnabled: true,
              zeroLatencyOptimizationsEnabled: false,
            },
      providerOverrides,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch combo defaults" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
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
    const validation = validateBody(updateComboDefaultsSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const body = validation.data;
    const updates: Record<string, any> = {};
    if (body.comboDefaults) {
      updates.comboDefaults = sanitizeComboRuntimeConfig(body.comboDefaults);
    }
    if (body.providerOverrides) {
      updates.providerOverrides = sanitizeProviderOverrides(body.providerOverrides);
    }

    const settings: any = await updateSettings(updates);
    return NextResponse.json({
      comboDefaults: sanitizeComboRuntimeConfig(settings.comboDefaults),
      providerOverrides: sanitizeProviderOverrides(settings.providerOverrides),
    });
  } catch {
    return NextResponse.json({ error: "Failed to update combo defaults" }, { status: 500 });
  }
}
