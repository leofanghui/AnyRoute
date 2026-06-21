import test from "node:test";
import assert from "node:assert/strict";

const sidebarVisibility = await import("../../src/shared/constants/sidebarVisibility.ts");

test("minimal profile does not keep removed sidebar item IDs", () => {
  const retainedIds = sidebarVisibility.HIDEABLE_SIDEBAR_ITEM_IDS as readonly string[];

  for (const removedId of ["activity", "logs-activity", "costs-pricing", "costs-budget"]) {
    assert.equal(
      retainedIds.includes(removedId),
      false,
      `${removedId} should not remain in minimal sidebar IDs`
    );
  }
});

test("legacy sidebar preset names normalize to the minimal profile", () => {
  for (const legacyId of ["all", "developer", "admin"]) {
    assert.equal(sidebarVisibility.normalizeSidebarPresetId(legacyId), "minimal");
  }
});

test("unknown sidebar preset names are dropped", () => {
  assert.equal(sidebarVisibility.normalizeSidebarPresetId("unknown"), null);
  assert.equal(sidebarVisibility.normalizeSidebarPresetId(null), null);
});
