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
            <div className="text-center py-3">
                <div className="text-muted-foreground/50 text-base mb-2">○</div>
                <p className="text-xs text-muted-foreground">
                    {STRINGS.MSG_NO_ACTIVE_HEADERS}
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Configure a header below to get started
                </p>
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
