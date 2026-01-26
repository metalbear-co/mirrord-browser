import { useEffect, useState } from 'react';
import { Button } from '@metalbear/ui';
import { refreshIconIndicator } from '../util';

type Rule = chrome.declarativeNetRequest.Rule;

export function Popup() {
    const [rules, setRules] = useState<Rule[]>([]);

    const loadRules = () => {
        chrome.declarativeNetRequest.getDynamicRules((loadedRules) => {
            setRules(loadedRules);
            refreshIconIndicator(loadedRules.length);
        });
    };

    useEffect(() => {
        loadRules();
    }, []);

    const removeRule = (ruleId: number) => {
        chrome.declarativeNetRequest.updateDynamicRules(
            { removeRuleIds: [ruleId] },
            () => {
                if (!chrome.runtime.lastError) {
                    loadRules();
                } else {
                    console.error('Failed to remove rule:', chrome.runtime.lastError);
                }
            }
        );
    };

    const getHeadersDisplay = (rule: Rule): string | null => {
        if (
            rule.action.type === chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS &&
            rule.action.requestHeaders
        ) {
            return rule.action.requestHeaders
                .map((h) => `${h.header}: ${h.value}`)
                .join(', ');
        }
        return null;
    };

    return (
        <div className="flex flex-col gap-2">
            {rules.length === 0 ? (
                <div className="text-sm text-muted-foreground">No active header</div>
            ) : (
                rules.map((rule) => {
                    const headers = getHeadersDisplay(rule);
                    if (!headers) return null;

                    return (
                        <div
                            key={rule.id}
                            className="flex items-center justify-between gap-2"
                        >
                            <span className="text-sm font-mono text-foreground flex-1 break-all">
                                {headers}
                            </span>
                            <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => removeRule(rule.id)}
                                className="shrink-0"
                            >
                                ✕
                            </Button>
                        </div>
                    );
                })
            )}
        </div>
    );
}
