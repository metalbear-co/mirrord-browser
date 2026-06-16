// Content script injected on localhost / 127.0.0.1 (where the `mirrord ui` poller serves its
// page). It bridges the page and the extension so the page can configure / ping / join /
// leave by `window.postMessage` instead of `chrome.runtime.sendMessage(extensionId, …)` —
// which Firefox doesn't support (no `externally_connectable`). The page posts a request, we
// relay it to the background and post the response back.
import { browser } from '../browser';
import {
    UI_BRIDGE_REQUEST_TYPE,
    UI_BRIDGE_RESPONSE_TYPE,
    UI_BRIDGE_MARKER,
    TRUSTED_UI_ORIGIN,
} from '../constants';

type RequestEnvelope = {
    type: typeof UI_BRIDGE_REQUEST_TYPE;
    requestId?: unknown;
    payload?: unknown;
};

function isRequestEnvelope(data: unknown): data is RequestEnvelope {
    return (
        typeof data === 'object' &&
        data !== null &&
        (data as { type?: unknown }).type === UI_BRIDGE_REQUEST_TYPE
    );
}

function respond(origin: string, requestId: unknown, payload: unknown): void {
    window.postMessage(
        { type: UI_BRIDGE_RESPONSE_TYPE, requestId, payload },
        origin
    );
}

window.addEventListener('message', (event: MessageEvent) => {
    // Ignore unrelated page messages; only handle our own request envelopes.
    if (!isRequestEnvelope(event.data)) return;
    // Only accept messages the page posted to itself, from a trusted localhost origin.
    if (event.source !== window) return;
    if (!TRUSTED_UI_ORIGIN.test(event.origin)) return;

    const { requestId, payload } = event.data;
    const origin = event.origin;

    browser.runtime
        .sendMessage({ [UI_BRIDGE_MARKER]: true, payload })
        .then((response) => respond(origin, requestId, response))
        .catch((err: unknown) =>
            respond(origin, requestId, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            })
        );
});
