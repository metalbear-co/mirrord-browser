import { Card } from '@metalbear/ui';

type Props = {
    onChooseManual: () => void;
};

export default function Onboarding({ onChooseManual }: Props) {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground px-1">
                Choose how to set up header injection:
            </p>
            <div className="grid grid-cols-2 gap-2">
                <Card className="p-0">
                    <div className="px-3 py-3 flex flex-col gap-2 h-full">
                        <span className="text-[11px] font-semibold uppercase tracking-wider">
                            Developer
                        </span>
                        <p className="text-[11px] text-muted-foreground flex-1">
                            Run{' '}
                            <code className="font-mono bg-muted px-1 py-0.5 rounded">
                                mirrord ui
                            </code>{' '}
                            in your terminal to list active operator sessions
                            and join one from the browser.
                        </p>
                    </div>
                </Card>
                <button
                    type="button"
                    onClick={onChooseManual}
                    className="text-left"
                >
                    <Card className="p-0 hover:bg-muted/30 transition-colors">
                        <div className="px-3 py-3 flex flex-col gap-2 h-full">
                            <span className="text-[11px] font-semibold uppercase tracking-wider">
                                Manual setup
                            </span>
                            <p className="text-[11px] text-muted-foreground flex-1">
                                Configure a header name and value that the
                                extension will inject on all matching URLs.
                            </p>
                        </div>
                    </Card>
                </button>
            </div>
        </div>
    );
}
