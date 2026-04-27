import RandExp from 'randexp';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Config, HeaderRule, ALL_RESOURCE_TYPES } from './types';
import { STRINGS } from './constants';

dayjs.extend(relativeTime);

export function refreshIconIndicator(num: number) {
    chrome.action.setBadgeTextColor({ color: '#ADD8E6' });
    if (num > 0) {
        chrome.action.setBadgeText({ text: '✓' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

function getDisplayScope(urlFilter: string | undefined): string {
    const isWildcard = !urlFilter || urlFilter === '|';
    return isWildcard ? STRINGS.MSG_ALL_URLS : urlFilter;
}

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
    const parsed = dayjs(iso);
    if (!parsed.isValid()) return '';
    return parsed.fromNow();
}

export function encodeConfig(config: Config): string {
    return btoa(JSON.stringify(config));
}

export function buildShareUrl(config: Config): string {
    const encoded = encodeConfig(config);
    return `chrome-extension://${chrome.runtime.id}/pages/config.html?payload=${encoded}`;
}

export type InjectionHint = {
    header: string;
    value: string;
};

const HEADER_LINE_PATTERN = /^([A-Za-z0-9_-]+):\s?(.+)$/;

function generateLowestMatch(pattern: string): string | null {
    try {
        const re = new RandExp(pattern);
        re.max = 0;
        re.randInt = (from) => from;
        return re.gen();
    } catch {
        return null;
    }
}

function parseHeaderLine(line: string): InjectionHint | null {
    const m = line.match(HEADER_LINE_PATTERN);
    if (!m) return null;
    return { header: m[1], value: m[2] };
}

export function deriveInjectionHint(
    headerFilter: string | null | undefined
): InjectionHint | null {
    if (!headerFilter) return null;
    const trimmed = headerFilter.trim();
    if (!trimmed) return null;
    const generated = generateLowestMatch(trimmed);
    if (!generated) return null;
    return parseHeaderLine(generated);
}
