import {
    PAGE_BRIDGE_TYPE,
    PAGE_REQUEST_SOURCE,
    PAGE_RESPONSE_SOURCE,
} from './pageBridgeProtocol';

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
    const reply = (response: unknown) =>
        window.postMessage(
            { source: PAGE_RESPONSE_SOURCE, id, response },
            window.location.origin
        );
    chrome.runtime
        .sendMessage({ type: PAGE_BRIDGE_TYPE, payload: data.message })
        .then(reply, () => reply(null));
});
