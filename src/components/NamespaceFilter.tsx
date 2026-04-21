import {
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@metalbear/ui';

type Props = {
    namespaces: string[];
    value: string;
    onChange: (ns: string) => void;
};

const ALL_VALUE = '__all__';

export default function NamespaceFilter({
    namespaces,
    value,
    onChange,
}: Props) {
    const selectValue = value === '' ? ALL_VALUE : value;

    return (
        <div className="flex items-center gap-2 px-3 py-2">
            <Label
                htmlFor="ns-select"
                className="text-[11px] text-muted-foreground"
            >
                Namespace
            </Label>
            <Select
                value={selectValue}
                onValueChange={(v: string) =>
                    onChange(v === ALL_VALUE ? '' : v)
                }
            >
                <SelectTrigger
                    id="ns-select"
                    className="h-7 text-xs flex-1"
                    aria-label="Filter by namespace"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {namespaces.map((ns) => (
                        <SelectItem
                            key={ns === '' ? ALL_VALUE : ns}
                            value={ns === '' ? ALL_VALUE : ns}
                        >
                            {ns === '' ? 'All' : ns}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
