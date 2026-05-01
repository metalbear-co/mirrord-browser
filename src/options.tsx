import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import './tokens.css';
import { initTheme } from './theme';
import { Label, Switch } from '@metalbear/ui';
import { STRINGS } from './constants';
import { optOutReady, setOptOut } from './analytics';
import { STORAGE_KEYS } from './types';

initTheme();

export function Options() {
    const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        optOutReady.then(() => {
            chrome.storage.local
                .get(STORAGE_KEYS.ANALYTICS_OPT_OUT)
                .then((result) => {
                    setAnalyticsEnabled(
                        result[STORAGE_KEYS.ANALYTICS_OPT_OUT] !== true
                    );
                    setLoaded(true);
                });
        });
    }, []);

    const handleAnalyticsToggle = (checked: boolean) => {
        setAnalyticsEnabled(checked);
        setOptOut(!checked);
    };

    if (!loaded) return null;

    return (
        <div className="max-w-md mx-auto p-6 flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
                <span className="text-meta font-medium text-muted-foreground">
                    mirrord
                </span>
                <span className="text-xs text-muted-foreground">
                    {STRINGS.SETTINGS_TITLE}
                </span>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <Label htmlFor="analytics-toggle" className="text-section">
                        {STRINGS.SETTINGS_ANALYTICS_LABEL}
                    </Label>
                    <p className="text-meta text-muted-foreground">
                        {STRINGS.SETTINGS_ANALYTICS_DESCRIPTION}
                    </p>
                </div>
                <Switch
                    id="analytics-toggle"
                    checked={analyticsEnabled}
                    onCheckedChange={handleAnalyticsToggle}
                />
            </div>
        </div>
    );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <Options />
        </StrictMode>
    );
}
