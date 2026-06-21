import test from "node:test";
import assert from "node:assert/strict";

import {
  buildApiKeyCreateScopes,
  mergeApiKeyPermissionScopes,
} from "../../src/app/(dashboard)/dashboard/api-manager/apiManagerScopes.ts";
import { SELF_USAGE_SCOPE } from "../../src/shared/constants/selfServiceScopes.ts";

test("create scopes enable own usage by default", () => {
  assert.deepEqual(buildApiKeyCreateScopes({ manageEnabled: false }), [SELF_USAGE_SCOPE]);
  assert.deepEqual(buildApiKeyCreateScopes({ manageEnabled: true }), ["manage", SELF_USAGE_SCOPE]);
  assert.deepEqual(
    buildApiKeyCreateScopes({
      manageEnabled: false,
      selfUsageEnabled: false,
    }),
    []
  );
});

test("permission scope merge preserves unrelated scopes while toggling managed scopes", () => {
  const scopes = mergeApiKeyPermissionScopes(["custom:scope", SELF_USAGE_SCOPE], {
    manageEnabled: true,
    selfUsageEnabled: true,
  });

  assert.deepEqual(scopes, ["custom:scope", SELF_USAGE_SCOPE, "manage"]);
});

test("permission scope merge removes own usage when disabled", () => {
  const scopes = mergeApiKeyPermissionScopes(["custom:scope", SELF_USAGE_SCOPE], {
    manageEnabled: false,
    selfUsageEnabled: false,
  });

  assert.deepEqual(scopes, ["custom:scope"]);
});
