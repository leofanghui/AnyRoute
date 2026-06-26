import test from "node:test";
import assert from "node:assert/strict";

import { buildInternalRequest } from "../../src/app/api/cli-tools/verify/route.ts";

test("cli tool verification forwards a forced connection id", () => {
  const request = buildInternalRequest(
    "/v1/messages",
    { model: "gateway/claude-sonnet-4", messages: [] },
    new AbortController().signal,
    "conn-cli-verify"
  );

  assert.equal(request.headers.get("x-omniroute-connection"), "conn-cli-verify");
  assert.equal(request.headers.get("x-internal-test"), "cli-tool-verify");
});
