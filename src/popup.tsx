import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import './tokens.css';
import { initTheme } from './theme';
import {
    Button,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    TooltipProvider,
} from '@metalbear/ui';

initTheme();
import mirrordIconDark from './assets/mirrord-icon-dark.svg';
import { Moon, Settings, Share2, Sun, Check } from 'lucide-react';
import { loadTheme, saveTheme, resolveDark } from './theme';
import type { ThemePref } from './types';
import { SessionsView, ManualSetup } from './components';
import { useHeaderRules } from './hooks';
import { useMirrordUi } from './hooks/useMirrordUi';
import { capture, captureBeacon, optOutReady } from './analytics';
import { STRINGS, TAB, type TabId } from './constants';
import { STORAGE_KEYS } from './types';

const popupOpenedAt = Date.now();
optOutReady.then(() => capture('extension_popup_opened'));

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    captureBeacon('extension_popup_closed', {
        duration_ms: Date.now() - popupOpenedAt,
    });
});

export function Popup() {
    const headerRules = useHeaderRules();
    const mirrordUi = useMirrordUi();

    const [tab, setTab] = useState<TabId>(TAB.MANUAL);
    const [tabRestored, setTabRestored] = useState(false);
    const [themePref, setThemeState] = useState<ThemePref>('system');
    const isDark = resolveDark(themePref);
    useEffect(() => {
        loadTheme().then(setThemeState);
    }, []);

    useEffect(() => {
        chrome.storage.local.get(
            [STORAGE_KEYS.ACTIVE_TAB],
            (stored: Record<string, unknown>) => {
                const saved = stored?.[STORAGE_KEYS.ACTIVE_TAB];
                if (saved === TAB.SESSIONS || saved === TAB.MANUAL) {
                    setTab(saved);
                }
                setTabRestored(true);
            }
        );
    }, []);

    useEffect(() => {
        if (!tabRestored) return;
        chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_TAB]: tab }, () => {});
    }, [tab, tabRestored]);

    return (
        <TooltipProvider>
            <div className="w-[420px] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img
                            src={mirrordIconDark}
                            alt=""
                            className="h-5 w-auto dark:invert"
                        />
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold tracking-tight leading-none">
                                {STRINGS.LABEL_MIRRORD}
                            </span>
                            <span className="text-meta text-muted-foreground leading-tight">
                                {STRINGS.LABEL_HEADER_INJECTOR}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {tab === TAB.MANUAL && (
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={headerRules.handleShare}
                                disabled={!headerRules.canShare}
                                title={
                                    headerRules.shareState === 'copied'
                                        ? STRINGS.BTN_COPIED
                                        : STRINGS.BTN_COPY_CONFIG_LINK
                                }
                                aria-label={STRINGS.BTN_SHARE_CONFIG}
                                className="h-7 w-7"
                            >
                                {headerRules.shareState === 'copied' ? (
                                    <Check size={16} />
                                ) : (
                                    <Share2 size={16} />
                                )}
                            </Button>
                        )}
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                                const next: ThemePref = isDark
                                    ? 'light'
                                    : 'dark';
                                setThemeState(next);
                                saveTheme(next);
                            }}
                            title={isDark ? 'Light mode' : 'Dark mode'}
                            aria-label={isDark ? 'Light mode' : 'Dark mode'}
                            className="h-7 w-7"
                        >
                            {isDark ? <Sun size={16} /> : <Moon size={16} />}
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => chrome.runtime.openOptionsPage()}
                            title={STRINGS.SETTINGS_TITLE}
                            aria-label={STRINGS.SETTINGS_TITLE}
                            className="h-7 w-7"
                        >
                            <Settings size={16} />
                        </Button>
                    </div>
                </div>

                <Tabs
                    value={tab}
                    onValueChange={(v: string) => setTab(v as TabId)}
                    className="flex flex-col gap-2"
                >
                    <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value={TAB.SESSIONS}>
                            <span className="inline-flex items-center gap-1.5">
                                {STRINGS.TAB_SESSIONS}
                                {(mirrordUi.sessions?.sessions.length ?? 0) >
                                    0 && (
                                    <span
                                        className="font-mono"
                                        style={{
                                            fontSize: 10,
                                            padding: '1px 6px',
                                            borderRadius: 999,
                                            background:
                                                'hsl(var(--background))',
                                            color: 'hsl(var(--foreground))',
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {mirrordUi.sessions?.sessions.length}
                                    </span>
                                )}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value={TAB.MANUAL}>
                            {STRINGS.TAB_MANUAL}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value={TAB.SESSIONS} className="mt-0">
                        <SessionsScreen mirrordUi={mirrordUi} />
                    </TabsContent>
                    <TabsContent value={TAB.MANUAL} className="mt-0">
                        <ManualSetup headerRules={headerRules} />
                    </TabsContent>
                </Tabs>
            </div>
        </TooltipProvider>
    );
}

function SessionsScreen({
    mirrordUi,
}: {
    mirrordUi: ReturnType<typeof useMirrordUi>;
}) {
    return (
        <SessionsView
            sessions={mirrordUi.sessions?.sessions ?? []}
            sessionsLoaded={mirrordUi.sessions !== null}
            namespaces={mirrordUi.namespaces}
            namespace={mirrordUi.namespace}
            setNamespace={mirrordUi.setNamespace}
            joinState={mirrordUi.joinState}
            status={mirrordUi.status}
            onJoin={mirrordUi.join}
            onClear={mirrordUi.clearJoin}
            onShare={(key) => {
                const url = mirrordUi.buildShareUrl(key);
                navigator.clipboard.writeText(url).catch(() => {});
            }}
            scopePatterns={mirrordUi.scopePatterns}
            onAddScopePattern={mirrordUi.addScopePattern}
            onRemoveScopePattern={mirrordUi.removeScopePattern}
            joinedHeader={mirrordUi.joinedHeader}
            joinedValue={mirrordUi.joinedValue}
        />
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
