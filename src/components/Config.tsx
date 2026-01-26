import { useEffect, useState } from 'react';
import { Button, Input, Label } from '@metalbear/ui';
import { refreshIconIndicator } from '../util';

export type ConfigPayload = {
    header_filter: string;
};

function isRegex(str: string): boolean {
    const regexIndicators = [/\\[dDsSwWbB]/, /\\./, /[.*+?^${}()|[\]]/];
    return regexIndicators.some((pattern) => pattern.test(str));
}

function parseHeader(header: string): { key: string; value: string } {
    const [key, value] = header.split(':').map((s) => s.trim());
    if (!key || !value) {
        throw new Error('Invalid header format.');
    }
    return { key, value };
}

function decodeConfig(encoded: string): ConfigPayload {
    const decoded = atob(encoded);
    return JSON.parse(decoded) as ConfigPayload;
}

export function Config() {
    const [status, setStatus] = useState<
        'loading' | 'input' | 'success' | 'error'
    >('loading');
    const [error, setError] = useState<string>('');
    const [pattern, setPattern] = useState<string>('');
    const [headerInput, setHeaderInput] = useState<string>('');
    const [headerDisplay, setHeaderDisplay] = useState<string>('');

    const setHeaderRule = (header: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            let key: string, value: string;
            try {
                ({ key, value } = parseHeader(header));
            } catch (err) {
                reject(err);
                return;
            }

            const rules = [
                {
                    id: 1,
                    priority: 1,
                    action: {
                        type: chrome.declarativeNetRequest.RuleActionType
                            .MODIFY_HEADERS,
                        requestHeaders: [
                            {
                                header: key.trim(),
                                operation:
                                    chrome.declarativeNetRequest.HeaderOperation
                                        .SET,
                                value: value.trim(),
                            },
                        ],
                    },
                    condition: {
                        urlFilter: '|',
                        resourceTypes: [
                            chrome.declarativeNetRequest.ResourceType
                                .XMLHTTPREQUEST,
                            chrome.declarativeNetRequest.ResourceType
                                .MAIN_FRAME,
                            chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                        ],
                    },
                },
            ];

            chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
                chrome.declarativeNetRequest.updateDynamicRules(
                    {
                        removeRuleIds: rules
                            .map(({ id }) => id)
                            .concat(existingRules.map((rule) => rule.id)),
                        addRules: rules,
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            refreshIconIndicator(rules.length);
                            resolve();
                        }
                    }
                );
            });
        });
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const encoded = params.get('payload');

        if (!encoded) {
            setError(
                'Configuration data missing. Please make sure to copy the complete link.'
            );
            setStatus('error');
            return;
        }

        let config: ConfigPayload;
        try {
            config = decodeConfig(encoded);
        } catch {
            setError('Invalid configuration data.');
            setStatus('error');
            return;
        }

        if (!config.header_filter) {
            setError('No header filter in the configuration.');
            setStatus('error');
            return;
        }

        if (isRegex(config.header_filter)) {
            setPattern(config.header_filter);
            setStatus('input');
        } else {
            setHeaderDisplay(config.header_filter);
            setHeaderRule(config.header_filter)
                .then(() => setStatus('success'))
                .catch((err) => {
                    setError((err as Error).message);
                    setStatus('error');
                });
        }
    }, []);

    const handleSubmit = async () => {
        const regex = new RegExp(pattern);
        if (!regex.test(headerInput)) {
            setError('Input does not match the required pattern.');
            return;
        }
        setError('');
        setHeaderDisplay(headerInput);
        try {
            await setHeaderRule(headerInput);
            setStatus('success');
        } catch (err) {
            setError((err as Error).message);
            setStatus('error');
        }
    };

    if (status === 'loading') {
        return <div className="text-muted-foreground">Loading...</div>;
    }

    if (status === 'error') {
        return (
            <div className="flex flex-col gap-4">
                <div className="text-xl text-destructive font-medium">
                    Error
                </div>
                <div className="text-muted-foreground">{error}</div>
            </div>
        );
    }

    if (status === 'input') {
        return (
            <div className="flex flex-col gap-4">
                <div>
                    <Label htmlFor="header">
                        Enter a header matching the pattern:
                    </Label>
                    <code className="block mt-2 px-[0.3rem] py-[0.2rem] bg-muted rounded text-sm font-mono">
                        {pattern}
                    </code>
                </div>
                <div>
                    <Input
                        id="header"
                        value={headerInput}
                        onChange={(e) => setHeaderInput(e.target.value)}
                        placeholder="X-Header: value"
                    />
                    {error && (
                        <p className="text-destructive text-sm mt-1">{error}</p>
                    )}
                </div>
                <Button onClick={handleSubmit} variant="brand-primary">
                    Set Header
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 items-center text-center">
            <div className="text-3xl font-semibold text-brand-purple">✓</div>
            <div className="text-xl font-medium text-foreground">
                Header set successfully!
            </div>
            <code className="px-[0.3rem] py-[0.2rem] bg-muted rounded text-sm font-mono">
                {headerDisplay}
            </code>
            <p className="text-sm text-muted-foreground">
                You can close this tab. The header will be added to all
                requests.
            </p>
        </div>
    );
}
