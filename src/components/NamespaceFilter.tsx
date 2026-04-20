type Props = {
    namespaces: string[];
    value: string;
    onChange: (ns: string) => void;
};

export default function NamespaceFilter({
    namespaces,
    value,
    onChange,
}: Props) {
    return (
        <div className="flex items-center gap-2 px-3 py-2">
            <label
                className="text-[11px] text-muted-foreground"
                htmlFor="ns-select"
            >
                Namespace
            </label>
            <select
                id="ns-select"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="text-xs border rounded px-1 py-0.5 bg-background"
            >
                {namespaces.map((ns) => (
                    <option key={ns || '__all'} value={ns}>
                        {ns === '' ? 'All' : ns}
                    </option>
                ))}
            </select>
        </div>
    );
}
