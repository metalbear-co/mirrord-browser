import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: 'html',
    use: {
        headless: false,
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'npx tsx e2e/test-server.ts',
        port: 3456,
        reuseExistingServer: !process.env.CI,
    },
});
