import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Fill, save, and activate a header rule via the popup UI.
 * Save alone no longer installs the DNR rule; the toggle must be
 * flipped on for the header to actually inject.
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

    const toggle = popupPage.getByRole('switch', {
        name: 'Toggle header injection',
    });
    if ((await toggle.getAttribute('aria-checked')) !== 'true') {
        await toggle.click();
    }
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
}
