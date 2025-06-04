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
