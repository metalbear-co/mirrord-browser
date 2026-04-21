import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    test as base,
    chromium,
    type BrowserContext,
    type Page,
} from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist');

type ExtensionFixtures = {
    context: BrowserContext;
    extensionId: string;
    popupPage: Page;
};

export const test = base.extend<ExtensionFixtures>({
    context: async ({}, use) => {
        if (!fs.existsSync(EXTENSION_PATH)) {
            throw new Error(
                `Extension not built. Run "pnpm build" first. Expected: ${EXTENSION_PATH}`
            );
        }

        const context = await chromium.launchPersistentContext('', {
            headless: false,
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                '--no-first-run',
                '--disable-gpu',
            ],
        });

        await use(context);
        await context.close();
    },

    extensionId: async ({ context }, use) => {
        // Wait for the service worker to register
        let serviceWorker = context.serviceWorkers()[0];
        if (!serviceWorker) {
            serviceWorker = await context.waitForEvent('serviceworker');
        }

        const extensionId = serviceWorker.url().split('/')[2];
        await use(extensionId);
    },

    popupPage: async ({ context, extensionId }, use) => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/pages/popup.html`);
        // Popups on a fresh install now render the Onboarding screen; tests in
        // this suite expect the Manual form. Seed an empty stored config so
        // `hasStoredConfig` flips true and the Manual form renders directly.
        // Suites that need to exercise the Onboarding flow should open their
        // own page instead of using this fixture.
        await page.evaluate(() =>
            chrome.storage.local.set({
                defaults: { headerName: '', headerValue: '', scope: '' },
            })
        );
        await page.reload();
        await use(page);
    },
});

export const expect = test.expect;
