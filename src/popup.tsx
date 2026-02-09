import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { PostHogProvider, usePostHog } from 'posthog-js/react';
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
import { POSTHOG_KEY, posthogConfig } from './analytics';

export function Popup() {
    const posthog = usePostHog();
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

    useEffect(() => {
        try {
            posthog.capture('extension_popup_opened');
        } catch (e) {
            console.warn('PostHog error:', e);
        }
    }, []);

    return (
        <TooltipProvider>
            <div className="w-[320px] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                    <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        mirrord
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        Header Injector
                    </span>
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
            <PostHogProvider apiKey={POSTHOG_KEY} options={posthogConfig}>
                <Popup />
            </PostHogProvider>
        </StrictMode>
    );
}
