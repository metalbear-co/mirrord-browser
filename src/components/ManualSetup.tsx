import {
    Button,
    Card,
    CardContent,
    Separator,
    Switch,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@metalbear/ui';
import { HeaderForm } from './HeaderForm';
import { StatusDot } from './StatusDot';
import { STRINGS } from '../constants';
import type { useHeaderRules } from '../hooks';

type Props = {
    headerRules: ReturnType<typeof useHeaderRules>;
};

export function ManualSetup({ headerRules }: Props) {
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
                    <StatusDot tone={isActive ? 'active' : 'inactive'} />
                    <span className="text-xs font-medium">
                        {isActive ? STRINGS.MSG_ACTIVE : STRINGS.MSG_INACTIVE}
                    </span>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="text-muted-foreground cursor-help text-[10px]">
                                {STRINGS.LABEL_INFO}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[220px]">
                            {STRINGS.MSG_INJECTION_TOOLTIP}
                        </TooltipContent>
                    </Tooltip>
                </div>
                <Switch
                    checked={isActive}
                    onCheckedChange={handleToggle}
                    disabled={!canToggle || isToggling}
                    aria-label={STRINGS.LABEL_TOGGLE_INJECTION}
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
