import { Config, HeaderRule, ALL_RESOURCE_TYPES } from './types';
import { STRINGS } from './constants';

/**
 * Refresh browser extension icon badge text based on the number of
 * active request rules.
 *
 * @param num number of active request rules managed by the extension
 */
export function refreshIconIndicator(num: number) {
    chrome.action.setBadgeTextColor({ color: '#ADD8E6' });
    if (num > 0) {
        chrome.action.setBadgeText({ text: '✓' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

/**
 * Determine the display scope from a URL filter.
 * Returns "All URLs" for wildcard/empty filters, otherwise the actual filter.
 */
function getDisplayScope(urlFilter: string | undefined): string {
    const isWildcard = !urlFilter || urlFilter === '|';
    return isWildcard ? STRINGS.MSG_ALL_URLS : urlFilter;
}

/**
 * Parse Chrome declarativeNetRequest rules into a simplified HeaderRule format.
 *
 * @param rules Chrome declarativeNetRequest rules
 * @returns Parsed header rules for display
 */
export function parseRules(
    rules: chrome.declarativeNetRequest.Rule[]
): HeaderRule[] {
    return rules
        .filter(
            (rule) =>
                rule.action.type ===
                    chrome.declarativeNetRequest.RuleActionType
                        .MODIFY_HEADERS && rule.action.requestHeaders
        )
        .map((rule) => {
            const requestHeader = rule.action.requestHeaders?.[0];
            const urlFilter = rule.condition?.urlFilter;
            return {
                id: rule.id,
                header: requestHeader?.header || '',
                value: requestHeader?.value || '',
                scope: getDisplayScope(urlFilter),
            };
        });
}

/**
 * Build a declarativeNetRequest rule for header injection.
 * Conceptual inverse of parseRules.
 */
export function buildDnrRule(
    header: string,
    value: string,
    scope?: string
): chrome.declarativeNetRequest.Rule[] {
    return [
        {
            id: 1,
            priority: 1,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType
                    .MODIFY_HEADERS,
                requestHeaders: [
                    {
                        header,
                        operation:
                            chrome.declarativeNetRequest.HeaderOperation.SET,
                        value,
                    },
                ],
            },
            condition: {
                urlFilter: scope || '|',
                resourceTypes: ALL_RESOURCE_TYPES,
            },
        },
    ];
}

// --- Promisified Chrome API wrappers ---

export function getDynamicRules(): Promise<
    chrome.declarativeNetRequest.Rule[]
> {
    return new Promise((resolve) => {
        chrome.declarativeNetRequest.getDynamicRules((rules) => {
            resolve(rules);
        });
    });
}

export function updateDynamicRules(
    opts: chrome.declarativeNetRequest.UpdateRuleOptions
): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.declarativeNetRequest.updateDynamicRules(opts, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

export function storageGet(keys: string[]): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
            resolve(result);
        });
    });
}

export function storageSet(data: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

export function storageRemove(keys: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.remove(keys, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

export function formatRelativeTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return '';
    const diff = Date.now() - then;
    const s = Math.max(0, Math.floor(diff / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

export function encodeConfig(config: Config): string {
    return btoa(JSON.stringify(config));
}

export function buildShareUrl(config: Config): string {
    const encoded = encodeConfig(config);
    return `chrome-extension://${chrome.runtime.id}/pages/config.html?payload=${encoded}`;
}

/**
 */
export type InjectionHint = {
    header: string;
    value: string;
};

/**
 *
 */
export function deriveInjectionHint(
    headerFilter: string | null | undefined
): InjectionHint | null {
    if (!headerFilter) return null;
    const trimmed = headerFilter.trim();
    if (!trimmed) return null;

    const substring = trimmed.match(/^\^([A-Za-z0-9_-]+):\s?\.\*(.+?)\.\*\$$/);
    if (substring) {
        const value = unescapeRegexLiteral(substring[2]);
        if (value !== null) return { header: substring[1], value };
    }

    const exact = trimmed.match(/^\^([A-Za-z0-9_-]+):\s?(.+?)\$$/);
    if (exact) {
        const value = unescapeRegexLiteral(exact[2]);
        if (value !== null) return { header: exact[1], value };
    }

    const loose = trimmed.match(/^([A-Za-z0-9_-]+):\s?(.+)$/);
    if (loose) {
        const value = unescapeRegexLiteral(loose[2]);
        if (value !== null) return { header: loose[1], value };
    }

    return null;
}

/**
 */
function unescapeRegexLiteral(fragment: string): string | null {
    const unescaped = fragment.replace(/\\(.)/g, '$1');
    if (/[\^\$\*\+\?\(\)\[\]\{\}\|]/.test(unescaped)) return null;
    return unescaped;
}
