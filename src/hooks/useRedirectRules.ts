import { useCallback, useEffect, useState } from 'react';
import {
    addRedirectRule,
    getRedirectRules,
    removeRedirectRule,
} from '../redirects';
import type { RedirectRule } from '../types';
import { STORAGE_KEYS } from '../types';
import { STRINGS } from '../constants';
import { capture, emitUserBlocked, emitUserSucceeded } from '../analytics';

export function useRedirectRules() {
    const [redirects, setRedirects] = useState<RedirectRule[]>([]);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setRedirects(await getRedirectRules());
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        const listener = (
            changes: Record<string, chrome.storage.StorageChange>
        ) => {
            if (STORAGE_KEYS.REDIRECT_RULES in changes) {
                void load();
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, [load]);

    const handleAdd = useCallback(async () => {
        setError(null);
        const trimmedFrom = from.trim();
        const trimmedTo = to.trim();
        if (!trimmedFrom || !trimmedTo) {
            setError(STRINGS.ERR_REDIRECT_REQUIRED);
            return;
        }
        try {
            await addRedirectRule({ from: trimmedFrom, to: trimmedTo });
            setFrom('');
            setTo('');
            capture('extension_redirect_rule_added');
            emitUserSucceeded('redirect_rule_added', 'user_action');
        } catch (e) {
            // Chrome rejects patterns that aren't valid RE2 or substitutions
            // without a matching regexFilter; surface its message verbatim.
            const msg =
                e instanceof Error ? e.message : STRINGS.ERR_REDIRECT_INVALID;
            setError(msg);
            capture('extension_error', { action: 'add_redirect', error: msg });
            emitUserBlocked('redirect_rule_add_failed', 'user_action', {
                error: msg,
            });
        }
    }, [from, to]);

    const handleRemove = useCallback(async (index: number) => {
        setError(null);
        try {
            await removeRedirectRule(index);
            capture('extension_redirect_rule_removed');
            emitUserSucceeded('redirect_rule_removed', 'user_action');
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : STRINGS.ERR_REDIRECT_INVALID;
            setError(msg);
            capture('extension_error', {
                action: 'remove_redirect',
                error: msg,
            });
            emitUserBlocked('redirect_rule_remove_failed', 'user_action', {
                error: msg,
            });
        }
    }, []);

    return {
        redirects,
        from,
        to,
        error,
        setFrom,
        setTo,
        handleAdd,
        handleRemove,
    };
}
