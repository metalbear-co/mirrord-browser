import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import {
    Button,
    Card,
    CardContent,
    Separator,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@metalbear/ui';
import mirrordIconDark from './assets/mirrord-icon-dark.svg';
import { Settings, Share2, Check } from 'lucide-react';
import { HeaderForm, SessionsView, Onboarding } from './components';
import { useHeaderRules } from './hooks';
import { useMirrordUi } from './hooks/useMirrordUi';
import { capture, captureBeacon, optOutReady } from './analytics';

const popupOpenedAt = Date.now();
optOutReady.then(() => capture('extension_popup_opened'));

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    captureBeacon('extension_popup_closed', {
        duration_ms: Date.now() - popupOpenedAt,
    });
});

type Tab = 'sessions' | 'manual';

export function Popup() {
    const headerRules = useHeaderRules();
    const mirrordUi = useMirrordUi();

    const sessionMode = Boolean(mirrordUi.backend && mirrordUi.healthy);
    const hasManualConfig =
        headerRules.rules.length > 0 || headerRules.hasStoredConfig;

    const defaultTab: Tab =
        sessionMode && !hasManualConfig ? 'sessions' : 'manual';
    const [tab, setTab] = useState<Tab>(defaultTab);

    const showOnboarding = !sessionMode && !hasManualConfig;

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
                        {tab === 'manual' && !showOnboarding && (
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

                {showOnboarding && (
                    <Onboarding onChooseManual={() => setTab('manual')} />
                )}

                {!showOnboarding && sessionMode && (
                    <Tabs
                        value={tab}
                        onValueChange={(v: string) => setTab(v as Tab)}
                        className="flex flex-col gap-2"
                    >
                        <TabsList className="grid grid-cols-2 w-full">
                            <TabsTrigger value="sessions">Sessions</TabsTrigger>
                            <TabsTrigger value="manual">Manual</TabsTrigger>
                        </TabsList>
                        <TabsContent value="sessions" className="mt-0">
                            <SessionsScreen mirrordUi={mirrordUi} />
                        </TabsContent>
                        <TabsContent value="manual" className="mt-0">
                            <ManualSetup headerRules={headerRules} />
                        </TabsContent>
                    </Tabs>
                )}

                {!showOnboarding && !sessionMode && (
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

type ManualSetupProps = {
    headerRules: ReturnType<typeof useHeaderRules>;
};

function ManualSetup({ headerRules }: ManualSetupProps) {
    const {
        rules,
        headerName,
        headerValue,
        scope,
        saveState,
        resetState,
        hasDefaults,
        hasStoredConfig,
        isToggling,
        error,
        setHeaderName,
        setHeaderValue,
        setScope,
        handleSave,
        handleReset,
        handleToggle,
        getSaveButtonText,
        getResetButtonText,
    } = headerRules;

    const activeRule = rules[0];
    const isActive = !!activeRule;
    const canToggle = isActive || hasStoredConfig;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <span
                        data-testid="status-dot"
                        className={`inline-block w-2 h-2 rounded-full transition-colors ${
                            isActive ? '' : 'bg-muted-foreground/30'
                        }`}
                        style={
                            isActive
                                ? { backgroundColor: '#22c55e' }
                                : undefined
                        }
                    />
                    <span className="text-xs font-medium">
                        {isActive ? 'Active' : 'Inactive'}
                    </span>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="text-muted-foreground cursor-help text-[10px]">
                                ⓘ
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[220px]">
                            When on, the extension injects the saved header into
                            matching requests. Toggle off to pause injection
                            without losing your config.
                        </TooltipContent>
                    </Tooltip>
                </div>
                <Switch
                    checked={isActive}
                    onCheckedChange={handleToggle}
                    disabled={!canToggle || isToggling}
                    aria-label="Toggle header injection"
                />
            </div>

            {activeRule && (
                <div className="px-3 py-2 rounded-md border border-primary/30 bg-primary/10">
                    <code
                        className="text-xs font-mono block"
                        style={{
                            color: 'hsl(var(--brand-yellow))',
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {activeRule.header}: {activeRule.value}
                    </code>
                    <span
                        className="text-[10px] text-muted-foreground block mt-0.5"
                        style={{ overflowWrap: 'anywhere' }}
                    >
                        {activeRule.scope}
                    </span>
                </div>
            )}

            <Card className="overflow-hidden">
                <CardContent className="px-3 py-3">
                    <HeaderForm
                        headerName={headerName}
                        headerValue={headerValue}
                        scope={scope}
                        onHeaderNameChange={setHeaderName}
                        onHeaderValueChange={setHeaderValue}
                        onScopeChange={setScope}
                    />
                    {error && (
                        <p
                            className="text-[10px] text-destructive mt-2"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}
                </CardContent>
                <Separator />
                <CardContent className="px-3 py-2 flex gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={saveState !== 'idle'}
                        className="flex-1 h-9 text-xs"
                    >
                        {getSaveButtonText()}
                    </Button>
                    {hasDefaults && (
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            disabled={resetState !== 'idle'}
                            className="flex-1 h-9 text-xs"
                        >
                            {getResetButtonText()}
                        </Button>
                    )}
                </CardContent>
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
