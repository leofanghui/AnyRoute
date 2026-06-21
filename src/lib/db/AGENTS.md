# src/lib/db/ - Minimal SQLite Persistence

## Purpose

This directory owns SQLite persistence for the retained minimal router: provider connections,
models, combos, API keys, settings, logs, usage/cost analytics, health, proxy settings, and
compatibility state needed by the kept `/v1` runtime.

Historical migrations remain even when they mention removed modules. They keep existing local
databases openable without a schema reset.

## Rules

- Use domain modules in this directory from routes and services; avoid raw SQL in route files.
- Keep `localDb.ts` as a re-export layer only.
- Do not delete or renumber migrations as part of source pruning.
- Encrypt provider credentials and secrets through the existing helpers.
- Prefer normalizing stale settings at the module boundary rather than reintroducing removed UI.

## Retained Core Modules

- `core.ts` - database singleton, base schema, compatibility column checks.
- `migrationRunner.ts` - versioned migration application.
- `providers.ts`, `models.ts`, `providerLimits.ts` - provider and model catalog state.
- `combos.ts`, `modelComboMappings.ts`, `tierConfig.ts`, `tokenLimits.ts` - routing config.
- `apiKeys.ts`, `registeredKeys.ts`, `secrets.ts` - auth and key storage.
- `settings.ts`, `databaseSettings.ts`, `featureFlags.ts` - runtime configuration.
- `callLogStats.ts`, `detailedLogs.ts`, `usageAnalytics.ts`, `stats.ts`, `quotaSnapshots.ts` -
  retained analytics and logs data.
- `backup.ts`, `healthCheck.ts`, `stateReset.ts`, `recovery.ts` - maintenance and recovery.

## Testing Notes

Most tests use temporary SQLite databases. When changing persistence behavior, keep migrations
idempotent and run the focused DB/unit tests once dependencies are installed.
