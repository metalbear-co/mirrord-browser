import { Button, Card, CardContent, Input } from '@metalbear/ui';
import { ArrowRight, X } from 'lucide-react';
import { STRINGS } from '../constants';
import type { useRedirectRules } from '../hooks/useRedirectRules';

interface Props {
    redirectRules: ReturnType<typeof useRedirectRules>;
}

// Compact list + add form for URL redirect rules. Shown on both tabs since
// redirects apply regardless of whether the header came from a joined session
// or a manual override.
export function RedirectsSection({ redirectRules }: Props) {
    const {
        redirects,
        from,
        to,
        error,
        setFrom,
        setTo,
        handleAdd,
        handleRemove,
    } = redirectRules;

    return (
        <Card className="overflow-hidden">
            <CardContent className="flex flex-col gap-2 px-3 py-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">
                        {STRINGS.LABEL_REDIRECTS_HEADING}
                    </span>
                    <span className="text-meta text-muted-foreground">
                        {STRINGS.MSG_REDIRECT_COUNT(redirects.length)}
                    </span>
                </div>
                {redirects.map((rule, idx) => (
                    <div
                        key={`${rule.from}\n${rule.to}`}
                        className="flex items-center gap-1.5"
                    >
                        <code
                            className="min-w-0 flex-1 truncate font-mono text-xs"
                            title={rule.from}
                        >
                            {rule.from}
                        </code>
                        <ArrowRight
                            size={12}
                            className="text-muted-foreground shrink-0"
                        />
                        <code
                            className="min-w-0 flex-1 truncate font-mono text-xs"
                            title={rule.to}
                        >
                            {rule.to}
                        </code>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => void handleRemove(idx)}
                            aria-label={STRINGS.LABEL_REMOVE_REDIRECT}
                            title={STRINGS.LABEL_REMOVE_REDIRECT}
                        >
                            <X size={12} />
                        </Button>
                    </div>
                ))}
                <div className="flex items-center gap-1.5">
                    <Input
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        placeholder={STRINGS.PLACEHOLDER_REDIRECT_FROM}
                        aria-label={STRINGS.LABEL_REDIRECT_FROM}
                        className="h-7 flex-1 font-mono text-xs"
                    />
                    <Input
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder={STRINGS.PLACEHOLDER_REDIRECT_TO}
                        aria-label={STRINGS.LABEL_REDIRECT_TO}
                        className="h-7 flex-1 font-mono text-xs"
                    />
                    <Button
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => void handleAdd()}
                    >
                        {STRINGS.BTN_ADD_REDIRECT}
                    </Button>
                </div>
                <p className="text-meta text-muted-foreground">
                    {STRINGS.MSG_REDIRECT_HINT}
                </p>
                {error && (
                    <p className="text-meta text-destructive" role="alert">
                        {error}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
