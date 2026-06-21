# OmniRoute Minimal

Minimal OmniRoute is the source-pruned profile of the OmniRoute AI router. It keeps the
existing Next.js/Open-SSE architecture and the core OpenAI-compatible request path, while
removing non-minimal product modules from this branch instead of only hiding them in the UI.

## Retained Scope

- Dashboard: Home, Endpoints, API manager, Providers, Combos, Analytics, Costs, Logs,
  Health, General Settings, Sidebar Settings, Docs, and Changelog.
- Runtime APIs: OpenAI-compatible `/v1` routes, provider management, API keys, combos,
  model catalog, usage/cost analytics, logs, health, and settings.
- Core engine: `open-sse` handlers, executors, translators, provider registry, combo routing,
  usage tracking, and compatibility wrappers required by the retained APIs.
- Persistence: SQLite domain modules and historical migrations are kept so existing local data
  can still open without a schema rewrite.

## Removed From This Branch

MCP server, A2A, skills, memory UI, plugin marketplace, traffic inspector, session recorder,
compression UI/engines, cloud-agent modules, webhooks UI, tunnel dashboards, extended protocol
surfaces, and their route-specific tests/docs are intentionally not part of this profile.

Compatibility shims may remain where retained routes still import a former optional service.
For example `src/lib/cloudSync.ts` is a no-op minimal stub so provider/key/combo management
does not need architectural rewiring.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Dashboard: `http://localhost:20128`

OpenAI-compatible base URL: `http://localhost:20128/v1`

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run typecheck:core
npm run typecheck:noimplicit:core
npm run check:test-discovery
npm run check:docs-all
```

Full build/test commands require dependencies to be installed. The current branch is intended to
stay close to the original architecture so removed modules can be restored later as explicit
module additions rather than hidden UI toggles.

## Documentation

Minimal docs live under `docs/` and only describe retained source-backed behavior. When a removed
module is reintroduced, restore its code, tests, and docs together.
