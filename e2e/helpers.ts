import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Fill and save a header rule via the popup UI.
 */
export async function addHeader(
    popupPage: Page,
    headerName: string,
    headerValue: string,
    scope?: string
) {
    await popupPage.locator('#headerName').fill(headerName);
    await popupPage.locator('#headerValue').fill(headerValue);
    if (scope) {
        await popupPage.locator('#scope').fill(scope);
    }
    await popupPage.getByRole('button', { name: 'Save' }).click();
    await expect(popupPage.getByText('Saved!')).toBeVisible();
}
