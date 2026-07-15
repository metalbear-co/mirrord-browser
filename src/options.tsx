import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
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
        void optOutReady.then(() =>
            chrome.storage.local
                .get(STORAGE_KEYS.ANALYTICS_OPT_OUT)
                .then((result) => {
                    setAnalyticsEnabled(
                        result[STORAGE_KEYS.ANALYTICS_OPT_OUT] !== true
                    );
                    setLoaded(true);
                })
        );
    }, []);

    const handleAnalyticsToggle = (checked: boolean) => {
        setAnalyticsEnabled(checked);
        void setOptOut(!checked);
    };

    if (!loaded) {
        return null;
    }

    return (
        <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
            <div className="border-border flex items-center gap-2 border-b pb-3">
                <span className="text-meta text-muted-foreground font-medium">
                    {STRINGS.LABEL_MIRRORD}
                </span>
                <span className="text-muted-foreground text-xs">
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
            <ErrorBoundary flow="header_injector" component="options">
                <Options />
            </ErrorBoundary>
        </StrictMode>
    );
}
