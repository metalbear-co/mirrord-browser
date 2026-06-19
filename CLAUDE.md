# CLAUDE.md

Context for Claude Code when working with the mirrord browser extension.

## Quick Reference

```bash
# Install dependencies
pnpm install

# Dev mode (Vite HMR)
pnpm dev

# Production build (output: dist/)
pnpm build

# Lint and format check
pnpm run check

# Auto-fix lint/format
pnpm lint:fix && pnpm fmt

# Unit tests (Jest)
pnpm test

# E2E tests (Playwright, requires build first)
pnpm build && pnpm test:e2e

# E2E with interactive UI
pnpm test:e2e:ui
```

## Overview

mirrord-browser is a Chrome extension (Manifest V3) that injects HTTP headers into browser requests. Users configure header name, value, and optional URL scope via a popup UI. The extension uses Chrome's Declarative Net Request API to modify matching requests.

- **Package manager:** pnpm
- **Language:** TypeScript (strict mode, ES6 target, jsx: react-jsx)
- **UI:** React 19 with @metalbear/ui (Radix-based components) and Tailwind CSS
- **Build:** Vite 5.4 with @crxjs/vite-plugin for Chrome extension bundling
- **Published to:** Chrome Web Store (automated when a `releases/*` PR is merged)

## Architecture

```
src/
├── background.ts          # Service worker (icon badge on install/startup)
├── popup.tsx              # Main popup UI (React, 2-card layout)
├── config.ts              # CLI payload handler (base64 decode, store defaults)
├── hooks/
│   └── useHeaderRules.ts  # All popup state logic (rules, form, save/reset)
├── components/
│   ├── HeaderForm.tsx     # Form inputs (header name, value, scope)
│   ├── RulesList.tsx      # Active rules display
│   └── RuleItem.tsx       # Single rule display
├── analytics.ts           # PostHog event capture (fetch + sendBeacon)
├── types.ts               # TypeScript interfaces, DNR resource types
├── constants.ts           # UI strings (STRINGS object), badge config
├── util.ts                # Icon refresh, rule/header parsing
└── __tests__/             # Jest unit tests (7 files)

pages/
├── popup.html             # Popup entry point
└── config.html            # CLI config entry point
```

**Data flow:** CLI config link -> config.ts decodes payload, stores defaults -> popup.tsx renders form via useHeaderRules hook -> save updates chrome.storage.local + DNR rules -> Chrome injects headers into matching requests.

**Chrome APIs used:**

- `chrome.declarativeNetRequest` - HTTP header injection via MODIFY_HEADERS rules
- `chrome.storage.local` - Persist header configs
- `chrome.action.setBadgeText` - Icon indicator

## Code Style

- **Prettier:** single quotes, trailing commas (ES5), tab width 4, print width 80, semicolons
- **ESLint:** semicolons required, single quotes, flat config
- **React:** functional components only, custom hooks for state/side effects
- **Naming:** camelCase for functions/variables, PascalCase for components/types, `use*` prefix for hooks
- **Pre-commit:** Husky + lint-staged

## Testing

**Unit tests (Jest):**

- `src/__tests__/` with 7 test files
- Tests: utility functions, hooks, React components, analytics, config parsing
- Mock Chrome APIs via jest setup

**E2E tests (Playwright):**

- `e2e/` directory with custom fixtures that load the built extension into Chromium
- Test server on localhost:3456 echoes request headers
- Tests: header injection, URL scoping, rule removal, reset to defaults, analytics
- Requires `pnpm build` before running

**Operator sessions e2e against real mirrord ui (playground):**

The session-join flow is validated end-to-end against a real `mirrord ui` CLI talking to the playground operator — no fake server is maintained in-tree (we don't want the CLI API and extension to drift).

1. Install a recent mirrord CLI build that includes the `ui` subcommand (metalbear-co/mirrord#4205).
2. Point your kubeconfig at the playground cluster (`checkout-demo` in `mirrord-test`).
3. Start the local poller: `mirrord ui --token <random-token>` (it prints a `configure` URL with token + backend baked in).
4. Run `pnpm build` then `pnpm test:e2e -- live-real.spec.ts`. Export the same token via `MIRRORD_UI_TOKEN=<token>` so the spec can see sessions.
5. To drive an operator session yourself so there's something to join, run any mirrord-enabled workload against the playground operator (e.g. `mirrord exec --target deploy/web -- curl ...`).

The `live-real.spec.ts` spec auto-skips when `MIRRORD_UI_TOKEN` is unset, so CI is unaffected.

## Key Patterns

- **useHeaderRules hook:** Single source of truth for all popup state (active rules, form fields, save/reset handlers). Never modify UI state outside this hook.
- **Single DNR rule:** Extension maintains only 1 active rule (id: 1). Save replaces all existing rules.
- **PostHog analytics:** Direct HTTP calls (no SDK). Events tracked: popup_opened/closed, header_saved/removed/reset, config_received, errors. Failures silently caught.
- **sendBeacon for teardown:** Popup can close before useEffect runs. Module-level listeners + sendBeacon handle cleanup analytics.

## Chrome Extension Notes

- Manifest V3 service worker (async, no DOM access)
- All resource types must be explicitly listed in DNR rules (omitting excludes main_frame)
- URL filter `|` matches all URLs; custom patterns for scoped rules
- `chrome.storage.local` for configs (synced across browser), `localStorage` for PostHog distinct ID

## CI/CD

Layout mirrors the operator/mirrord repos: small reusable check/test workflows orchestrated by `ci.yaml`, with a single `ci` gate job for branch protection.

- **ci.yaml:** orchestrator. Calls `check-lint.yaml`, `check-towncrier.yaml`, `test-unit.yaml`, `test-e2e.yaml` (each a reusable `workflow_call`), then a final `ci` gate job (`ci-success`) that fails if any required job failed. Triggers on `pull_request`, `push` to main, and `workflow_dispatch`; concurrency cancels superseded PR runs.
- **check-lint.yaml:** `pnpm run check` (Prettier + ESLint).
- **check-towncrier.yaml:** verifies a changelog fragment was added (PR-only).
- **test-unit.yaml:** Jest unit tests.
- **test-e2e.yaml:** Playwright E2E in the playwright container (xvfb-run), uploads report on failure.

### Release automation (towncrier-based, like operator/mirrord)

- **Changelog fragments:** add a `changelog.d/+<description>.<type>.md` file per change (types: `security`, `removed`, `deprecated`, `added`, `changed`, `fixed`, `internal`). `internal`/`fixed`-only releases bump the patch version; anything else bumps the minor version. Config in `towncrier.toml`, accumulated history in `CHANGELOG.md`.
- **scheduled-release.yaml:** daily cron, Sun–Wed (and manual dispatch). If any user-facing (non-`internal`) fragments exist, calls `auto-release-pr.yaml`.
- **auto-release-pr.yaml:** computes the next version, bumps `package.json` + `src/manifest.json`, builds the changelog with towncrier, and opens/updates a `releases/<version>` PR. Uses the CUBBY GitHub App token so CI runs on the PR.
- **release.yaml (Publish):** triggers when a `releases/*` PR is **merged** into main. Validates the version (semver, package.json == manifest.json, not already released), runs tests, builds, zips, uploads/publishes to the Chrome Web Store, creates a GitHub release with notes extracted from `CHANGELOG.md`, then records the release in Linear via `metalbear-co/linear-release-action`.

**Required secrets:** `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_EXTENSION_ID` (Chrome Web Store); `CUBBY_CLIENT_ID`, `CUBBY_PRIVATE_KEY` (release-PR app token); `LINEAR_ACCESS_KEY` (Linear release).
