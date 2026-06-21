import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import DatabaseSync from "better-sqlite3";

import { SELF_USAGE_SCOPE } from "../../src/shared/constants/selfServiceScopes.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationPath = path.join(
  repoRoot,
  "src/lib/db/migrations/075_api_key_self_service_usage_scopes.sql"
);

test("self-service scope migration backfills own usage once and preserves custom scopes", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE api_keys (
      id TEXT PRIMARY KEY,
      scopes TEXT
    );

    INSERT INTO api_keys (id, scopes) VALUES
      ('legacy-empty', '[]'),
      ('legacy-null', NULL),
      ('custom', '["custom:scope"]'),
      ('already-disabled-after-migration', '["custom:scope"]');
  `);

  db.exec(sql);
  db.prepare("UPDATE api_keys SET scopes = ? WHERE id = ?").run(
    JSON.stringify(["custom:scope"]),
    "already-disabled-after-migration"
  );
  db.exec(sql);

  const rows = db.prepare("SELECT id, scopes FROM api_keys ORDER BY id").all() as Array<{
    id: string;
    scopes: string;
  }>;
  const scopesById = new Map(rows.map((row) => [row.id, JSON.parse(row.scopes) as string[]]));

  assert.deepEqual(scopesById.get("legacy-empty"), [SELF_USAGE_SCOPE]);
  assert.deepEqual(scopesById.get("legacy-null"), [SELF_USAGE_SCOPE]);
  assert.deepEqual(scopesById.get("custom"), ["custom:scope", SELF_USAGE_SCOPE]);
  assert.deepEqual(scopesById.get("already-disabled-after-migration"), ["custom:scope"]);
});
