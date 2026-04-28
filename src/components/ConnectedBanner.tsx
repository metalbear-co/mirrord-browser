import { useState, useRef, useEffect } from 'react';
import { Globe, X } from 'lucide-react';
import { Button, Input } from '@metalbear/ui';
import type { OperatorSessionSummary } from '../types';
import { STRINGS } from '../constants';
import { COLORS } from '../colors';
import { StatusDot } from './StatusDot';

type Props = {
    joinedKey: string;
    session: OperatorSessionSummary | undefined;
    sessionEnded: boolean;
    onLeave: () => void;
    scopePatterns: string[];
    onAddScopePattern: (pattern: string) => void | Promise<void>;
    onRemoveScopePattern: (pattern: string) => void | Promise<void>;
};

export function ConnectedBanner({
    joinedKey,
    sessionEnded,
    onLeave,
    scopePatterns,
    onAddScopePattern,
    onRemoveScopePattern,
}: Props) {
    const label = sessionEnded
        ? STRINGS.MSG_SESSION_ENDED
        : STRINGS.MSG_SESSION_LIVE;
    const buttonLabel = sessionEnded ? STRINGS.BTN_DISMISS : STRINGS.BTN_LEAVE;
    const border = sessionEnded
        ? COLORS.destructive.border
        : COLORS.primary.borderSoft;
    const bg = sessionEnded ? COLORS.destructive.bg : COLORS.primary.bg;
    const titleColor = sessionEnded
        ? COLORS.destructive.solid
        : COLORS.brand.lilac;

    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (sessionEnded && draft) setDraft('');
    }, [sessionEnded, draft]);

    const submit = async () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        await onAddScopePattern(trimmed);
        setDraft('');
        inputRef.current?.focus();
    };

    return (
        <div
            className="flex flex-col"
            style={{
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${border}`,
                background: bg,
            }}
        >
            <div className="flex items-center" style={{ gap: 10 }}>
                <StatusDot
                    tone={sessionEnded ? 'destructive' : 'active'}
                    glow
                />
                <div className="min-w-0" style={{ flex: 1 }}>
                    <div
                        className="font-semibold"
                        style={{
                            fontSize: 10.5,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: titleColor,
                        }}
                    >
                        {label}
                    </div>
                    <div
                        className="font-mono"
                        style={{
                            fontSize: 13,
                            fontWeight: 500,
                            marginTop: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {joinedKey}
                    </div>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onLeave}
                    style={{ height: 28, padding: '0 12px' }}
                >
                    {buttonLabel}
                </Button>
            </div>

            {!sessionEnded && (
                <div
                    className="flex flex-col"
                    style={{
                        gap: 8,
                        paddingTop: 8,
                        borderTop: `1px dashed ${COLORS.primary.borderSubtle}`,
                    }}
                >
                    <div
                        className="flex items-center justify-between"
                        style={{ fontSize: 10.5 }}
                    >
                        <span
                            className="inline-flex items-center text-muted-foreground font-semibold"
                            style={{
                                gap: 6,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}
                        >
                            <Globe style={{ height: 12, width: 12 }} />
                            {STRINGS.LABEL_URL_SCOPE_HEADING}
                        </span>
                        <span className="text-muted-foreground">
                            {STRINGS.MSG_PATTERN_COUNT(scopePatterns.length)}
                        </span>
                    </div>
                    <div
                        className="flex flex-wrap items-center"
                        style={{ gap: 6 }}
                    >
                        {scopePatterns.map((pattern) => (
                            <span
                                key={pattern}
                                className="inline-flex items-center font-mono"
                                style={{
                                    gap: 6,
                                    fontSize: 11,
                                    padding: '4px 6px 4px 8px',
                                    borderRadius: 6,
                                    border: `1px solid ${COLORS.primary.border}`,
                                    background: COLORS.primary.tint,
                                    color: COLORS.brand.lilac,
                                }}
                            >
                                {pattern}
                                <button
                                    type="button"
                                    aria-label={STRINGS.LABEL_REMOVE_PATTERN}
                                    onClick={() =>
                                        onRemoveScopePattern(pattern)
                                    }
                                    className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                                    style={{
                                        height: 16,
                                        width: 16,
                                        borderRadius: 4,
                                    }}
                                >
                                    <X style={{ height: 12, width: 12 }} />
                                </button>
                            </span>
                        ))}
                        <Input
                            ref={inputRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    submit();
                                }
                            }}
                            onBlur={submit}
                            placeholder={STRINGS.PLACEHOLDER_URL_PATTERN}
                            spellCheck={false}
                            autoComplete="off"
                            className="font-mono"
                            style={{
                                flex: 1,
                                minWidth: 120,
                                height: 28,
                                fontSize: 11,
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
