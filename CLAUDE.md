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
- **Published to:** Chrome Web Store (automated on git tag)

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

- **ci.yaml:** lint/format check, Jest unit tests, Playwright E2E (xvfb-run on Ubuntu)
- **release.yaml:** On git tag, validates version match (package.json + manifest.json), builds, uploads to Chrome Web Store via API, creates GitHub release
