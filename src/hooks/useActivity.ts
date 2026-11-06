import { useEffect, useState } from 'react';
import {
    ACTIVITY_SESSION_KEY,
    emptyActivity,
    type ActivityState,
} from '../activity';

const CLOCK_TICK_MS = 5_000;

function sessionArea(): chrome.storage.StorageArea | undefined {
    if (typeof chrome === 'undefined') {
        return undefined;
    }
    return (
        chrome.storage as unknown as { session?: chrome.storage.StorageArea }
    ).session;
}

export function useActivity() {
    const [activity, setActivity] = useState<ActivityState>(() =>
        emptyActivity()
    );
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const area = sessionArea();
        if (!area) {
            return undefined;
        }
        let cancelled = false;
        area.get(ACTIVITY_SESSION_KEY)
            .then((stored) => {
                const value = stored[ACTIVITY_SESSION_KEY] as
                    | ActivityState
                    | undefined;
                if (!cancelled && value) {
                    setActivity(value);
                }
            })
            .catch(() => undefined);
        const listener = (
            changes: Record<string, chrome.storage.StorageChange>,
            areaName: string
        ) => {
            const change = changes[ACTIVITY_SESSION_KEY];
            if (areaName !== 'session' || !change) {
                return;
            }
            setActivity(
                (change.newValue as ActivityState | undefined) ??
                    emptyActivity()
            );
            setNow(Date.now());
        };
        chrome.storage.onChanged.addListener(listener);
        return () => {
            cancelled = true;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
        return () => clearInterval(timer);
    }, []);

    return { activity, now };
}
