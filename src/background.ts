import { STORAGE_KEYS } from './types';
import { refreshIconIndicator } from './util';

const MIRRORD_UI_CONFIGURE_TYPE = 'mirrord-ui-configure';
const TRUSTED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

type ConfigureMessage = {
    type: typeof MIRRORD_UI_CONFIGURE_TYPE;
    backend: string;
    token: string;
};

chrome.runtime.onStartup.addListener(refreshIcon);
chrome.runtime.onInstalled.addListener(refreshIcon);

chrome.runtime.onMessageExternal.addListener(
    (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: { ok: boolean; error?: string }) => void
    ) => {
        if (!isTrustedSender(sender)) {
            sendResponse({ ok: false, error: 'untrusted sender' });
            return;
        }
        if (!isConfigureMessage(message)) {
            sendResponse({ ok: false, error: 'unknown message' });
            return;
        }
        chrome.storage.local.set(
            {
                [STORAGE_KEYS.MIRRORD_UI_BACKEND]: message.backend,
                [STORAGE_KEYS.MIRRORD_UI_TOKEN]: message.token,
            },
            () => {
                if (chrome.runtime.lastError) {
                    sendResponse({
                        ok: false,
                        error: chrome.runtime.lastError.message,
                    });
                } else {
                    sendResponse({ ok: true });
                }
            }
        );
        return true;
    }
);

function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
    if (!sender.url) return false;
    try {
        const origin = new URL(sender.url).origin;
        return TRUSTED_ORIGIN.test(origin);
    } catch {
        return false;
    }
}

function isConfigureMessage(value: unknown): value is ConfigureMessage {
    if (typeof value !== 'object' || value === null) return false;
    const m = value as Record<string, unknown>;
    return (
        m.type === MIRRORD_UI_CONFIGURE_TYPE &&
        typeof m.backend === 'string' &&
        typeof m.token === 'string'
    );
}

function refreshIcon() {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        refreshIconIndicator(rules.length);
    });
}
