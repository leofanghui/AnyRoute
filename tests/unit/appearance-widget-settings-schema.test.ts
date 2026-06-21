import test from "node:test";
import assert from "node:assert/strict";

import { updateSettingsSchema } from "../../src/shared/validation/settingsSchemas.ts";

test("appearance widget visibility settings are accepted by the settings PATCH schema", () => {
  const validation = updateSettingsSchema.safeParse({
    pinProviderQuotaToHome: true,
    showQuickStartOnHome: false,
    showProviderTopologyOnHome: true,
  });

  assert.equal(validation.success, true);
  if (!validation.success) return;
  assert.equal(validation.data.pinProviderQuotaToHome, true);
  assert.equal(validation.data.showQuickStartOnHome, false);
  assert.equal(validation.data.showProviderTopologyOnHome, true);
});

test("appearance widget visibility settings default to undefined when not provided", () => {
  const validation = updateSettingsSchema.safeParse({});

  assert.equal(validation.success, true);
  if (!validation.success) return;
  assert.equal(validation.data.pinProviderQuotaToHome, undefined);
  assert.equal(validation.data.showQuickStartOnHome, undefined);
  assert.equal(validation.data.showProviderTopologyOnHome, undefined);
});

test("appearance widget visibility settings reject non-boolean values", () => {
  const validation = updateSettingsSchema.safeParse({
    pinProviderQuotaToHome: "yes",
    showQuickStartOnHome: "no",
  });

  assert.equal(validation.success, false);
});

test("localOnlyManageScopeBypass settings are accepted by the settings PATCH schema", () => {
  const validation = updateSettingsSchema.safeParse({
    localOnlyManageScopeBypassEnabled: true,
    localOnlyManageScopeBypassPrefixes: ["/api/internal/codex-responses-ws/"],
  });

  assert.equal(validation.success, true);
  if (!validation.success) return;
  assert.equal(validation.data.localOnlyManageScopeBypassEnabled, true);
  assert.deepEqual(validation.data.localOnlyManageScopeBypassPrefixes, [
    "/api/internal/codex-responses-ws/",
  ]);
});

test("localOnlyManageScopeBypassPrefixes rejects spawn-capable prefixes (BYPASS_PREFIX_NOT_ALLOWED)", () => {
  const validation = updateSettingsSchema.safeParse({
    localOnlyManageScopeBypassEnabled: true,
    localOnlyManageScopeBypassPrefixes: [
      "/api/internal/codex-responses-ws/",
      "/api/system/version",
    ],
  });

  assert.equal(validation.success, false);
  if (validation.success) return;
  assert.ok(
    validation.error.issues.some((i) => i.message.includes("BYPASS_PREFIX_NOT_ALLOWED")),
    "expected a BYPASS_PREFIX_NOT_ALLOWED issue for the spawn-capable prefix"
  );
});

test("localOnlyManageScopeBypassEnabled rejects non-boolean values", () => {
  const validation = updateSettingsSchema.safeParse({
    localOnlyManageScopeBypassEnabled: "yes",
  });

  assert.equal(validation.success, false);
});

test("localOnlyManageScopeBypassPrefixes rejects non-array values", () => {
  const validation = updateSettingsSchema.safeParse({
    localOnlyManageScopeBypassPrefixes: "/api/internal/codex-responses-ws/",
  });

  assert.equal(validation.success, false);
});
