# Mirrord Browser Extension

Inject HTTP header for testing applications running by mirrord.

## Development

### Pre-requisites

Before you start, please make sure you have the following tools installed:

- **Node.js**
  Install from [https://nodejs.org/](https://nodejs.org/)

- **pnpm** (package manager)  
  Install globally with:
    ```bash
    npm install -g pnpm
    ```

### Build the extension

Run command `pnpm build`. Import the final output `dist/` folder into Chrome
via `chrome://extensions` with the load unpacked option.

### Testing

**Unit tests** use [Jest](https://jestjs.io/) and run against the extension's
TypeScript source directly:

```bash
pnpm test
```

**End-to-end tests** use [Playwright](https://playwright.dev/) to load the
built extension in Chromium and verify full user flows:

```bash
pnpm build            # build the extension first
pnpm test:e2e         # run E2E tests
```
