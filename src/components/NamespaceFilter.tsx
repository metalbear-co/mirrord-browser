import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@metalbear/ui';
import { NAMESPACE_ALL_SENTINEL, STRINGS } from '../constants';

interface Props {
    namespaces: string[];
    value: string;
    onChange: (ns: string) => void;
}

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
                style={{
                    height: 32,
                    fontSize: 11,
                    minWidth: 120,
                    flex: 1,
                }}
                aria-label={`Filter by ${STRINGS.LABEL_NAMESPACE.toLowerCase()}`}
            >
                <span
                    className="text-muted-foreground"
                    style={{
                        fontSize: 9,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginRight: 6,
                        flexShrink: 0,
                    }}
                >
                    {STRINGS.LABEL_NAMESPACE}
                </span>
                <span className="font-mono" style={{ minWidth: 0 }}>
                    <SelectValue />
                </span>
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
