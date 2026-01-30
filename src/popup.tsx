import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
} from '@metalbear/ui';
import { RulesList, HeaderForm } from './components';
import { useHeaderRules } from './hooks';
import { STRINGS } from './constants';

type SaveState = 'idle' | 'saving' | 'saved';
type ResetState = 'idle' | 'resetting' | 'reset';

export function Popup() {
    const {
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
    } = useHeaderRules();

    const isActive = rules.length > 0;

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
        <TooltipProvider>
            <div className="w-[320px] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                    <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        mirrord
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        Header Injector
                    </span>
                </div>

                <Card>
                    <CardHeader className="p-3 pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <CardTitle className="text-xs">
                                    {STRINGS.SECTION_ACTIVE_HEADER}
                                </CardTitle>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="text-muted-foreground cursor-help text-[10px]">
                                            ⓘ
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs max-w-[200px]">
                                        {STRINGS.TOOLTIP_HEADERS}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Badge
                                variant={isActive ? 'default' : 'secondary'}
                                className="text-[10px] px-1.5 py-0"
                            >
                                {isActive ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="px-3 py-2">
                        <RulesList rules={rules} />
                    </CardContent>
                    {isActive && (
                        <CardFooter className="p-3 pt-0">
                            {rules.map((rule) => (
                                <Button
                                    key={rule.id}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(rule.id)}
                                    className="h-6 text-[10px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    Remove
                                </Button>
                            ))}
                        </CardFooter>
                    )}
                </Card>

                <Card>
                    <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-xs">
                            {STRINGS.SECTION_CONFIGURE_HEADER}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 py-2">
                        <HeaderForm
                            headerName={headerName}
                            headerValue={headerValue}
                            scope={scope}
                            onHeaderNameChange={setHeaderName}
                            onHeaderValueChange={setHeaderValue}
                            onScopeChange={setScope}
                        />
                    </CardContent>
                    <CardFooter className="p-3 pt-0 flex gap-2">
                        <Button
                            onClick={handleSave}
                            disabled={saveState !== 'idle'}
                            className="flex-1 h-7 text-[10px]"
                            size="sm"
                        >
                            {getSaveButtonText()}
                        </Button>
                        {hasDefaults && (
                            <Button
                                variant="outline"
                                onClick={handleReset}
                                disabled={resetState !== 'idle'}
                                className="flex-1 h-7 text-[10px]"
                                size="sm"
                            >
                                {getResetButtonText()}
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </TooltipProvider>
    );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <Popup />
        </StrictMode>
    );
}
