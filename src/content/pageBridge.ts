import {
    MIRRORD_UI_CONFIGURE_TYPE,
    PAGE_BRIDGE_TYPE,
    PAGE_REQUEST_SOURCE,
    PAGE_RESPONSE_SOURCE,
} from './pageBridgeProtocol';

// The monitor re-posts each request until answered; only pings, which are safe to repeat, are forgotten after the reply.
const seenIds = new Set<string>();

window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) {
        return;
    }
    const data = event.data as {
        source?: unknown;
        id?: unknown;
        message?: unknown;
    } | null;
    if (data?.source !== PAGE_REQUEST_SOURCE || typeof data.id !== 'string') {
        return;
    }
    const id = data.id;
    if (seenIds.has(id)) {
        return;
    }
    seenIds.add(id);
    const isPing = (data.message as { type?: unknown } | null)?.type === 'ping';
    const reply = (response: unknown) => {
        window.postMessage(
            { source: PAGE_RESPONSE_SOURCE, id, response },
            window.location.origin
        );
        if (isPing) {
            seenIds.delete(id);
        }
    };
    void toExtensionMessage(data.message)
        .then((payload) =>
            payload
                ? chrome.runtime.sendMessage({
                      type: PAGE_BRIDGE_TYPE,
                      payload,
                  })
                : { ok: false, error: 'mirrord ui token unavailable' }
        )
        .then(reply, () => reply(null));
});

// The token never travels through page messages: read it from the page's own server instead.
async function toExtensionMessage(message: unknown): Promise<unknown> {
    if (
        (message as { type?: unknown } | null)?.type !==
        MIRRORD_UI_CONFIGURE_TYPE
    ) {
        return message;
    }
    try {
        const response = await fetch(`${window.location.origin}/api/token`, {
            credentials: 'same-origin',
        });
        const token = response.ok
            ? ((await response.json()) as { token?: unknown }).token
            : null;
        return typeof token === 'string' && token
            ? {
                  type: MIRRORD_UI_CONFIGURE_TYPE,
                  backend: window.location.origin,
                  token,
              }
            : null;
    } catch {
        return null;
    }
}
