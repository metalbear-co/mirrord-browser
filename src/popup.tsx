import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
} from '@metalbear/ui';
import { RulesList, HeaderForm } from './components';
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
        hasDefaults,
        setHeaderName,
        setHeaderValue,
        setScope,
        handleRemove,
        handleSave,
        handleReset,
        getSaveButtonText,
        getResetButtonText,
    } = useHeaderRules();

    const isActive = rules.length > 0;

    return (
        <TooltipProvider>
            <div className="w-[320px] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                    <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        mirrord
                    </span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">
                            Header Injector
                        </span>
                        <button
                            onClick={() => chrome.runtime.openOptionsPage()}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Settings"
                            aria-label="Settings"
                        >
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </button>
                    </div>
                </div>

                <Card>
                    <CardHeader className="p-3 pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <CardTitle className="text-xs">
                                    {STRINGS.SECTION_ACTIVE_HEADER}
                                </CardTitle>
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
                            <Badge
                                variant={isActive ? 'default' : 'secondary'}
                                className="text-[10px] px-1.5 py-0"
                            >
                                {isActive ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="px-3 py-2">
                        <RulesList rules={rules} />
                    </CardContent>
                    {isActive && (
                        <CardFooter className="p-3 pt-0">
                            {rules.map((rule) => (
                                <Button
                                    key={rule.id}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(rule.id)}
                                    className="h-6 text-[10px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    Remove
                                </Button>
                            ))}
                        </CardFooter>
                    )}
                </Card>

                <Card>
                    <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-xs">
                            {STRINGS.SECTION_CONFIGURE_HEADER}
                        </CardTitle>
                    </CardHeader>
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
