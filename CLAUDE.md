# CLAUDE.md

Context for Claude Code when working with the mirrord browser extension.

## Quick Reference

```bash
# Install dependencies (pnpm workspace)
pnpm install

# Dev mode (Vite HMR) — pick a target
pnpm dev:chrome
pnpm dev:firefox

# Production build — builds BOTH targets (output: packages/<target>/dist/)
pnpm build
pnpm build:chrome      # Chrome only
pnpm build:firefox     # Firefox only

# Lint and format check
pnpm run check

# Auto-fix lint/format
pnpm lint:fix && pnpm fmt

# Type check (whole workspace)
pnpm typecheck

# Unit tests (Jest)
pnpm test

# E2E tests (Playwright, Chrome; requires build first)
pnpm build && pnpm test:e2e

# E2E with interactive UI
pnpm test:e2e:ui
```

## Overview

mirrord-browser is a cross-browser extension (Manifest V3) for **Chrome and Firefox** that injects HTTP headers into browser requests. Users configure header name, value, and optional URL scope via a popup/side-panel UI. The extension uses the Declarative Net Request API to modify matching requests.

- **Package manager:** pnpm (workspace / monorepo)
- **Language:** TypeScript (strict mode, ES6 target, jsx: react-jsx)
- **UI:** React 19 with @metalbear/ui (Radix-based components) and Tailwind CSS
- **Cross-browser API:** `webextension-polyfill` — code imports the promise-based `browser` from `packages/core/src/browser.ts`, never the global `chrome.*`
- **Build:** Vite 5.4 with `vite-plugin-web-extension` (per-target manifest + build)
- **Published to:** Chrome Web Store + Firefox AMO (automated on git tag)

## Architecture

This is a pnpm monorepo. ~95% of the code is shared in `packages/core`; the per-browser packages hold only the manifest and build config.

```
packages/
├── core/                       # @mirrord/browser-core — all shared code
│   ├── manifest.base.json      # Shared manifest fields (name, version, permissions)
│   ├── pages/                  # popup/config/configure/options HTML entry points
│   ├── public/images/          # Icons (copied into each dist)
│   └── src/
│       ├── browser.ts          # Re-exports the webextension-polyfill `browser` (single seam)
│       ├── background.ts       # Background script (DNR rules, header observation, CLI bridge)
│       ├── popup.tsx           # Main popup/side-panel UI (React)
│       ├── config.ts           # CLI payload handler (base64 decode, store defaults)
│       ├── configure.tsx       # mirrord ui configure/join landing page
│       ├── content/            # Content scripts (metalbear.com #config= → config flow)
│       ├── hooks/              # useHeaderRules, useMirrordUi, useHeaderObservation
│       ├── components/         # React components
│       ├── analytics.ts        # PostHog event capture (fetch + sendBeacon)
│       ├── types.ts            # Interfaces + DNR/runtime/storage type aliases (from polyfill)
│       ├── util.ts             # DNR helpers, storage wrappers, icon refresh, parsing
│       ├── __mocks__/          # Shared `webextension-polyfill` jest mock
│       └── __tests__/          # Jest unit tests (14 files)
├── chrome/                     # @mirrord/browser-chrome — manifest.ts + vite.config.ts
└── firefox/                    # @mirrord/browser-firefox — manifest.ts + vite.config.ts
```

**Data flow:** CLI config link -> config.ts decodes payload, stores defaults -> popup.tsx renders form via useHeaderRules hook -> save updates `browser.storage.local` + DNR rules -> the browser injects headers into matching requests.

**Web config entry point:** A shareable link `https://metalbear.com/mirrord/extension#config=<payload>` carries the same base64 payload as the in-extension `config.html?payload=`. A content script (`src/content/metalbearConfig.ts`, matched on that path) reads the `#config=` hash and **redirects the tab** to `pages/applied.html?payload=<payload>` (`src/applied.tsx`), which is listed in `web_accessible_resources` for metalbear.com so the redirect is allowed. That result page is a privileged extension page, so it decodes the payload, prompts if the header filter is a regex, installs the DNR rule itself (via `applyConfig.ts`), and shows a success/error card — the user ends up on a real extension page, not an overlay on the website. This avoids any background messaging / `tabs` permission / `tabs.update` (which proved unreliable on Firefox). A bare visit (no `#config=`) is left on the site with a small "No config found" note. Pure decode/parse helpers live in `configCore.ts` (side-effect-free) and are shared with `config.ts`; the hash value is read verbatim so base64 `+`/`/`/`=` survive (re-encoded with `encodeURIComponent` for the result-page query).

