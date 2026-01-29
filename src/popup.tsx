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
            <div className="w-[320px] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        mirrord
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        Header Injector
                    </span>
                </div>

                <Card>
                    <CardHeader>
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
                                className="text-[10px] px-2 py-0.5"
                            >
                                {isActive ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <RulesList rules={rules} onRemove={handleRemove} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xs">
                            {STRINGS.SECTION_CONFIGURE_HEADER}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <HeaderForm
                            headerName={headerName}
                            headerValue={headerValue}
                            scope={scope}
                            onHeaderNameChange={setHeaderName}
                            onHeaderValueChange={setHeaderValue}
                            onScopeChange={setScope}
                        />
                    </CardContent>
                    <CardFooter className="flex gap-2">
                        <Button
                            onClick={handleSave}
                            disabled={saveState !== 'idle'}
                            className="flex-1 h-8 text-xs"
                            size="sm"
                        >
                            {getSaveButtonText()}
                        </Button>
                        {hasDefaults && (
                            <Button
                                variant="outline"
                                onClick={handleReset}
                                disabled={resetState !== 'idle'}
                                className="flex-1 h-8 text-xs"
                                size="sm"
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
