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
import { COLORS } from '../colors';
import type { useHeaderRules } from '../hooks';

interface Props {
    headerRules: ReturnType<typeof useHeaderRules>;
}

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

    const activeRule = rules.length > 0 ? rules[0] : undefined;
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
                            <span className="text-muted-foreground text-meta cursor-help">
                                {STRINGS.LABEL_INFO}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-xs">
                            {STRINGS.MSG_INJECTION_TOOLTIP}
                        </TooltipContent>
                    </Tooltip>
                </div>
                <Switch
                    checked={isActive}
                    onCheckedChange={() => void handleToggle()}
                    disabled={!canToggle || isToggling}
                    aria-label={STRINGS.LABEL_TOGGLE_INJECTION}
                />
            </div>

            {activeRule && (
                <div className="border-primary/30 bg-primary/10 rounded-md border px-3 py-2">
                    <code
                        className="block font-mono text-xs"
                        style={{
                            color: COLORS.brand.yellow,
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {activeRule.header}: {activeRule.value}
                    </code>
                    <span
                        className="text-meta text-muted-foreground mt-0.5 block"
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
                            className="text-meta text-destructive mt-2"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}
                </CardContent>
                <Separator />
                <CardContent className="flex gap-2 px-3 py-2">
                    <Button
                        onClick={() => void handleSave()}
                        disabled={saveState !== 'idle'}
                        className="h-9 flex-1 text-xs"
                    >
                        {getSaveButtonText()}
                    </Button>
                    {hasDefaults && (
                        <Button
                            variant="outline"
                            onClick={() => void handleReset()}
                            disabled={resetState !== 'idle'}
                            className="h-9 flex-1 text-xs"
                        >
                            {getResetButtonText()}
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
