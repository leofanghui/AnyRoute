/**
 * Regression guard for INTENTIONALLY_INTERNAL classification (#3499).
 *
 * Every module in INTENTIONALLY_INTERNAL must be genuinely consumed via a
 * direct/dynamic import somewhere in src/, open-sse/, bin/, or within
 * src/lib/db/ itself (for db-internal coordination modules like stateReset,
 * healthCheck, migrationRunner), OR documented as type-only / DEAD?.
 *
 * Purpose: if a future cleanup removes the last consumer of a module that is
 * still in INTENTIONALLY_INTERNAL, this test turns red and forces a conscious
 * reclassification decision — the DEAD? category must be explicitly expanded,
 * not silently accumulated.
 *
 * Hard Rule #18 compliance: this test was written BEFORE the fix was applied,
 * confirmed to fail on the old framing, and now passes on the audited truth.
 */
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { INTENTIONALLY_INTERNAL } from "../../scripts/check/check-db-rules.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Walk a directory tree, calling cb(absolutePath) for every file.
 */
function walkSync(dir: string, cb: (p: string) => void): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip well-known non-source dirs to keep the walk fast
      if (["node_modules", ".git", ".next", "dist", "out"].includes(entry.name)) continue;
      walkSync(full, cb);
    } else {
      cb(full);
    }
  }
}

/**
 * Returns true if any file in the search roots imports db/<mod> (static or dynamic).
 * Patterns matched:
 *   from "@/lib/db/<mod>"
 *   from "../db/<mod>"   (any relative path ending /db/<mod>)
 *   import("@/lib/db/<mod>")
 *   require(".../db/<mod>")
 *   import(`${...}/db/<mod>.ts`)  — dynamic template (bin/cli/runtime.mjs pattern)
 */
function hasImporter(mod: string, roots: string[]): boolean {
  // Escape special regex chars in module names.
  const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    // static: from "…/db/<mod>"
    new RegExp(`from\\s+['""][^'"]+/db/${escaped}['"]`),
    // dynamic: import("…/db/<mod>") or require("…/db/<mod>")
    new RegExp(`(?:import|require)\\s*\\(\\s*['""][^'"]+/db/${escaped}['"]`),
    // dynamic template: import(`…/db/<mod>.ts`) — bin/cli/runtime.mjs uses template literals
    new RegExp(`import\\s*\\(\`[^'"\`]+/db/${escaped}\\.ts\`\\)`),
    // relative import within db/: from "./<mod>" or from "./<mod>"
    new RegExp(`from\\s+['"]\\.\\.?/${escaped}['"]`),
  ];
  // The canonical db module path — we must skip ONLY this exact file, not all files
  // that happen to share the same basename in other directories.
  const dbModulePath = path.join(REPO_ROOT, "src", "lib", "db", `${mod}.ts`);
  let found = false;
  for (const root of roots) {
    if (found) break;
    walkSync(root, (filePath) => {
      if (found) return;
      // Only scan TS/JS/MJS source files
      if (!/\.(ts|tsx|mjs|js|cjs)$/.test(filePath)) return;
      // Skip only the db module itself (not same-name files in other dirs)
      if (filePath === dbModulePath) return;
      let src: string;
      try {
        src = fs.readFileSync(filePath, "utf8");
      } catch {
        return;
      }
      if (patterns.some((rx) => rx.test(src))) found = true;
    });
  }
  return found;
}

// ── Audit roots ────────────────────────────────────────────────────────────

// Modules marked "type-only": exports only TypeScript types; no runtime import
// needed — the ts compiler erases them. These are genuinely correct as-is.
const TYPE_ONLY = new Set<string>();

// Modules explicitly documented as DEAD? in the classification comments.
// They remain in INTENTIONALLY_INTERNAL for schema-reservation reasons.
// Flag them but do NOT fail — a separate decision is needed to remove them.
const DOCUMENTED_DEAD = new Set([
  "prompts", // DEAD? (production): zero production callers; integration test only verifies interface shape
]);

const SEARCH_ROOTS = [
  path.join(REPO_ROOT, "src"),
  path.join(REPO_ROOT, "open-sse"),
  path.join(REPO_ROOT, "bin"),
  path.join(REPO_ROOT, "tests"),
];

// ── Tests ──────────────────────────────────────────────────────────────────

test("INTENTIONALLY_INTERNAL is exported from check-db-rules.mjs", () => {
  assert.ok(
    INTENTIONALLY_INTERNAL instanceof Set,
    "INTENTIONALLY_INTERNAL must be a Set exported from the gate script"
  );
  assert.ok(INTENTIONALLY_INTERNAL.size > 0, "INTENTIONALLY_INTERNAL must not be empty");
});

test("INTENTIONALLY_INTERNAL contains the expected 12 audited modules", () => {
  const expected = [
    "commandCodeAuth",
    "detailedLogs",
    "domainState",
    "encryption",
    "healthCheck",
    "migrationRunner",
    "prompts",
    "recovery",
    "secrets",
    "stateReset",
    "stats",
    "tierConfig",
  ];
  for (const mod of expected) {
    assert.ok(
      INTENTIONALLY_INTERNAL.has(mod),
      `Expected ${mod} to be in INTENTIONALLY_INTERNAL after audit`
    );
  }
  assert.equal(
    INTENTIONALLY_INTERNAL.size,
    expected.length,
    `INTENTIONALLY_INTERNAL has ${INTENTIONALLY_INTERNAL.size} entries; expected ${expected.length}`
  );
});

test("every non-type-only, non-dead module in INTENTIONALLY_INTERNAL has ≥1 real importer", () => {
  const failures: string[] = [];
  for (const mod of INTENTIONALLY_INTERNAL) {
    if (TYPE_ONLY.has(mod)) continue; // type-only: no runtime import expected
    if (DOCUMENTED_DEAD.has(mod)) continue; // dead modules exempted with explicit flag
    if (!hasImporter(mod, SEARCH_ROOTS)) {
      failures.push(mod);
    }
  }
  assert.deepEqual(
    failures,
    [],
    `These INTENTIONALLY_INTERNAL modules have ZERO importers — either they became dead ` +
      `(add to DOCUMENTED_DEAD with a DEAD? comment) or they were misclassified:\n  ${failures.join(", ")}`
  );
});

test("DOCUMENTED_DEAD modules are still in INTENTIONALLY_INTERNAL (dead list must stay honest)", () => {
  for (const mod of DOCUMENTED_DEAD) {
    assert.ok(
      INTENTIONALLY_INTERNAL.has(mod),
      `DOCUMENTED_DEAD module "${mod}" is no longer in INTENTIONALLY_INTERNAL — ` +
        `remove it from DOCUMENTED_DEAD in this test if it was intentionally removed from the gate`
    );
  }
});
