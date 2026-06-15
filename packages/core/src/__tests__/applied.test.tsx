/** @jest-environment jsdom */
import { run } from '../applied';

function setSearch(search: string): void {
    window.history.replaceState({}, '', `/pages/applied.html${search}`);
}

describe('applied result page run()', () => {
    it('errors when there is no payload', async () => {
        setSearch('');
        const state = await run();
        expect(state).toEqual({
            kind: 'error',
            error: 'No config payload provided.',
        });
    });

    it('errors on a malformed payload and echoes the invalid input', async () => {
        setSearch('?payload=@@@not-base64@@@');
        const state = await run();
        expect(state.kind).toBe('error');
        if (state.kind === 'error') {
            expect(state.input).toBe('@@@not-base64@@@');
        }
    });

    it('applies a valid payload and reports done', async () => {
        const browser = (await import('webextension-polyfill')).default;
        const payload = btoa(
            JSON.stringify({
                header_filter: 'X-Test: v',
                inject_scope: '*://example.com/*',
            })
        );
        setSearch(`?payload=${encodeURIComponent(payload)}`);

        const state = await run();

        expect(state).toMatchObject({
            kind: 'done',
            header: 'X-Test',
            value: 'v',
            scope: '*://example.com/*',
        });
        expect(
            browser.declarativeNetRequest.updateDynamicRules
        ).toHaveBeenCalled();
    });
});
