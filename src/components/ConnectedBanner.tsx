import { useState, useRef, useEffect } from 'react';
import { Activity, Check, Copy, Globe, X, Plus } from 'lucide-react';
import { Button, Input } from '@metalbear/ui';
import type { OperatorSessionSummary } from '../types';
import { STRINGS } from '../constants';
import { COLORS } from '../colors';
import { RING_SECONDS } from '../headerObservation';
import { useHeaderObservation } from '../hooks/useHeaderObservation';
import { StatusDot } from './StatusDot';

type Props = {
    joinedKey: string;
    session: OperatorSessionSummary | undefined;
    sessionEnded: boolean;
    onLeave: () => void;
    scopePatterns: string[];
    onAddScopePattern: (pattern: string) => void | Promise<void>;
    onRemoveScopePattern: (pattern: string) => void | Promise<void>;
    joinedHeader: string | null;
    joinedValue: string | null;
};

export function ConnectedBanner({
    joinedKey,
    sessionEnded,
    onLeave,
    scopePatterns,
    onAddScopePattern,
    onRemoveScopePattern,
    joinedHeader,
    joinedValue,
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
    const [composing, setComposing] = useState(false);
    const [copied, setCopied] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const showInput = composing || scopePatterns.length === 0;
    const observation = useHeaderObservation();
    const observed = observation.totalLast60s;

    const copyHeader = async () => {
        if (!joinedHeader || !joinedValue) return;
        try {
            await navigator.clipboard.writeText(
                `${joinedHeader}: ${joinedValue}`
            );
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {}
    };

    useEffect(() => {
        if (sessionEnded) {
            setDraft('');
            setComposing(false);
        }
    }, [sessionEnded]);

    useEffect(() => {
        if (composing) inputRef.current?.focus();
    }, [composing]);

    const submit = async () => {
        const trimmed = draft.trim();
        if (!trimmed) {
            if (scopePatterns.length > 0) setComposing(false);
            return;
        }
        await onAddScopePattern(trimmed);
        setDraft('');
        if (scopePatterns.length === 0) {
            inputRef.current?.focus();
        } else {
            setComposing(false);
        }
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
                            letterSpacing: 'normal',
                            textTransform: 'none',
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
                                letterSpacing: 'normal',
                                textTransform: 'none',
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
                        {showInput ? (
                            <Input
                                ref={inputRef}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        submit();
                                    } else if (
                                        e.key === 'Escape' &&
                                        scopePatterns.length > 0
                                    ) {
                                        setDraft('');
                                        setComposing(false);
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
                                    height: 24,
                                    fontSize: 11,
                                }}
                            />
                        ) : (
                            <button
                                type="button"
                                aria-label={STRINGS.PLACEHOLDER_URL_PATTERN}
                                onClick={() => setComposing(true)}
                                className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                                style={{
                                    height: 24,
                                    width: 24,
                                    borderRadius: 6,
                                    border: `1px dashed ${COLORS.primary.borderSubtle}`,
                                    background: 'transparent',
                                }}
                            >
                                <Plus style={{ height: 12, width: 12 }} />
                            </button>
                        )}
                    </div>
                    <div
                        className="flex items-center"
                        style={{
                            gap: 6,
                            fontSize: 10.5,
                            paddingTop: 6,
                            borderTop: `1px dashed ${COLORS.primary.borderSubtle}`,
                        }}
                    >
                        <Activity
                            style={{
                                height: 12,
                                width: 12,
                                color:
                                    observed > 0
                                        ? COLORS.success.dot
                                        : COLORS.muted.dot,
                            }}
                        />
                        <span
                            className="text-muted-foreground font-semibold"
                            style={{
                                letterSpacing: 'normal',
                                textTransform: 'none',
                            }}
                        >
                            {STRINGS.LABEL_HEADER_OBSERVED}
                        </span>
                        <span
                            className="font-mono"
                            style={{
                                color:
                                    observed > 0
                                        ? COLORS.success.dot
                                        : COLORS.muted.dot,
                                fontWeight: 600,
                            }}
                        >
                            {observed} req · last {RING_SECONDS}s
                        </span>
                    </div>
                    {joinedHeader && joinedValue && (
                        <button
                            type="button"
                            onClick={copyHeader}
                            title={
                                copied
                                    ? STRINGS.BTN_COPIED
                                    : STRINGS.BTN_COPY_HEADER
                            }
                            aria-label={STRINGS.BTN_COPY_HEADER}
                            className="font-mono group"
                            style={{
                                marginTop: 4,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '5px 8px',
                                borderRadius: 6,
                                border: `1px solid ${COLORS.primary.borderSubtle}`,
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: 11,
                                lineHeight: 1.35,
                                color: 'inherit',
                                textAlign: 'left',
                                transition:
                                    'background 120ms, border-color 120ms',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                    COLORS.primary.bgSoft;
                                e.currentTarget.style.borderColor =
                                    COLORS.primary.borderSoft;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                    'transparent';
                                e.currentTarget.style.borderColor =
                                    COLORS.primary.borderSubtle;
                            }}
                        >
                            <span
                                className="font-semibold"
                                style={{
                                    fontSize: 9,
                                    letterSpacing: 'normal',
                                    textTransform: 'none',
                                    color: COLORS.brand.lilac,
                                    flexShrink: 0,
                                }}
                            >
                                {STRINGS.LABEL_INJECTING}
                            </span>
                            <span
                                style={{
                                    color: COLORS.brand.yellow,
                                    fontWeight: 600,
                                    flexShrink: 0,
                                }}
                            >
                                {joinedHeader}
                            </span>
                            <span
                                className="text-muted-foreground"
                                style={{ flexShrink: 0 }}
                            >
                                :
                            </span>
                            <span
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    color: 'inherit',
                                }}
                            >
                                {joinedValue}
                            </span>
                            <span
                                style={{
                                    color: copied
                                        ? COLORS.success.dot
                                        : 'inherit',
                                    opacity: copied ? 1 : 0.6,
                                    flexShrink: 0,
                                    display: 'grid',
                                    placeItems: 'center',
                                }}
                                className="text-muted-foreground"
                            >
                                {copied ? (
                                    <Check style={{ height: 11, width: 11 }} />
                                ) : (
                                    <Copy style={{ height: 11, width: 11 }} />
                                )}
                            </span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
