import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
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

    return (
        <div className="w-[320px] p-3 flex flex-col gap-3">
            <h1 className="text-sm font-semibold">{STRINGS.HEADER_TITLE}</h1>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xs">
                        {STRINGS.SECTION_ACTIVE_HEADER}
                    </CardTitle>
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
    );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <TooltipProvider>
                <Popup />
            </TooltipProvider>
        </StrictMode>
    );
}
