import RandExp from 'randexp';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
    Config,
    HeaderRule,
    ALL_RESOURCE_TYPES,
    DnrRule,
    DnrUpdateOptions,
} from './types';
import { STRINGS } from './constants';
import { browser } from './browser';

dayjs.extend(relativeTime);

export function refreshIconIndicator(num: number) {
    browser.action.setBadgeTextColor({ color: '#ADD8E6' });
    if (num > 0) {
        browser.action.setBadgeText({ text: '✓' });
    } else {
        browser.action.setBadgeText({ text: '' });
    }
}

function getDisplayScope(urlFilter: string | undefined): string {
    const isWildcard = !urlFilter || urlFilter === '|';
    return isWildcard ? STRINGS.MSG_ALL_URLS : urlFilter;
}

export function parseRules(rules: DnrRule[]): HeaderRule[] {
    const groups = new Map<
        string,
        { id: number; header: string; value: string; scopes: string[] }
    >();
    for (const rule of rules) {
        if (
            rule.action.type !== 'modifyHeaders' ||
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
): DnrRule[] {
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
            type: 'modifyHeaders',
            requestHeaders: [
                {
                    header,
                    operation: 'set',
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

export function getDynamicRules(): Promise<DnrRule[]> {
    return browser.declarativeNetRequest.getDynamicRules();
}

export function updateDynamicRules(opts: DnrUpdateOptions): Promise<void> {
    return browser.declarativeNetRequest.updateDynamicRules(opts);
}

export function storageGet(keys: string[]): Promise<Record<string, unknown>> {
    return browser.storage.local.get(keys);
}

export function storageSet(data: Record<string, unknown>): Promise<void> {
    return browser.storage.local.set(data);
}

export function storageRemove(keys: string[]): Promise<void> {
    return browser.storage.local.remove(keys);
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
    const base = browser.runtime.getURL('pages/config.html');
    return `${base}?payload=${encoded}`;
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
