import { HeaderRule } from '../types';
import { STRINGS } from '../constants';
import { RuleItem } from './RuleItem';

type RulesListProps = {
    rules: HeaderRule[];
};

export function RulesList({ rules }: RulesListProps) {
    if (rules.length === 0) {
        return (
            <div className="text-center py-2">
                <p className="text-xs text-muted-foreground">
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
