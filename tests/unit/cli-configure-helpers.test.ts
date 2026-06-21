import test from "node:test";
import assert from "node:assert/strict";
import { profileNameFromModel } from "../../bin/cli/commands/configure.mjs";

test("profileNameFromModel strips the provider prefix and non-alphanumerics", () => {
  assert.equal(profileNameFromModel("glm/glm-5.2"), "glm52");
  assert.equal(profileNameFromModel("kmc/kimi-k2.7"), "kimik27");
  assert.equal(profileNameFromModel("ollamacloud/gpt-oss:20b"), "gptoss20b");
  assert.equal(profileNameFromModel("cx/gpt-5.5"), "gpt55");
  assert.equal(profileNameFromModel("bare-model"), "baremodel");
});