**Cross-browser APIs (all via the polyfill `browser`):**

- `browser.declarativeNetRequest` - HTTP header injection via `modifyHeaders` rules
- `browser.storage.local` / `.session` - Persist header configs / observation state
- `browser.action.setBadgeText` - Icon indicator
- `browser.webRequest.onSendHeaders` - Observe injected headers (observational; works in MV3 + Firefox)

**Per-browser surface for the popup UI:** Chrome opens `popup.html` in the **side panel** (`side_panel` + `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`). Firefox has no `side_panel`, so it hosts the same `popup.html` in the native **sidebar** (`sidebar_action`) with no action popup, and `background.ts` registers an `action.onClicked` → `sidebarAction.toggle()` handler (guarded, no-op on Chrome) so the toolbar icon toggles it — mirroring Chrome's behavior. `popup.tsx` reports the surface (`side_panel` / `sidebar` / `popup_fallback`) for analytics.

**Other Chrome-only touchpoints** (feature-detected, no-op on Firefox): `storage.local.setAccessLevel` and the `externally_connectable` + `onMessageExternal` CLI bridge — on Firefox the CLI handoff falls back to the `config.html`/`configure.html` URL-payload flow. These are reached via a guarded `globalThis.chrome` cast.

## Code Style

- **Prettier:** single quotes, trailing commas (ES5), tab width 4, print width 80, semicolons
- **ESLint:** semicolons required, single quotes, flat config
- **React:** functional components only, custom hooks for state/side effects
- **Naming:** camelCase for functions/variables, PascalCase for components/types, `use*` prefix for hooks
- **Pre-commit:** Husky + lint-staged

## Testing

**Unit tests (Jest):**

- `packages/core/src/__tests__/` with 14 test files
- Tests: utility functions, hooks, React components, analytics, config parsing
- The cross-browser `browser` API is mocked by a shared stateful mock at
  `packages/core/src/__mocks__/webextension-polyfill.ts` (mapped via `moduleNameMapper`).
  `jest.setup.ts` mirrors it onto the global `chrome`/`browser` and resets it before each test.

**E2E tests (Playwright):**

- `e2e/` directory with custom fixtures that load the built **Chrome** extension into Chromium
  (from `packages/chrome/dist`; override with `MIRRORD_EXT_DIST`)
- Test server on localhost:3456 echoes request headers
- Tests: header injection, URL scoping, rule removal, reset to defaults, analytics
- Requires `pnpm build` before running. Firefox is smoke-checked in CI via `web-ext lint`
  (Playwright can't load extensions into Firefox the same way).

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

## Extension Notes

- Manifest V3. Chrome uses a service worker background; Firefox uses `background.scripts`
  (event page). The background code only registers listeners, so it works in both.
- All resource types must be explicitly listed in DNR rules (omitting excludes main_frame) —
  see `ALL_RESOURCE_TYPES` in `types.ts`.
- URL filter `|` matches all URLs; custom patterns for scoped rules
- `browser.storage.local` for configs, `localStorage` for the PostHog distinct ID
- The single source of the version is `packages/core/manifest.base.json`; both per-browser
  manifests derive from it. Keep `package.json` version in sync (CI enforces on release).

## CI/CD

- **ci.yaml:** lint/format check, Jest unit tests, build both targets, `web-ext lint` the
  Firefox build, Playwright E2E on Chrome (xvfb-run on Ubuntu)
- **release.yaml:** On git tag, validates version match (package.json + manifest.base.json),
  builds both targets, uploads to Chrome Web Store via API, submits the Firefox build to AMO
  via `web-ext sign` (gated on `AMO_JWT_ISSUER`/`AMO_JWT_SECRET` secrets), attaches both zips
  to a GitHub release
