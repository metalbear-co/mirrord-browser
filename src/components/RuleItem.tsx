import { Button } from '@metalbear/ui';
import { HeaderRule } from '../types';

type RuleItemProps = {
    rule: HeaderRule;
    onRemove: (id: number) => void;
};

export function RuleItem({ rule, onRemove }: RuleItemProps) {
    return (
        <div className="p-3 rounded-md bg-muted/30">
            <code
                className="text-xs font-mono break-all block"
                style={{ color: 'hsl(var(--brand-yellow))' }}
            >
                {rule.header}: {rule.value}
            </code>
            <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">
                    {rule.scope}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(rule.id)}
                    className="h-6 text-[10px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    Remove
                </Button>
            </div>
        </div>
    );
}
