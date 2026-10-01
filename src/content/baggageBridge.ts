const CONFIG_EVENT = 'mirrord-baggage-config';
const CONFIG_REQUEST = 'mirrord-baggage-config-request';

function publish(detail: string) {
    document.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail }));
}

chrome.runtime
    .sendMessage({ type: CONFIG_REQUEST })
    .then((entries: unknown) => publish(JSON.stringify(entries ?? [])))
    .catch(() => publish('[]'));
