import { StrictMode, useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import {
    Button,
    Card,
    Badge,
    Tooltip,
    TooltipProvider,
    Input,
    Label,
} from '@metalbear/ui';
import { refreshIconIndicator } from './util';
import { StoredConfig, STORAGE_KEYS } from './types';
import { STRINGS } from './constants';

type HeaderRule = {
    id: number;
    header: string;
    value: string;
    scope: string;
};

function parseRules(rules: chrome.declarativeNetRequest.Rule[]): HeaderRule[] {
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
                scope:
                    urlFilter === '|'
                        ? STRINGS.MSG_ALL_URLS
                        : urlFilter || STRINGS.MSG_ALL_URLS,
            };
        });
}

function RuleItem({
    rule,
    onRemove,
}: {
    rule: HeaderRule;
    onRemove: (id: number) => void;
}) {
    return (
        <div className="flex flex-col gap-1 p-3 rounded-lg bg-card border border-border">
            <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono break-all">
                    {rule.header}: {rule.value}
                </code>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(rule.id)}
                    className="shrink-0 h-7 w-7 p-0"
                >
                    ✕
                </Button>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                    {rule.scope}
                </Badge>
            </div>
        </div>
    );
}

function RulesList({
    rules,
    onRemove,
}: {
    rules: HeaderRule[];
    onRemove: (id: number) => void;
}) {
    if (rules.length === 0) {
        return (
            <div className="text-sm text-muted-foreground text-center py-4">
                {STRINGS.MSG_NO_ACTIVE_HEADERS}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {rules.map((rule) => (
                <RuleItem key={rule.id} rule={rule} onRemove={onRemove} />
            ))}
        </div>
    );
}

type SaveState = 'idle' | 'saving' | 'saved';
type ResetState = 'idle' | 'resetting' | 'reset';

export function Popup() {
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
                    } else {
                        console.error(
                            STRINGS.ERR_REMOVE_RULE,
                            chrome.runtime.lastError
                        );
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
                    resourceTypes: [
                        chrome.declarativeNetRequest.ResourceType
                            .XMLHTTPREQUEST,
                        chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                        chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                    ],
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
                                return;
                            }

                            loadRules();
                            setSaveState('saved');
                            setTimeout(() => setSaveState('idle'), 1500);
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
                            resourceTypes: [
                                chrome.declarativeNetRequest.ResourceType
                                    .XMLHTTPREQUEST,
                                chrome.declarativeNetRequest.ResourceType
                                    .MAIN_FRAME,
                                chrome.declarativeNetRequest.ResourceType
                                    .SUB_FRAME,
                            ],
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
                                    return;
                                }

                                setHeaderName(defaults.headerName);
                                setHeaderValue(defaults.headerValue);
                                setScope(defaults.scope || '');
                                loadRules();
                                setResetState('reset');
                                setTimeout(() => setResetState('idle'), 1500);
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

    return (
        <div className="min-w-[320px] p-3 flex flex-col gap-3">
            <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                    <h1 className="text-base font-semibold">
                        {STRINGS.HEADER_TITLE}
                    </h1>
                    <Tooltip content={STRINGS.TOOLTIP_HEADERS}>
                        <span className="text-muted-foreground cursor-help">
                            ⓘ
                        </span>
                    </Tooltip>
                </div>
                <RulesList rules={rules} onRemove={handleRemove} />
            </Card>

            <Card className="p-4">
                <h2 className="text-sm font-semibold mb-3">
                    {STRINGS.SECTION_CONFIGURE_HEADER}
                </h2>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="headerName">
                            {STRINGS.LABEL_HEADER_NAME}
                        </Label>
                        <Input
                            id="headerName"
                            value={headerName}
                            onChange={(e) => setHeaderName(e.target.value)}
                            placeholder={STRINGS.PLACEHOLDER_HEADER_NAME}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="headerValue">
                            {STRINGS.LABEL_HEADER_VALUE}
                        </Label>
                        <Input
                            id="headerValue"
                            value={headerValue}
                            onChange={(e) => setHeaderValue(e.target.value)}
                            placeholder={STRINGS.PLACEHOLDER_HEADER_VALUE}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <Label htmlFor="scope">
                                {STRINGS.LABEL_URL_SCOPE}
                            </Label>
                            <Tooltip content={STRINGS.TOOLTIP_SCOPE}>
                                <span className="text-muted-foreground cursor-help text-xs">
                                    ⓘ
                                </span>
                            </Tooltip>
                        </div>
                        <Input
                            id="scope"
                            value={scope}
                            onChange={(e) => setScope(e.target.value)}
                            placeholder={STRINGS.PLACEHOLDER_SCOPE}
                        />
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Button
                            onClick={handleSave}
                            disabled={saveState !== 'idle'}
                            className="flex-1"
                        >
                            {getSaveButtonText()}
                        </Button>
                        {hasDefaults && (
                            <Button
                                variant="outline"
                                onClick={handleReset}
                                disabled={resetState !== 'idle'}
                            >
                                {getResetButtonText()}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <TooltipProvider>
                <Popup />
            </TooltipProvider>
        </StrictMode>
    );
}
