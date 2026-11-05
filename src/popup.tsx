import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
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
import mirrordIconLight from './assets/mirrord-icon-light.svg';
import { Moon, Settings, Share2, Sun, Check } from 'lucide-react';
import { loadTheme, saveTheme, resolveDark } from './theme';
import type { ThemePref } from './types';
import { SessionsView, ManualSetup, ActivityView } from './components';
import { useHeaderRules } from './hooks';
import { useMirrordUi } from './hooks/useMirrordUi';
import { useActivity } from './hooks/useActivity';
import { hitsWithin } from './activity';
import {
    capture,
    captureBeacon,
    optOutReady,
    initErrorTracking,
} from './analytics';
import { STRINGS, TAB, type TabId } from './constants';
import { STORAGE_KEYS } from './types';

initErrorTracking('popup');

const popupOpenedAt = Date.now();
const surface: 'side_panel' | 'sidebar' | 'popup_fallback' =
    typeof (chrome as { sidePanel?: unknown }).sidePanel !== 'undefined'
        ? 'side_panel'
        : typeof (chrome as { sidebarAction?: unknown }).sidebarAction !==
            'undefined'
          ? 'sidebar'
          : 'popup_fallback';
void optOutReady.then(() => capture('extension_popup_opened', { surface }));

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') {
        return;
    }
    captureBeacon('extension_popup_closed', {
        duration_ms: Date.now() - popupOpenedAt,
        surface,
    });
});

const TAB_IDS: readonly string[] = [TAB.SESSIONS, TAB.ACTIVITY, TAB.MANUAL];

function isTabId(value: unknown): value is TabId {
    return typeof value === 'string' && TAB_IDS.includes(value);
}

function TabCount({ count }: { count: number }) {
    return (
        <span
            className="font-mono"
            style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 999,
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                lineHeight: 1.4,
            }}
        >
            {count}
        </span>
    );
}

export function Popup() {
    const headerRules = useHeaderRules();
    const mirrordUi = useMirrordUi();
    const activity = useActivity();
    const reachedLastMinute = hitsWithin(activity.activity.hits, activity.now);

    // Sessions sharing a key are presented as one group, so count distinct keys
    // (not raw sessions) to match the list below.
    const sessionKeyCount = new Set(
        (mirrordUi.sessions?.sessions ?? []).map((s) => s.key)
    ).size;

    const [tab, setTab] = useState<TabId>(TAB.SESSIONS);
    const [tabRestored, setTabRestored] = useState(false);
    const [themePref, setThemeState] = useState<ThemePref>('system');
    const isDark = resolveDark(themePref);
    useEffect(() => {
        void loadTheme().then(setThemeState);
    }, []);

    useEffect(() => {
        chrome.storage.local.get(
            [STORAGE_KEYS.ACTIVE_TAB],
            (stored: Record<string, unknown>) => {
                const saved = stored[STORAGE_KEYS.ACTIVE_TAB];
                if (isTabId(saved)) {
                    setTab(saved);
                }
                setTabRestored(true);
            }
        );
    }, []);

    useEffect(() => {
        if (!tabRestored) {
            return;
        }
        chrome.storage.local.set(
            { [STORAGE_KEYS.ACTIVE_TAB]: tab },
            () => undefined
        );
    }, [tab, tabRestored]);

    return (
        <TooltipProvider>
            <div className="flex w-[420px] flex-col gap-2 p-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img
                            src={mirrordIconLight}
                            alt=""
                            className="h-5 w-auto"
                        />
                        <div className="flex flex-col">
                            <span className="text-sm leading-none font-semibold tracking-tight">
                                {STRINGS.LABEL_MIRRORD}
                            </span>
                            <span className="text-meta text-muted-foreground leading-tight">
                                {STRINGS.LABEL_HEADER_INJECTOR}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {tab === TAB.MANUAL && (
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => void headerRules.handleShare()}
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
                                void saveTheme(next);
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
                            onClick={() =>
                                void chrome.runtime.openOptionsPage()
                            }
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
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value={TAB.SESSIONS}>
                            <span className="inline-flex items-center gap-1.5">
                                {STRINGS.TAB_SESSIONS}
                                {sessionKeyCount > 0 && (
                                    <TabCount count={sessionKeyCount} />
                                )}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value={TAB.ACTIVITY}>
                            <span className="inline-flex items-center gap-1.5">
                                {STRINGS.TAB_ACTIVITY}
                                {reachedLastMinute > 0 && (
                                    <TabCount count={reachedLastMinute} />
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
                    <TabsContent value={TAB.ACTIVITY} className="mt-0">
                        <ActivityView
                            joinedKey={mirrordUi.joinState.joinedKey}
                            activity={activity.activity}
                            now={activity.now}
                        />
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
            authFailed={mirrordUi.authFailed}
            uiDetectedNoToken={mirrordUi.uiDetectedNoToken}
            backend={mirrordUi.backend}
            namespaces={mirrordUi.namespaces}
            namespace={mirrordUi.namespace}
            setNamespace={mirrordUi.setNamespace}
            contexts={mirrordUi.contexts}
            currentContext={mirrordUi.currentContext}
            selectedContext={mirrordUi.selectedContext}
            onSelectContext={(context) =>
                void mirrordUi.setSelectedContext(context)
            }
            joinState={mirrordUi.joinState}
            status={mirrordUi.status}
            onJoin={(key) => void mirrordUi.join(key)}
            onClear={() => void mirrordUi.clearJoin()}
            onShare={(key) => {
                const url = mirrordUi.buildShareUrl(key);
                navigator.clipboard.writeText(url).catch(() => undefined);
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
            <ErrorBoundary flow="session_monitor" component="popup">
                <Popup />
            </ErrorBoundary>
        </StrictMode>
    );
}
