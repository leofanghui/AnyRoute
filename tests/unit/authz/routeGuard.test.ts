import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLocalOnlyPath,
  isLocalOnlyBypassableByManageScope,
  isAlwaysProtectedPath,
  isLoopbackHost,
} from "../../../src/server/authz/routeGuard.ts";
import { managementPolicy } from "../../../src/server/authz/policies/management.ts";
import { getMachineTokenSync } from "../../../src/lib/machineToken.ts";
import { CLI_TOKEN_HEADER } from "../../../src/server/authz/headers.ts";

test("isLocalOnlyPath: minimal local-only routes remain protected", () => {
  assert.equal(isLocalOnlyPath("/api/system/version"), true);
  assert.equal(isLocalOnlyPath("/api/system/version/check"), true);
  assert.equal(isLocalOnlyPath("/api/providers/openai/login"), true);
});

test("isLocalOnlyPath: ordinary management routes are not local-only", () => {
  assert.equal(isLocalOnlyPath("/api/settings"), false);
  assert.equal(isLocalOnlyPath("/api/providers"), false);
  assert.equal(isLocalOnlyPath("/api/system/env/repair"), false);
});

test("isLocalOnlyBypassableByManageScope: spawn-capable version route is not bypassable", () => {
  assert.equal(isLocalOnlyBypassableByManageScope("/api/system/version"), false);
});

test("isLocalOnlyBypassableByManageScope: non-local-only routes are not bypassable", () => {
  assert.equal(isLocalOnlyBypassableByManageScope("/api/settings"), false);
});

test("isAlwaysProtectedPath: destructive management routes stay always protected", () => {
  assert.equal(isAlwaysProtectedPath("/api/shutdown"), true);
  assert.equal(isAlwaysProtectedPath("/api/settings/database"), true);
  assert.equal(isAlwaysProtectedPath("/api/settings"), false);
});

test("isLoopbackHost: recognises loopback hosts and rejects non-loopback hosts", () => {
  assert.equal(isLoopbackHost("localhost"), true);
  assert.equal(isLoopbackHost("localhost:20128"), true);
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("127.0.0.1:3000"), true);
  assert.equal(isLoopbackHost("[::1]"), true);
  assert.equal(isLoopbackHost("192.168.1.1"), false);
  assert.equal(isLoopbackHost("example.com"), false);
  assert.equal(isLoopbackHost(null), false);
});

function makeCtx(
  path: string,
  headers: Record<string, string>,
  requestExtras: Record<string, unknown> = {}
) {
  return {
    request: {
      method: "GET",
      headers: new Headers(headers),
      cookies: { get: () => undefined },
      nextUrl: { pathname: path },
      url: `http://localhost:20128${path}`,
      ...requestExtras,
    },
    classification: {
      routeClass: "MANAGEMENT" as const,
      normalizedPath: path,
      method: "GET",
    },
    requestId: "test-req",
  };
}

test("management policy rejects local-only version route from non-localhost", async () => {
  const ctx = makeCtx("/api/system/version", { host: "evil.tunnel.io" });
  const outcome = await managementPolicy.evaluate(ctx);
  assert.equal(outcome.allow, false);
  if (!outcome.allow) assert.equal(outcome.status, 403);
});

test("management policy allows local-only version route from localhost with CLI token", async () => {
  const token = getMachineTokenSync();
  const ctx = makeCtx(
    "/api/system/version",
    {
      host: "localhost",
      [CLI_TOKEN_HEADER]: token,
    },
    { socket: { remoteAddress: "127.0.0.1" } }
  );
  const outcome = await managementPolicy.evaluate(ctx);
  assert.equal(outcome.allow, true);
});
