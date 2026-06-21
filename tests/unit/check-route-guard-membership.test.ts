import { test } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  routeFileToApiPath,
  findUnclassifiedSpawnRoutes,
  isSpawnCapableSource,
  findSpawnCapableRoutes,
  KNOWN_UNCLASSIFIED_SOURCE_SPAWN,
  SPAWN_CAPABLE_ROUTE_ROOTS,
} from "../../scripts/check/check-route-guard-membership.ts";
import { isLocalOnlyPath } from "../../src/server/authz/routeGuard.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const isSystemVersionLocalOnly = (path: string): boolean =>
  path === "/api/system/version" || path.startsWith("/api/system/version/");

test("routeFileToApiPath maps a Next App Router route.ts to its URL path", () => {
  assert.equal(routeFileToApiPath("src/app/api/system/version/route.ts"), "/api/system/version");
});

test("routeFileToApiPath resolves dynamic [param] segments to placeholders", () => {
  assert.equal(
    routeFileToApiPath("src/app/api/providers/[id]/login/route.ts"),
    "/api/providers/_id_/login"
  );
});

test("minimal source has no static spawn-capable route roots", () => {
  assert.deepEqual(SPAWN_CAPABLE_ROUTE_ROOTS, []);
});

test("no unclassified routes when every spawn-capable route is local-only", () => {
  assert.deepEqual(
    findUnclassifiedSpawnRoutes(["/api/system/version"], isSystemVersionLocalOnly, {}),
    []
  );
});

test("flags a spawn-capable route that is not classified local-only", () => {
  assert.deepEqual(
    findUnclassifiedSpawnRoutes(
      ["/api/system/version", "/api/providers/openai/login"],
      isSystemVersionLocalOnly,
      {}
    ),
    ["/api/providers/openai/login"]
  );
});

test("allowlisted routes are not flagged", () => {
  assert.deepEqual(
    findUnclassifiedSpawnRoutes(
      ["/api/system/version", "/api/future/spawn"],
      isSystemVersionLocalOnly,
      { "/api/future/spawn": "frozen pre-existing exception" }
    ),
    []
  );
});

test("flags multiple unclassified routes, preserving input order", () => {
  const leaky = (): boolean => false;
  assert.deepEqual(findUnclassifiedSpawnRoutes(["/api/a", "/api/b", "/api/c"], leaky, {}), [
    "/api/a",
    "/api/b",
    "/api/c",
  ]);
});

test("isSpawnCapableSource detects child_process and worker_threads usage", () => {
  assert.ok(isSpawnCapableSource(`import { execFile } from "child_process";`));
  assert.ok(isSpawnCapableSource(`import { execFileSync } from "node:child_process";`));
  assert.ok(isSpawnCapableSource(`import { Worker } from "worker_threads";`));
  assert.ok(isSpawnCapableSource(`const { spawn } = require("child_process");\nspawn("npm");`));
});

test("isSpawnCapableSource returns false for normal route source", () => {
  const src = `import { NextResponse } from "next/server";\nexport async function GET() { return NextResponse.json({}); }`;
  assert.ok(!isSpawnCapableSource(src));
});

test("findSpawnCapableRoutes detects the real system version route", () => {
  const found = findSpawnCapableRoutes(repoRoot);
  assert.ok(
    found.includes("src/app/api/system/version/route.ts"),
    `expected system/version in spawn-capable routes, found: ${found.join(", ")}`
  );
});

test("source-spawn allowlist is empty and real spawn-capable route is local-only", () => {
  assert.equal(Object.keys(KNOWN_UNCLASSIFIED_SOURCE_SPAWN).length, 0);
  assert.equal(isLocalOnlyPath("/api/system/version"), true);
});
