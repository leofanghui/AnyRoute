import test from "node:test";
import assert from "node:assert/strict";

const { createProviderSchema, providersBatchTestSchema } =
  await import("../../src/shared/validation/schemas.ts");
const { providerAllowsOptionalApiKey } = await import("../../src/shared/constants/providers.ts");

test("Pollinations is treated as a keyless-capable provider", () => {
  assert.equal(providerAllowsOptionalApiKey("pollinations"), true);
});

test("createProviderSchema allows Pollinations without apiKey", () => {
  const result = createProviderSchema.safeParse({
    provider: "pollinations",
    name: "Pollinations",
  });

  assert.equal(result.success, true);
});

test("providersBatchTestSchema rejects unknown batch modes", () => {
  const result = providersBatchTestSchema.safeParse({
    mode: "not-a-mode",
  });

  assert.equal(result.success, false);
});
