import { useState, useEffect, useCallback } from 'react';
import { refreshIconIndicator, parseRules } from '../util';
import {
    StoredConfig,
    HeaderRule,
    STORAGE_KEYS,
    ALL_RESOURCE_TYPES,
} from '../types';
import { STRINGS } from '../constants';
import { capture } from '../analytics';

type SaveState = 'idle' | 'saving' | 'saved';
type ResetState = 'idle' | 'resetting' | 'reset';

export function useHeaderRules() {
    const [rules, setRules] = useState<HeaderRule[]>([]);
    const [headerName, setHeaderName] = useState('');
    const [headerValue, setHeaderValue] = useState('');
    const [scope, setScope] = useState('');
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [resetState, setResetState] = useState<ResetState>('idle');
    const [hasDefaults, setHasDefaults] = useState(false);

    const loadRules = useCallback(() => {
        chrome.declarativeNetRequest.getDynamicRules((chromeRules) => {
            const parsed = parseRules(chromeRules);
            setRules(parsed);
            refreshIconIndicator(parsed.length);
        });
    }, []);

    const loadFormValues = useCallback(() => {
        chrome.storage.local.get(
            [STORAGE_KEYS.OVERRIDE, STORAGE_KEYS.DEFAULTS],
            (result) => {
                const config: StoredConfig | undefined =
                    result[STORAGE_KEYS.OVERRIDE] ||
                    result[STORAGE_KEYS.DEFAULTS];

                if (config) {
                    setHeaderName(config.headerName || '');
                    setHeaderValue(config.headerValue || '');
                    setScope(config.scope || '');
                }

                setHasDefaults(!!result[STORAGE_KEYS.DEFAULTS]);
            }
        );
    }, []);

    useEffect(() => {
        loadRules();
        loadFormValues();
    }, [loadRules, loadFormValues]);

    const handleRemove = useCallback(
        (ruleId: number) => {
            chrome.declarativeNetRequest.updateDynamicRules(
                { removeRuleIds: [ruleId] },
                () => {
                    if (!chrome.runtime.lastError) {
                        loadRules();
                        capture('extension_header_rule_removed');
                    } else {
                        console.error(
                            STRINGS.ERR_REMOVE_RULE,
                            chrome.runtime.lastError
                        );
                        capture('extension_error', {
                            action: 'remove',
                            error: chrome.runtime.lastError.message,
                        });
                    }
                }
            );
        },
        [loadRules]
    );

    const handleSave = useCallback(async () => {
        if (!headerName.trim() || !headerValue.trim()) {
            alert(STRINGS.ERR_HEADER_REQUIRED);
            return;
        }

        setSaveState('saving');

        const override: StoredConfig = {
            headerName: headerName.trim(),
            headerValue: headerValue.trim(),
            scope: scope.trim() || undefined,
        };

        const urlFilter = scope.trim() || '|';

        const newRules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType
                        .MODIFY_HEADERS,
                    requestHeaders: [
                        {
                            header: headerName.trim(),
                            operation:
                                chrome.declarativeNetRequest.HeaderOperation
                                    .SET,
                            value: headerValue.trim(),
                        },
                    ],
                },
                condition: {
                    urlFilter,
                    resourceTypes: ALL_RESOURCE_TYPES,
                },
            },
        ];

        chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
            chrome.declarativeNetRequest.updateDynamicRules(
                {
                    removeRuleIds: existingRules.map((r) => r.id),
                    addRules: newRules,
                },
                () => {
                    if (chrome.runtime.lastError) {
                        alert(
                            `${STRINGS.ERR_SAVE_FAILED}: ${chrome.runtime.lastError.message}`
                        );
                        setSaveState('idle');
                        capture('extension_error', {
                            action: 'save',
                            step: 'update_rules',
                            error: chrome.runtime.lastError.message,
                        });
                        return;
                    }

                    chrome.storage.local.set(
                        { [STORAGE_KEYS.OVERRIDE]: override },
                        () => {
                            if (chrome.runtime.lastError) {
                                alert(
                                    `${STRINGS.ERR_SAVE_FAILED}: ${chrome.runtime.lastError.message}`
                                );
                                setSaveState('idle');
                                capture('extension_error', {
                                    action: 'save',
                                    step: 'storage_write',
                                    error: chrome.runtime.lastError.message,
                                });
                                return;
                            }

                            loadRules();
                            setSaveState('saved');
                            setTimeout(() => setSaveState('idle'), 1500);
                            capture('extension_header_rule_saved', {
                                has_scope: !!scope.trim(),
                            });
                        }
                    );
                }
            );
        });
    }, [headerName, headerValue, scope, loadRules]);

    const handleReset = useCallback(() => {
        setResetState('resetting');

        chrome.storage.local.get([STORAGE_KEYS.DEFAULTS], (result) => {
            const defaults: StoredConfig | undefined =
                result[STORAGE_KEYS.DEFAULTS];

            if (!defaults) {
                alert(STRINGS.ERR_NO_DEFAULTS);
                setResetState('idle');
                return;
            }

            chrome.storage.local.remove([STORAGE_KEYS.OVERRIDE], () => {
                if (chrome.runtime.lastError) {
                    alert(
                        `${STRINGS.ERR_RESET_FAILED}: ${chrome.runtime.lastError.message}`
                    );
                    setResetState('idle');
                    capture('extension_error', {
                        action: 'reset',
                        step: 'storage_remove',
                        error: chrome.runtime.lastError.message,
                    });
                    return;
                }

                const urlFilter = defaults.scope || '|';
                const newRules: chrome.declarativeNetRequest.Rule[] = [
                    {
                        id: 1,
                        priority: 1,
                        action: {
                            type: chrome.declarativeNetRequest.RuleActionType
                                .MODIFY_HEADERS,
                            requestHeaders: [
                                {
                                    header: defaults.headerName,
                                    operation:
                                        chrome.declarativeNetRequest
                                            .HeaderOperation.SET,
                                    value: defaults.headerValue,
                                },
                            ],
                        },
                        condition: {
                            urlFilter,
                            resourceTypes: ALL_RESOURCE_TYPES,
                        },
                    },
                ];

                chrome.declarativeNetRequest.getDynamicRules(
                    (existingRules) => {
                        chrome.declarativeNetRequest.updateDynamicRules(
                            {
                                removeRuleIds: existingRules.map((r) => r.id),
                                addRules: newRules,
                            },
                            () => {
                                if (chrome.runtime.lastError) {
                                    alert(
                                        `${STRINGS.ERR_RESET_FAILED}: ${chrome.runtime.lastError.message}`
                                    );
                                    setResetState('idle');
                                    capture('extension_error', {
                                        action: 'reset',
                                        step: 'update_rules',
                                        error: chrome.runtime.lastError.message,
                                    });
                                    return;
                                }

                                setHeaderName(defaults.headerName);
                                setHeaderValue(defaults.headerValue);
                                setScope(defaults.scope || '');
                                loadRules();
                                setResetState('reset');
                                setTimeout(() => setResetState('idle'), 1500);
                                capture('extension_header_rule_reset');
                            }
                        );
                    }
                );
            });
        });
    }, [loadRules]);

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
        hasDefaults,
        setHeaderName,
        setHeaderValue,
        setScope,
        handleRemove,
        handleSave,
        handleReset,
        getSaveButtonText,
        getResetButtonText,
    };
}
