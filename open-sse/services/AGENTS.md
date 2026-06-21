# open-sse/services/ - Minimal Routing Services

## Purpose

This directory contains the retained runtime services for the minimal source profile:
provider routing, combo execution, quota/rate-limit handling, token refresh, fallback state,
request accounting, and provider-specific helpers used by `/v1` API traffic.

Removed dashboard-only modules should not be reintroduced here unless their routes, tests, and
docs are restored as a deliberate module addition.

## Keep Boundaries

- Keep `combo.ts`, `combo/`, `autoCombo/`, account selection, token refresh, quota fetchers,
  rate limiting, model fallback, and usage services wired for retained provider routing.
- Keep provider-specific helper services required by active executors.
- Keep context-window trimming in `contextManager.ts`; it is part of request safety, not the
  removed compression UI.
- Keep migrations and DB compatibility callers when they are needed to open existing local data.

## Editing Rules

- Prefer extending the existing routing service that owns the behavior.
- Do not add UI-only service modules without the matching minimal sidebar route.
- Do not document service names or counts without checking the files in this directory first.
- Preserve error sanitization and abort/cleanup behavior in streaming paths.

## Common Hot Paths

- `combo.ts` - combo target resolution and fallback execution.
- `rateLimitManager.ts` / `tokenLimitCounter.ts` - in-process request and token limiting.
- `usage.ts` - usage and cost accounting for analytics and costs pages.
- `tokenRefresh.ts` - OAuth refresh and retry coordination.
- `modelFamilyFallback.ts` / `emergencyFallback.ts` - retained resilience paths.
- `contextManager.ts` / `contextHandoff.ts` - request context trimming and session handoff state.
