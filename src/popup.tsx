import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import {
    Button,
    Card,
    CardHeader,
    CardContent,
    CardFooter,
    Separator,
    Switch,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
} from '@metalbear/ui';
import mirrordIconDark from './assets/mirrord-icon-dark.svg';
import { Settings, Share2, Check } from 'lucide-react';
import { HeaderForm } from './components';
import { useHeaderRules } from './hooks';
import { STRINGS } from './constants';
import { capture, captureBeacon, optOutReady } from './analytics';

// Fire popup_opened after opt-out preference is loaded.
// optOutReady resolves almost instantly (single chrome.storage.local read) but we must
// await it so the opt-out flag is set before we call capture().
const popupOpenedAt = Date.now();
optOutReady.then(() => capture('extension_popup_opened'));

// Track popup close with duration. Extension popups get destroyed immediately,
// so use sendBeacon — it's the only reliable way to get a request out during teardown.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    captureBeacon('extension_popup_closed', {
        duration_ms: Date.now() - popupOpenedAt,
    });
});

export function Popup() {
    const {
        rules,
        headerName,
        headerValue,
        scope,
        saveState,
        resetState,
        shareState,
        hasDefaults,
        error,
        hasStoredConfig,
        isToggling,
        canShare,
        setHeaderName,
        setHeaderValue,
        setScope,
        handleToggle,
        handleSave,
        handleReset,
        handleShare,
        getSaveButtonText,
        getResetButtonText,
    } = useHeaderRules();

    const isActive = rules.length > 0;
    const canToggle = isActive || hasStoredConfig;

    return (
        <TooltipProvider>
            <div className="w-[320px] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-2">
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
                            onClick={handleShare}
                            disabled={!canShare}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                                shareState === 'copied'
                                    ? 'Copied!'
                                    : 'Copy config link'
                            }
                            aria-label="Share configuration"
                        >
                            {shareState === 'copied' ? (
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

                <Card
                    className={`transition-all duration-200 ${
                        isActive ? 'border-l-2 border-l-primary' : ''
                    }`}
                >
                    <CardHeader className="p-3 pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`inline-block w-2 h-2 rounded-full transition-colors ${
                                        isActive
                                            ? 'bg-green-500'
                                            : 'bg-muted-foreground/30'
                                    }`}
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
                                    <TooltipContent className="text-xs max-w-[200px]">
                                        {STRINGS.TOOLTIP_HEADERS}
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
                    </CardHeader>

                    {isActive && rules.length > 0 && (
                        <>
                            <div className="px-3">
                                <Separator />
                            </div>
                            <CardContent className="px-3 py-2">
                                {rules.map((rule) => (
                                    <div
                                        key={rule.id}
                                        className="p-2 rounded-md bg-muted/30 overflow-hidden"
                                    >
                                        <code
                                            className="text-xs font-mono block"
                                            style={{
                                                color: 'hsl(var(--brand-yellow))',
                                                overflowWrap: 'anywhere',
                                            }}
                                        >
                                            {rule.header}: {rule.value}
                                        </code>
                                        <span
                                            className="text-[10px] text-muted-foreground block mt-1"
                                            style={{
                                                overflowWrap: 'anywhere',
                                            }}
                                        >
                                            {rule.scope}
                                        </span>
                                    </div>
                                ))}
                            </CardContent>
                        </>
                    )}

                    <div className="px-3">
                        <Separator />
                    </div>

                    <CardContent className="px-3 py-2">
                        <HeaderForm
                            headerName={headerName}
                            headerValue={headerValue}
                            scope={scope}
                            onHeaderNameChange={setHeaderName}
                            onHeaderValueChange={setHeaderValue}
                            onScopeChange={setScope}
                        />
                    </CardContent>

                    {error && (
                        <div className="px-3 pb-1">
                            <p
                                className="text-[10px] text-destructive"
                                role="alert"
                            >
                                {error}
                            </p>
                        </div>
                    )}

                    <CardFooter className="p-3 pt-0 flex gap-2">
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
                    </CardFooter>
                </Card>
            </div>
        </TooltipProvider>
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
