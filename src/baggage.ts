export const BAGGAGE_HEADER = 'baggage';

export interface BaggageEntry {
    value: string;
    filters: string[];
}

const SEPARATOR = '(?:[^A-Za-z0-9_\\-.%]|$)';
const DOMAIN_ANCHOR = '^[a-z][a-z0-9+.-]*://(?:[^/?#]*\\.)?';

function escapeRegExp(text: string): string {
    return text.replace(/[.+?${}()[\]\\/]/g, '\\$&');
}

/** Mirrors DNR `urlFilter` syntax, which matches case-insensitively by default. */
export function urlFilterToRegExp(filter: string): RegExp {
    let rest = filter;
    let prefix = '';
    let suffix = '';

    if (rest.startsWith('||')) {
        prefix = DOMAIN_ANCHOR;
        rest = rest.slice(2);
    } else if (rest.startsWith('|')) {
        prefix = '^';
        rest = rest.slice(1);
    }

    if (rest.endsWith('|')) {
        suffix = '$';
        rest = rest.slice(0, -1);
    }

    const body = rest
        .split('')
        .map((char) =>
            char === '*' ? '.*' : char === '^' ? SEPARATOR : escapeRegExp(char)
        )
        .join('');

    return new RegExp(prefix + body + suffix, 'i');
}

export function entryForUrl(
    url: string,
    entries: readonly BaggageEntry[]
): string | undefined {
    return entries.find((entry) =>
        entry.filters.some((filter) => urlFilterToRegExp(filter).test(url))
    )?.value;
}

function memberKey(member: string): string {
    return (member.split(/[=;]/, 1)[0] ?? '').trim();
}

/** Adds `entry` to a W3C baggage list, replacing any member with the same key. */
export function mergeBaggage(existing: string | null, entry: string): string {
    if (!existing) {
        return entry;
    }

    const key = memberKey(entry);
    const members = existing
        .split(',')
        .map((member) => member.trim())
        .filter((member) => member.length > 0 && memberKey(member) !== key);

    return [...members, entry].join(',');
}

function isEntry(entry: unknown): entry is BaggageEntry {
    if (typeof entry !== 'object' || entry === null) {
        return false;
    }
    const { value, filters } = entry as Partial<Record<string, unknown>>;
    return (
        typeof value === 'string' &&
        Array.isArray(filters) &&
        filters.every((filter) => typeof filter === 'string')
    );
}

export function parseEntries(raw: unknown): BaggageEntry[] {
    if (typeof raw !== 'string') {
        return [];
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
    } catch {
        return [];
    }
}
