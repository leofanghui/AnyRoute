import assert from "node:assert/strict";
import test from "node:test";

import { diagnoseUserFacingError } from "../../src/shared/utils/errorDiagnosis.ts";

test("diagnoseUserFacingError marks upstream account-pool exhaustion", () => {
  const diagnosis = diagnoseUserFacingError({
    status: 503,
    message: "[503]: No available accounts",
  });

  assert.equal(diagnosis?.kind, "upstream_pool_unavailable");
  assert.equal(diagnosis?.label, "上游池无可用账号/资源不足");
});

test("diagnoseUserFacingError classifies common auth and permission errors", () => {
  assert.equal(
    diagnoseUserFacingError({ status: 401, message: "Invalid API key" })?.kind,
    "auth_failed"
  );
  assert.equal(
    diagnoseUserFacingError({ status: 403, message: "permission denied" })?.kind,
    "permission_denied"
  );
});

test("diagnoseUserFacingError classifies model and quota errors", () => {
  assert.equal(
    diagnoseUserFacingError({ status: 403, message: "model may not exist or not have access" })
      ?.kind,
    "model_unavailable"
  );
  assert.equal(
    diagnoseUserFacingError({ status: 429, message: "insufficient credits" })?.kind,
    "rate_or_quota_limited"
  );
});

test("diagnoseUserFacingError keeps context overflow more specific than generic exceeded", () => {
  assert.equal(
    diagnoseUserFacingError({ status: 400, message: "context length exceeded" })?.kind,
    "context_overflow"
  );
});

test("diagnoseUserFacingError uses pipeline provider status when list status is missing", () => {
  const diagnosis = diagnoseUserFacingError({
    pipelinePayloads: {
      providerResponse: { status: 503, body: { error: "service unavailable" } },
    },
  });

  assert.equal(diagnosis?.kind, "upstream_unavailable");
});
