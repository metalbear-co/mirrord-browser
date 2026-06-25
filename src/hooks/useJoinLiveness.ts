import { useEffect, useState } from 'react';

export type JoinLiveness = 'live' | 'pending' | 'ended';

/**
 * Tracks whether a joined session is still backed by a live operator session, with
 * a grace window before declaring it gone.
 *
 * A `mirrord` session frequently disappears from the operator's list for a few
 * seconds when the user's local process reconnects (stop → start): the old session
 * is torn down and a new one — same key, new id — takes its place. Flipping the
 * banner straight to "ended" in that gap left users staring at a "Dismiss" prompt
 * for a session that had already come back.
 *
 * Liveness is keyed on the session *key*, not the specific session id, so a
 * reconnect that reuses the key counts as live. When no session currently holds the
 * key we don't dismiss immediately: we hold a `pending` (warning) state for
 * `graceMs`, and only settle on `ended` if nothing reclaims the key within that
 * window. If the key goes live again at any point, we snap back to `live`.
 */
export function useJoinLiveness(
    joined: boolean,
    live: boolean,
    graceMs: number
): JoinLiveness {
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        if (!joined || live) {
            setExpired(false);
            return;
        }
        const timer = setTimeout(() => setExpired(true), graceMs);
        return () => clearTimeout(timer);
    }, [joined, live, graceMs]);

    if (live) return 'live';
    return expired ? 'ended' : 'pending';
}
