import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import {
    Button,
    Card,
    CardContent,
    Separator,
    TooltipProvider,
} from '@metalbear/ui';
import mirrordIconDark from './assets/mirrord-icon-dark.svg';
import { Settings, Share2, Check } from 'lucide-react';
import { HeaderForm, SessionsView, ActiveRuleCard } from './components';
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

export function Popup() {
    const headerRules = useHeaderRules();
    const mirrordUi = useMirrordUi();

    const sessionMode = Boolean(mirrordUi.backend && mirrordUi.healthy);
    const isJoined =
        sessionMode &&
        !!mirrordUi.joinState.joinedKey &&
        !mirrordUi.joinState.sessionEnded;

    const customRule = !isJoined ? headerRules.rules[0] : undefined;

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
                        <button
                            onClick={headerRules.handleShare}
                            disabled={!headerRules.canShare}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                                headerRules.shareState === 'copied'
                                    ? 'Copied!'
                                    : 'Copy config link'
                            }
                            aria-label="Share configuration"
                        >
                            {headerRules.shareState === 'copied' ? (
                                <Check size={16} />
                            ) : (
                                <Share2 size={16} />
                            )}
                        </button>
                        <button
                            onClick={() => chrome.runtime.openOptionsPage()}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Settings"
                            aria-label="Settings"
                        >
                            <Settings size={16} />
                        </button>
                    </div>
                </div>

                {isJoined && mirrordUi.joinState.joinedKey && (
                    <ActiveRuleCard
                        mode="joined"
                        joinedKey={mirrordUi.joinState.joinedKey}
                        onLeave={mirrordUi.clearJoin}
                    />
                )}
                {!isJoined && customRule && (
                    <ActiveRuleCard
                        mode="custom"
                        rule={customRule}
                        onClear={headerRules.handleToggle}
                    />
                )}
                {!isJoined && !customRule && <ActiveRuleCard mode="idle" />}

                {sessionMode && (
                    <SessionsView
                        grouped={mirrordUi.groupedFiltered}
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
                )}

                {!isJoined && (
                    <CustomHeaderSection
                        headerRules={headerRules}
                        collapsed={sessionMode}
                    />
                )}
            </div>
        </TooltipProvider>
    );
}

type CustomHeaderSectionProps = {
    headerRules: ReturnType<typeof useHeaderRules>;
    /** When a mirrord ui backend is present but the user isn't joined, keep
     * this section collapsed so the session list stays the primary surface. */
    collapsed: boolean;
};

function CustomHeaderSection({
    headerRules,
    collapsed,
}: CustomHeaderSectionProps) {
    const inner = <CustomHeaderBody headerRules={headerRules} />;

    if (collapsed) {
        return (
            <details className="group">
                <summary className="text-[11px] font-semibold uppercase tracking-wider cursor-pointer px-3 py-2 text-muted-foreground hover:text-foreground select-none list-none flex items-center gap-1">
                    <span className="group-open:rotate-90 transition-transform inline-block">
                        ▸
                    </span>
                    Custom header
                </summary>
                {inner}
            </details>
        );
    }

    return inner;
}

function CustomHeaderBody({
    headerRules,
}: {
    headerRules: ReturnType<typeof useHeaderRules>;
}) {
    const {
        headerName,
        headerValue,
        scope,
        saveState,
        resetState,
        hasDefaults,
        error,
        setHeaderName,
        setHeaderValue,
        setScope,
        handleSave,
        handleReset,
        getSaveButtonText,
        getResetButtonText,
    } = headerRules;

    return (
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
