import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_SELF_SERVICE_SCOPES,
  SELF_USAGE_SCOPE,
  hasSelfUsageScope,
  normalizeSelfServiceScopesForCreate,
} from "../../src/shared/constants/selfServiceScopes.ts";
import {
  createKeySchema,
  updateKeyPermissionsSchema,
} from "../../src/shared/validation/schemas.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("self-service scope constants are distinct and usage defaults on create", () => {
  assert.equal(SELF_USAGE_SCOPE, "self:usage");
  assert.deepEqual(DEFAULT_SELF_SERVICE_SCOPES, [SELF_USAGE_SCOPE]);

  assert.deepEqual(normalizeSelfServiceScopesForCreate(undefined), [SELF_USAGE_SCOPE]);
  assert.deepEqual(normalizeSelfServiceScopesForCreate([]), [SELF_USAGE_SCOPE]);
  assert.deepEqual(normalizeSelfServiceScopesForCreate(["manage"]), ["manage", SELF_USAGE_SCOPE]);
});

test("self-service scope helper detects own-usage visibility", () => {
  assert.equal(hasSelfUsageScope([SELF_USAGE_SCOPE]), true);
  assert.equal(hasSelfUsageScope(["manage"]), false);
});

test("api key validation accepts more than sixteen scopes", () => {
  const scopes = Array.from({ length: 18 }, (_, index) => `custom:${index}`);

  assert.equal(createKeySchema.safeParse({ name: "heavy-scope-key", scopes }).success, true);
  assert.equal(updateKeyPermissionsSchema.safeParse({ scopes }).success, true);
});

test("api key create route normalizes omitted scopes to self-service usage", () => {
  const source = fs.readFileSync(path.join(repoRoot, "src/app/api/keys/route.ts"), "utf8");

  assert.match(source, /normalizeSelfServiceScopesForCreate/);
  assert.ok(
    source.indexOf("normalizeSelfServiceScopesForCreate(scopes)") <
      source.indexOf("createApiKey(name, machineId"),
    "create route must add default self-service scope before persistence"
  );
});
