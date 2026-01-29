import { StrictMode, useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import { Button, Card, Badge, Tooltip } from '@metalbear/ui';
import { refreshIconIndicator } from './util';

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
                scope: urlFilter === '|' ? 'All URLs' : urlFilter || 'All URLs',
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
                No active headers
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

export function Popup() {
    const [rules, setRules] = useState<HeaderRule[]>([]);

    const loadRules = useCallback(() => {
        chrome.declarativeNetRequest.getDynamicRules((chromeRules) => {
            const parsed = parseRules(chromeRules);
            setRules(parsed);
            refreshIconIndicator(parsed.length);
        });
    }, []);

    useEffect(() => {
        loadRules();
    }, [loadRules]);

    const handleRemove = useCallback(
        (ruleId: number) => {
            chrome.declarativeNetRequest.updateDynamicRules(
                { removeRuleIds: [ruleId] },
                () => {
                    if (!chrome.runtime.lastError) {
                        loadRules();
                    } else {
                        console.error(
                            'Failed to remove rule:',
                            chrome.runtime.lastError
                        );
                    }
                }
            );
        },
        [loadRules]
    );

    return (
        <div className="min-w-[320px] p-3">
            <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                    <h1 className="text-base font-semibold">mirrord Headers</h1>
                    <Tooltip content="Headers are injected into matching requests">
                        <span className="text-muted-foreground cursor-help">
                            ⓘ
                        </span>
                    </Tooltip>
                </div>
                <RulesList rules={rules} onRemove={handleRemove} />
            </Card>
        </div>
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
