import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@metalbear/ui';
import { STRINGS } from '../constants';
import type { KubeContext } from '../types';

interface Props {
    contexts: KubeContext[];
    currentContext: string | null;
    // The context whose sessions are shown; falls back to `currentContext` when unset.
    value: string | null;
    onChange: (context: string) => void;
}

/**
 * Selects which kube context's operator sessions to show. Only rendered when the `mirrord ui` server
 * supports `/api/v2` and more than one context exists (see `useMirrordUi`).
 */
export function ContextFilter({
    contexts,
    currentContext,
    value,
    onChange,
}: Props) {
    if (contexts.length <= 1) return null;

    const selected = value ?? currentContext ?? contexts[0].name;

    return (
        <Select value={selected} onValueChange={onChange}>
            <SelectTrigger
                id="ctx-select"
                style={{
                    height: 32,
                    fontSize: 11,
                    minWidth: 120,
                    flex: 1,
                }}
                aria-label={`Filter by ${STRINGS.LABEL_CONTEXT.toLowerCase()}`}
            >
                <span
                    className="text-muted-foreground"
                    style={{
                        fontSize: 9,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginRight: 6,
                        flexShrink: 0,
                    }}
                >
                    {STRINGS.LABEL_CONTEXT}
                </span>
                <span className="font-mono" style={{ minWidth: 0 }}>
                    <SelectValue />
                </span>
            </SelectTrigger>
            <SelectContent>
                {contexts.map((ctx) => (
                    <SelectItem key={ctx.name} value={ctx.name}>
                        {ctx.name === currentContext
                            ? `${ctx.name} (current)`
                            : ctx.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
