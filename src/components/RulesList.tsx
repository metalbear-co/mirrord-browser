import { HeaderRule } from '../types';
import { STRINGS } from '../constants';
import { RuleItem } from './RuleItem';

type RulesListProps = {
    rules: HeaderRule[];
    onRemove: (id: number) => void;
};

export function RulesList({ rules, onRemove }: RulesListProps) {
    if (rules.length === 0) {
        return (
            <div className="text-xs text-muted-foreground text-center py-2">
                {STRINGS.MSG_NO_ACTIVE_HEADERS}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {rules.map((rule) => (
                <RuleItem key={rule.id} rule={rule} onRemove={onRemove} />
            ))}
        </div>
    );
}
