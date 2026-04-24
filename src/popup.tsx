import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import {
    Button,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    TooltipProvider,
} from '@metalbear/ui';
import mirrordIconDark from './assets/mirrord-icon-dark.svg';
import { Settings, Share2, Check } from 'lucide-react';
import { SessionsView, ManualSetup } from './components';
import { useHeaderRules } from './hooks';
import { useMirrordUi } from './hooks/useMirrordUi';
import { capture, captureBeacon, optOutReady } from './analytics';
import { STRINGS, TAB, type TabId } from './constants';

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

    const sessionMode = Boolean(mirrordUi.backend && mirrordUi.healthy);
    const hasManualConfig =
        headerRules.rules.length > 0 || headerRules.hasStoredConfig;

    const defaultTab: TabId =
        sessionMode && !hasManualConfig ? TAB.SESSIONS : TAB.MANUAL;
    const [tab, setTab] = useState<TabId>(defaultTab);

    return (
        <TooltipProvider>
            <div className="w-[420px] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img
                            src={mirrordIconDark}
                            alt=""
                            className="h-5 w-auto"
                        />
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold tracking-tight leading-none">
                                mirrord
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-tight">
                                Header Injector
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
                                        ? 'Copied!'
                                        : 'Copy config link'
                                }
                                aria-label="Share configuration"
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
                            onClick={() => chrome.runtime.openOptionsPage()}
                            title="Settings"
                            aria-label="Settings"
                            className="h-7 w-7"
                        >
                            <Settings size={16} />
                        </Button>
                    </div>
                </div>

                {sessionMode ? (
                    <Tabs
                        value={tab}
                        onValueChange={(v: string) => setTab(v as TabId)}
                        className="flex flex-col gap-2"
                    >
                        <TabsList className="grid grid-cols-2 w-full">
                            <TabsTrigger value={TAB.SESSIONS}>
                                {STRINGS.TAB_SESSIONS}
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
                ) : (
                    <ManualSetup headerRules={headerRules} />
                )}
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
