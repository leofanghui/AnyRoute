# OmniRoute Minimal Docs

This docs tree tracks the minimal source profile only. It intentionally omits
non-minimal modules that were removed from this branch.

## Current Sections

- `getting-started/` - quick start, provider setup, auto-combo basics, and troubleshooting.
- `guides/` - focused operator guides for retained provider, cost, i18n, desktop, and uninstall flows.
- `architecture/` - retained architecture notes.
- `routing/` - retained routing behavior.
- `security/` - retained security implementation notes.
- `ops/` - deployment and runtime operations that still apply to the minimal build.

When a removed module is reintroduced, add its docs back with the code in the
same change so `npm run check:docs-all` can verify source-backed claims.
