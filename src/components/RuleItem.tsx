import { HeaderRule } from '../types';

type RuleItemProps = {
    rule: HeaderRule;
};

export function RuleItem({ rule }: RuleItemProps) {
    return (
        <div className="p-2 rounded-md bg-muted/30 overflow-hidden">
            <code
                className="text-xs font-mono block"
                style={{
                    color: 'hsl(var(--brand-yellow))',
                    overflowWrap: 'anywhere',
                }}
            >
                {rule.header}: {rule.value}
            </code>
            <span
                className="text-[10px] text-muted-foreground block mt-1"
                style={{ overflowWrap: 'anywhere' }}
            >
                {rule.scope}
            </span>
        </div>
    );
}
