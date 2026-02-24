import { useState, useEffect, useCallback } from 'react';
import {
    refreshIconIndicator,
    parseRules,
    buildDnrRule,
    getDynamicRules,
    updateDynamicRules,
    storageGet,
    storageSet,
    storageRemove,
    buildShareUrl,
} from '../util';
import { Config, StoredConfig, STORAGE_KEYS } from '../types';
import { STRINGS } from '../constants';
import { capture } from '../analytics';

type SaveState = 'idle' | 'saving' | 'saved';
type ResetState = 'idle' | 'resetting' | 'reset';
type ShareState = 'idle' | 'copied';

export function useHeaderRules() {
    const [rules, setRules] = useState<ReturnType<typeof parseRules>>([]);
    const [headerName, setHeaderName] = useState('');
    const [headerValue, setHeaderValue] = useState('');
    const [scope, setScope] = useState('');
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [resetState, setResetState] = useState<ResetState>('idle');
    const [hasDefaults, setHasDefaults] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasStoredConfig, setHasStoredConfig] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [shareState, setShareState] = useState<ShareState>('idle');

    const canShare = !!headerName.trim() && !!headerValue.trim();

    const loadRules = useCallback(async () => {
        const chromeRules = await getDynamicRules();
        const parsed = parseRules(chromeRules);
        setRules(parsed);
        refreshIconIndicator(parsed.length);
    }, []);

    const loadFormValues = useCallback(async () => {
        const result = await storageGet([
            STORAGE_KEYS.OVERRIDE,
            STORAGE_KEYS.DEFAULTS,
        ]);
        const config: StoredConfig | undefined =
            (result[STORAGE_KEYS.OVERRIDE] as StoredConfig | undefined) ||
            (result[STORAGE_KEYS.DEFAULTS] as StoredConfig | undefined);

        if (config) {
            setHeaderName(config.headerName || '');
            setHeaderValue(config.headerValue || '');
            setScope(config.scope || '');
        }

        setHasStoredConfig(!!config);
        setHasDefaults(!!result[STORAGE_KEYS.DEFAULTS]);
    }, []);

    useEffect(() => {
        loadRules();
        loadFormValues();
    }, [loadRules, loadFormValues]);

    const handleActivate = useCallback(async () => {
        setError(null);

        const result = await storageGet([
            STORAGE_KEYS.OVERRIDE,
            STORAGE_KEYS.DEFAULTS,
        ]);
        const config: StoredConfig | undefined =
            (result[STORAGE_KEYS.OVERRIDE] as StoredConfig | undefined) ||
            (result[STORAGE_KEYS.DEFAULTS] as StoredConfig | undefined);

        if (!config) return;

        const newRules = buildDnrRule(
            config.headerName,
            config.headerValue,
            config.scope
        );

        try {
            const existingRules = await getDynamicRules();
            await updateDynamicRules({
                removeRuleIds: existingRules.map((r) => r.id),
                addRules: newRules,
            });
            setHeaderName(config.headerName);
            setHeaderValue(config.headerValue);
            setScope(config.scope || '');
            await loadRules();
            capture('extension_header_rule_activated');
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : STRINGS.ERR_SAVE_FAILED;
            setError(msg);
            console.error(STRINGS.ERR_SAVE_FAILED, e);
            capture('extension_error', {
                action: 'activate',
                error: msg,
            });
        }
    }, [loadRules]);

    const handleRemove = useCallback(
        async (ruleId: number) => {
            setError(null);

            try {
                await updateDynamicRules({ removeRuleIds: [ruleId] });
                await loadRules();
                capture('extension_header_rule_removed');
            } catch (e) {
                const msg =
                    e instanceof Error ? e.message : STRINGS.ERR_REMOVE_RULE;
                setError(msg);
                console.error(STRINGS.ERR_REMOVE_RULE, e);
                capture('extension_error', {
                    action: 'remove',
                    error: msg,
                });
            }
        },
        [loadRules]
    );

    const handleToggle = useCallback(async () => {
        if (isToggling) return;
        setIsToggling(true);

        try {
            if (rules.length > 0) {
                await handleRemove(rules[0].id);
            } else {
                await handleActivate();
            }
        } finally {
            setIsToggling(false);
        }
    }, [rules, handleRemove, handleActivate, isToggling]);

    const handleSave = useCallback(async () => {
        setError(null);

        if (!headerName.trim() || !headerValue.trim()) {
            setError(STRINGS.ERR_HEADER_REQUIRED);
            return;
        }

        setSaveState('saving');

        const override: StoredConfig = {
            headerName: headerName.trim(),
            headerValue: headerValue.trim(),
            scope: scope.trim() || undefined,
        };

        const newRules = buildDnrRule(
            headerName.trim(),
            headerValue.trim(),
            scope.trim() || undefined
        );

        try {
            const existingRules = await getDynamicRules();
            await updateDynamicRules({
                removeRuleIds: existingRules.map((r) => r.id),
                addRules: newRules,
            });
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : STRINGS.ERR_SAVE_FAILED;
            setError(`${STRINGS.ERR_SAVE_FAILED}: ${msg}`);
            setSaveState('idle');
            capture('extension_error', {
                action: 'save',
                step: 'update_rules',
                error: msg,
            });
            return;
        }

        try {
            await storageSet({ [STORAGE_KEYS.OVERRIDE]: override });
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : STRINGS.ERR_SAVE_FAILED;
            setError(`${STRINGS.ERR_SAVE_FAILED}: ${msg}`);
            setSaveState('idle');
            capture('extension_error', {
                action: 'save',
                step: 'storage_write',
                error: msg,
            });
            return;
        }

        await loadRules();
        setHasStoredConfig(true);
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 1500);
        capture('extension_header_rule_saved', {
            has_scope: !!scope.trim(),
        });
    }, [headerName, headerValue, scope, loadRules]);

    const handleReset = useCallback(async () => {
        setError(null);
        setResetState('resetting');

        const result = await storageGet([STORAGE_KEYS.DEFAULTS]);
        const defaults: StoredConfig | undefined = result[
            STORAGE_KEYS.DEFAULTS
        ] as StoredConfig | undefined;

        if (!defaults) {
            setError(STRINGS.ERR_NO_DEFAULTS);
            setResetState('idle');
            return;
        }

        try {
            await storageRemove([STORAGE_KEYS.OVERRIDE]);
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : STRINGS.ERR_RESET_FAILED;
            setError(`${STRINGS.ERR_RESET_FAILED}: ${msg}`);
            setResetState('idle');
            capture('extension_error', {
                action: 'reset',
                step: 'storage_remove',
                error: msg,
            });
            return;
        }

        const newRules = buildDnrRule(
            defaults.headerName,
            defaults.headerValue,
            defaults.scope
        );

        try {
            const existingRules = await getDynamicRules();
            await updateDynamicRules({
                removeRuleIds: existingRules.map((r) => r.id),
                addRules: newRules,
            });
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : STRINGS.ERR_RESET_FAILED;
            setError(`${STRINGS.ERR_RESET_FAILED}: ${msg}`);
            setResetState('idle');
            capture('extension_error', {
                action: 'reset',
                step: 'update_rules',
                error: msg,
            });
            return;
        }

        setHeaderName(defaults.headerName);
        setHeaderValue(defaults.headerValue);
        setScope(defaults.scope || '');
        await loadRules();
        setResetState('reset');
        setTimeout(() => setResetState('idle'), 1500);
        capture('extension_header_rule_reset');
    }, [loadRules]);

    const handleShare = useCallback(async () => {
        if (!canShare) return;
        const config: Config = {
            header_filter: `${headerName.trim()}: ${headerValue.trim()}`,
            inject_scope: scope.trim() || undefined,
        };
        const url = buildShareUrl(config);
        await navigator.clipboard.writeText(url);
        setShareState('copied');
        capture('extension_config_shared');
        setTimeout(() => setShareState('idle'), 2000);
    }, [headerName, headerValue, scope, canShare]);

    const getSaveButtonText = () => {
        switch (saveState) {
            case 'saving':
                return STRINGS.BTN_SAVING;
            case 'saved':
                return STRINGS.BTN_SAVED;
            default:
                return STRINGS.BTN_SAVE;
        }
    };

    const getResetButtonText = () => {
        switch (resetState) {
            case 'resetting':
                return STRINGS.BTN_RESETTING;
            case 'reset':
                return STRINGS.BTN_RESET_DONE;
            default:
                return STRINGS.BTN_RESET;
        }
    };

    return {
        rules,
        headerName,
        headerValue,
        scope,
        saveState,
        resetState,
        shareState,
        hasDefaults,
        error,
        hasStoredConfig,
        isToggling,
        canShare,
        setHeaderName,
        setHeaderValue,
        setScope,
        handleToggle,
        handleSave,
        handleReset,
        handleShare,
        getSaveButtonText,
        getResetButtonText,
    };
}
