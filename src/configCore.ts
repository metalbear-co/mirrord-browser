// Pure config-payload helpers shared by the in-extension config page (config.ts) and the
// metalbear.com content script. Kept free of module-level side effects so it can be imported
// into a content script without dragging in config.ts's page bootstrap (which would alert on
// any page that lacks a `?payload=`).
import type { Config } from './types';
import { emitUserBlocked } from './analytics';

/**
 * Check if the input string is a regex or an explicit HTTP header.
 * @param str a string value that's either a regex or an explicit HTTP header
 */
export function isRegex(str: string): boolean {
    const regexIndicators = [
        /\\[dDsSwWbB]/, // escaped shorthand classes
        /\\./, // escaped dot
        /[.*+?^${}()|[\]]/, // unescaped special characters
    ];
    return regexIndicators.some((pattern) => pattern.test(str));
}

/**
 * Parse the input string value and return an HTTP header key-value pair.
 * @param header a string value to be parsed as HTTP header key and value
 */
export function parseHeader(header: string): { key: string; value: string } {
    // Split on the first colon only so header values may themselves contain colons
    // (e.g. `X-Forwarded: host:8080`, `baggage: mirrord-session=k1`).
    const separator = header.indexOf(':');
    const key = separator === -1 ? '' : header.slice(0, separator).trim();
    const value = separator === -1 ? '' : header.slice(separator + 1).trim();
    if (!key || !value) {
        emitUserBlocked('configure_invalid', 'user_action', {
            error: 'Invalid header format.',
        });
        throw new Error('Invalid header format.');
    }
    return { key, value };
}

/**
 * Decode the given base64 string into a configuration object. Throws on malformed input.
 * @param encoded a base64 encoded string configuration payload
 */
export function decodeConfig(encoded: string): Config {
    let decoded: string;
    try {
        decoded = atob(encoded);
    } catch {
        emitUserBlocked('configure_invalid', 'user_action', {
            error: 'Invalid configuration',
        });
        throw new Error('Invalid configuration');
    }
    try {
        return JSON.parse(decoded) as Config;
    } catch {
        emitUserBlocked('configure_invalid', 'user_action', {
            error: 'Invalid configuration',
        });
        throw new Error('Invalid configuration');
    }
}

/**
 * Prompt the user for an HTTP header value that matches the given pattern.
 * @param pattern a regex pattern for HTTP headers
 */
export function promptForValidHeader(pattern: string): string {
    const regex = new RegExp(pattern);
    let header: string | null = null;

    while (!header) {
        const input = prompt(
            `Enter a header that matches pattern:\n${pattern}`
        );
        if (!input) {
            alert('No input provided.');
            continue;
        }
        if (!regex.test(input)) {
            alert('Input does not match the required pattern.');
            continue;
        }
        header = input;
    }

    return header;
}
