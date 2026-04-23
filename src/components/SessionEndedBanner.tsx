type Props = {
    joinedKey: string;
    onAcknowledge: () => void;
};

export default function SessionEndedBanner({
    joinedKey,
    onAcknowledge,
}: Props) {
    return (
        <div
            role="alert"
            className="flex items-center justify-between px-3 py-2 bg-destructive/10 border-b border-destructive/40 text-xs text-destructive"
        >
            <span>
                Session ended for key{' '}
                <span className="font-mono font-semibold">{joinedKey}</span>
            </span>
            <button
                type="button"
                onClick={onAcknowledge}
                className="underline text-[10px]"
            >
                Dismiss
            </button>
        </div>
    );
}
