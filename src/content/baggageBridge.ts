const CONFIG_EVENT = 'mirrord-baggage-config';
const CONFIG_REQUEST = 'mirrord-baggage-config-request';
const CONFIG_UPDATE = 'mirrord-baggage-config-update';

function publish(entries: unknown) {
    document.dispatchEvent(
        new CustomEvent(CONFIG_EVENT, { detail: JSON.stringify(entries ?? []) })
    );
}

chrome.runtime.onMessage.addListener((message: unknown) => {
    const update = message as { type?: unknown; entries?: unknown } | null;
    if (update?.type === CONFIG_UPDATE) {
        publish(update.entries);
    }
});

function requestConfig() {
    chrome.runtime
        .sendMessage({ type: CONFIG_REQUEST })
        .then(publish)
        .catch(() => publish([]));
}

requestConfig();

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        requestConfig();
    }
});
