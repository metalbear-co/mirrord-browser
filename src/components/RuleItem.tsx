import { Button } from '@metalbear/ui';
import { HeaderRule } from '../types';

type RuleItemProps = {
    rule: HeaderRule;
    onRemove: (id: number) => void;
};

export function RuleItem({ rule, onRemove }: RuleItemProps) {
    return (
        <div className="p-2 rounded-md bg-muted/50">
            <code
                className="text-xs font-mono break-all block mb-2"
                style={{ color: 'hsl(var(--brand-yellow))' }}
            >
                {rule.header}: {rule.value}
            </code>
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                    {rule.scope}
                </span>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRemove(rule.id)}
                    className="h-6 text-xs px-2"
                >
                    Remove
                </Button>
            </div>
        </div>
    );
}
