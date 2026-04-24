import {
    Label,
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
    const selectValue = value === '' ? NAMESPACE_ALL_SENTINEL : value;

    return (
        <div className="flex items-center" style={{ gap: 8, padding: '0 2px' }}>
            <Label
                htmlFor="ns-select"
                className="text-muted-foreground font-semibold"
                style={{
                    fontSize: 10.5,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                }}
            >
                {STRINGS.LABEL_NAMESPACE}
            </Label>
            <Select
                value={selectValue}
                onValueChange={(v: string) =>
                    onChange(v === NAMESPACE_ALL_SENTINEL ? '' : v)
                }
            >
                <SelectTrigger
                    id="ns-select"
                    className="font-mono"
                    style={{ height: 28, fontSize: 12, flex: 1 }}
                    aria-label={`Filter by ${STRINGS.LABEL_NAMESPACE.toLowerCase()}`}
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {namespaces.map((ns) => (
                        <SelectItem
                            key={ns === '' ? NAMESPACE_ALL_SENTINEL : ns}
                            value={ns === '' ? NAMESPACE_ALL_SENTINEL : ns}
                        >
                            {ns === '' ? STRINGS.MSG_ALL_NAMESPACES : ns}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
