import { Card } from '@metalbear/ui';
import type { HeaderRule } from '../types';

/** Shown at the top of the popup when a DNR rule is active (from a session
 * join or a manually-saved custom header). Acts as the single source of
 * truth for "what header is being injected right now." */
type Props =
    | {
          mode: 'joined';
          joinedKey: string;
          onLeave: () => void;
      }
    | {
          mode: 'custom';
          rule: HeaderRule;
          onClear: () => void;
      }
    | {
          mode: 'idle';
      };

export default function ActiveRuleCard(props: Props) {
    if (props.mode === 'idle') {
        return (
            <Card className="overflow-hidden p-0 border-dashed">
                <div className="px-3 py-3 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30" />
                    <span className="text-xs text-muted-foreground">
                        No header injection active
                    </span>
                </div>
            </Card>
        );
    }

    const { headerLine, scopeLabel, statusLabel, actionLabel, onAction } =
        props.mode === 'joined'
            ? {
                  headerLine: `baggage: mirrord-session=${props.joinedKey}`,
                  scopeLabel: `Session: ${props.joinedKey}`,
                  statusLabel: 'Joined session',
                  actionLabel: 'Leave',
                  onAction: props.onLeave,
              }
            : {
                  headerLine: `${props.rule.header}: ${props.rule.value}`,
                  scopeLabel: props.rule.scope,
                  statusLabel: 'Custom header',
                  actionLabel: 'Clear',
                  onAction: props.onClear,
              };

    return (
        <Card className="overflow-hidden p-0 border-l-2 border-l-primary">
            <div className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: '#22c55e' }}
                        />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            {statusLabel}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onAction}
                        className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 shrink-0"
                    >
                        {actionLabel}
                    </button>
                </div>
                <div className="mt-1">
                    <code
                        className="text-xs font-mono block"
                        style={{
                            color: 'hsl(var(--brand-yellow))',
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {headerLine}
                    </code>
                    <span
                        className="text-[10px] text-muted-foreground block mt-0.5"
                        style={{ overflowWrap: 'anywhere' }}
                    >
                        {scopeLabel}
                    </span>
                </div>
            </div>
        </Card>
    );
}
