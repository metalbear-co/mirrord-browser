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
        await use(page);
    },
});

export const expect = test.expect;
