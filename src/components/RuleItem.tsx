import type { HeaderRule } from '../types';
import { COLORS } from '../colors';

interface RuleItemProps {
    rule: HeaderRule;
}

export function RuleItem({ rule }: RuleItemProps) {
    return (
        <div className="bg-muted/30 overflow-hidden rounded-md p-2">
            <code
                className="block font-mono text-xs"
                style={{
                    color: COLORS.brand.yellow,
                    overflowWrap: 'anywhere',
                }}
            >
                {rule.header}: {rule.value}
            </code>
            <span
                className="text-meta text-muted-foreground mt-1 block"
                style={{ overflowWrap: 'anywhere' }}
            >
                {rule.scope}
            </span>
        </div>
    );
}
