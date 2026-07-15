import type { HeaderRule } from '../types';
import { STRINGS } from '../constants';
import { RuleItem } from './RuleItem';

interface RulesListProps {
    rules: HeaderRule[];
}

export function RulesList({ rules }: RulesListProps) {
    if (rules.length === 0) {
        return (
            <div className="py-2 text-center">
                <p className="text-muted-foreground text-xs">
                    {STRINGS.MSG_NO_ACTIVE_HEADERS}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {rules.map((rule) => (
                <RuleItem key={rule.id} rule={rule} />
            ))}
        </div>
    );
}
