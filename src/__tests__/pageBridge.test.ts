import {
    PAGE_BRIDGE_TYPE,
    PAGE_REQUEST_SOURCE,
    PAGE_RESPONSE_SOURCE,
} from '../content/pageBridgeProtocol';

let finishJoin: (response: unknown) => void = () => undefined;
const joinResult = new Promise((resolve) => {
    finishJoin = resolve;
});
const sendMessage = jest.fn(() => joinResult);

Object.defineProperty(globalThis, 'chrome', {
    value: { runtime: { sendMessage } },
    writable: true,
});

function postJoin() {
    window.dispatchEvent(
        new MessageEvent('message', {
            source: window,
            origin: window.location.origin,
            data: {
                source: PAGE_REQUEST_SOURCE,
                id: 'join-1',
                message: { type: 'join', key: 'session-key' },
            },
        })
    );
}

describe('pageBridge content script', () => {
    beforeAll(async () => {
        await import('../content/pageBridge');
    });

    it('relays a join the page re-posts to the extension once', async () => {
        const replied = new Promise((resolve) => {
            window.addEventListener('message', (event: MessageEvent) => {
                const data = event.data as { source?: unknown } | null;
                if (data?.source === PAGE_RESPONSE_SOURCE) {
                    resolve(data);
                }
            });
        });
        postJoin();
        postJoin();
        finishJoin({ type: 'join_result', ok: true });
        expect(await replied).toEqual({
            source: PAGE_RESPONSE_SOURCE,
            id: 'join-1',
            response: { type: 'join_result', ok: true },
        });
        postJoin();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(sendMessage).toHaveBeenCalledTimes(1);
        expect(sendMessage).toHaveBeenCalledWith({
            type: PAGE_BRIDGE_TYPE,
            payload: { type: 'join', key: 'session-key' },
        });
    });
});
