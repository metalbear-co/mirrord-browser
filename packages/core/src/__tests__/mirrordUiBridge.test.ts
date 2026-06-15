/** @jest-environment jsdom */
import {
    UI_BRIDGE_REQUEST_TYPE,
    UI_BRIDGE_RESPONSE_TYPE,
    UI_BRIDGE_MARKER,
} from '../constants';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('mirrord ui bridge content script', () => {
    it('relays a trusted page request to the background and posts the response back', async () => {
        await jest.isolateModulesAsync(async () => {
            const browser = (await import('webextension-polyfill')).default;
            (browser.runtime.sendMessage as jest.Mock).mockResolvedValue({
                type: 'pong',
                version: '1.2.3',
            });
            await import('../content/mirrordUiBridge');

            const responses: unknown[] = [];
            window.addEventListener('message', (e: MessageEvent) => {
                const d = e.data as { type?: string } | null;
                if (d?.type === UI_BRIDGE_RESPONSE_TYPE) responses.push(e.data);
            });

            window.dispatchEvent(
                new MessageEvent('message', {
                    data: {
                        type: UI_BRIDGE_REQUEST_TYPE,
                        requestId: 42,
                        payload: { type: 'ping' },
                    },
                    // Use the jsdom window's own origin so the bridge's response
                    // (posted with this origin as targetOrigin) is delivered back.
                    origin: window.location.origin,
                    source: window,
                })
            );
            await flush();
            await flush();

            expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    [UI_BRIDGE_MARKER]: true,
                    payload: { type: 'ping' },
                })
            );
            expect(responses).toContainEqual(
                expect.objectContaining({
                    type: UI_BRIDGE_RESPONSE_TYPE,
                    requestId: 42,
                    payload: { type: 'pong', version: '1.2.3' },
                })
            );
        });
    });

    it('ignores requests from an untrusted origin', async () => {
        await jest.isolateModulesAsync(async () => {
            const browser = (await import('webextension-polyfill')).default;
            await import('../content/mirrordUiBridge');

            window.dispatchEvent(
                new MessageEvent('message', {
                    data: {
                        type: UI_BRIDGE_REQUEST_TYPE,
                        requestId: 1,
                        payload: { type: 'ping' },
                    },
                    origin: 'https://evil.example.com',
                    source: window,
                })
            );
            await flush();

            expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
        });
    });
});
