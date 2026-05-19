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
    const groups = new Map<
        string,
        { id: number; header: string; value: string; scopes: string[] }
    >();
    for (const rule of rules) {
        if (
            rule.action.type !==
                chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS ||
            !rule.action.requestHeaders
        ) {
            continue;
        }
        const requestHeader = rule.action.requestHeaders[0];
        const header = requestHeader?.header || '';
        const value = requestHeader?.value || '';
        const urlFilter = rule.condition?.urlFilter;
        const isWildcard = !urlFilter || urlFilter === '|';
        const key = `${header}\n${value}`;
        const group = groups.get(key);
        if (group) {
            if (!isWildcard) group.scopes.push(urlFilter as string);
            if (rule.id < group.id) group.id = rule.id;
        } else {
            groups.set(key, {
                id: rule.id,
                header,
                value,
                scopes: isWildcard ? [] : [urlFilter as string],
            });
        }
    }
    return Array.from(groups.values()).map((g) => ({
        id: g.id,
        header: g.header,
        value: g.value,
        scope:
            g.scopes.length === 0 ? STRINGS.MSG_ALL_URLS : g.scopes.join(', '),
    }));
}

export function buildDnrRule(
    header: string,
    value: string,
    scope?: string | string[]
): chrome.declarativeNetRequest.Rule[] {
    const patterns = Array.isArray(scope)
        ? scope.filter((p) => p.trim().length > 0)
        : scope && scope.trim().length > 0
          ? [scope]
          : [];
    const filters = patterns.length > 0 ? patterns : ['|'];
    return filters.map((urlFilter, idx) => ({
        id: idx + 1,
        priority: 1,
        action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
                {
                    header,
                    operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                    value,
                },
            ],
        },
        condition: {
            urlFilter,
            resourceTypes: ALL_RESOURCE_TYPES,
        },
    }));
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
