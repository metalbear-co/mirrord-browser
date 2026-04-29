import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@metalbear/ui';
import { NAMESPACE_ALL_SENTINEL, STRINGS } from '../constants';

type Props = {
    namespaces: string[];
    value: string;
    onChange: (ns: string) => void;
};

export function NamespaceFilter({ namespaces, value, onChange }: Props) {
    const distinct = namespaces.filter((ns) => ns !== '');
    const selectValue = value === '' ? NAMESPACE_ALL_SENTINEL : value;

    if (distinct.length <= 1) return null;

    return (
        <Select
            value={selectValue}
            onValueChange={(v: string) =>
                onChange(v === NAMESPACE_ALL_SENTINEL ? '' : v)
            }
        >
            <SelectTrigger
                id="ns-select"
                className="font-mono"
                style={{ height: 32, fontSize: 11, width: 110, flexShrink: 0 }}
                aria-label={`Filter by ${STRINGS.LABEL_NAMESPACE.toLowerCase()}`}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NAMESPACE_ALL_SENTINEL}>
                    {STRINGS.MSG_ALL_NAMESPACES}
                </SelectItem>
                {distinct.map((ns) => (
                    <SelectItem key={ns} value={ns}>
                        {ns}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
