/** @jest-environment jsdom */
import { APPLY_CONFIG_MESSAGE } from '../constants';

const BOX_ID = 'mirrord-config-message';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// Set the page hash without dispatching `hashchange` (which would fire listeners left over
// from previously isolated module instances). The content script reads the hash directly.
function setHash(hash: string): void {
    window.history.replaceState({}, '', `/mirrord/extension${hash}`);
}

describe('metalbear content script in-page messages', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('shows "no config found" when the link has no payload', async () => {
        setHash('');
        await jest.isolateModulesAsync(async () => {
            await import('../content/metalbearConfig');
            await flush();
            const box = document.getElementById(BOX_ID);
            expect(box).not.toBeNull();
            expect(box?.textContent).toContain('No config found');
        });
    });

    it('shows an error when the payload is malformed', async () => {
        setHash('#config=@@@not-base64@@@');
        await jest.isolateModulesAsync(async () => {
            await import('../content/metalbearConfig');
            await flush();
            const box = document.getElementById(BOX_ID);
            expect(box?.textContent).toContain('Invalid config');
        });
    });

    it('applies a valid payload via the background and shows success', async () => {
        const payload = btoa(JSON.stringify({ header_filter: 'X-Test: v' }));
        setHash(`#config=${payload}`);
        await jest.isolateModulesAsync(async () => {
            const browser = (await import('webextension-polyfill')).default;
            (browser.runtime.sendMessage as jest.Mock).mockResolvedValue({
                ok: true,
                header: 'X-Test',
                value: 'v',
            });
            await import('../content/metalbearConfig');
            await flush();

            expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: APPLY_CONFIG_MESSAGE,
                    header: 'X-Test',
                    value: 'v',
                })
            );
            const box = document.getElementById(BOX_ID);
            expect(box?.textContent).toContain('Config applied');
        });
    });

    it('surfaces a background failure as an error message', async () => {
        const payload = btoa(JSON.stringify({ header_filter: 'X-Test: v' }));
        setHash(`#config=${payload}`);
        await jest.isolateModulesAsync(async () => {
            const browser = (await import('webextension-polyfill')).default;
            (browser.runtime.sendMessage as jest.Mock).mockResolvedValue({
                ok: false,
                error: 'DNR update failed',
            });
            await import('../content/metalbearConfig');
            await flush();

            const box = document.getElementById(BOX_ID);
            expect(box?.textContent).toContain('Failed to apply config');
            expect(box?.textContent).toContain('DNR update failed');
        });
    });
});
