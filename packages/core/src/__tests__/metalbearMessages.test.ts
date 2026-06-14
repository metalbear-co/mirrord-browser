/** @jest-environment jsdom */
const BOX_ID = 'mirrord-config-message';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// Set the page hash without dispatching `hashchange` (which would fire listeners left over
// from previously isolated module instances). The content script reads the hash directly.
function setHash(hash: string): void {
    window.history.replaceState({}, '', `/mirrord/extension${hash}`);
}

describe('metalbear content script', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('shows a "no config found" box and does not redirect on a bare visit', async () => {
        setHash('');
        await jest.isolateModulesAsync(async () => {
            const browser = (await import('webextension-polyfill')).default;
            await import('../content/metalbearConfig');
            await flush();
            expect(document.getElementById(BOX_ID)?.textContent).toContain(
                'No config found'
            );
            expect(browser.runtime.getURL).not.toHaveBeenCalled();
        });
    });

    it('redirects to the result page when a payload is present', async () => {
        setHash('#config=abc123');
        await jest.isolateModulesAsync(async () => {
            const browser = (await import('webextension-polyfill')).default;
            await import('../content/metalbearConfig');
            await flush();
            expect(browser.runtime.getURL).toHaveBeenCalledWith(
                'pages/applied.html'
            );
            expect(document.getElementById(BOX_ID)).toBeNull();
        });
    });
});
