import { useEffect, useState } from 'react';
import {
    HEADER_OBSERVATION_PORT,
    emptyObservation,
    type HeaderObservation,
} from '../headerObservation';
import { browser } from '../browser';

export function useHeaderObservation(): HeaderObservation {
    const [obs, setObs] = useState<HeaderObservation>(() =>
        emptyObservation('')
    );

    useEffect(() => {
        if (!browser.runtime?.connect) {
            return undefined;
        }
        let cancelled = false;
        const port = browser.runtime.connect({ name: HEADER_OBSERVATION_PORT });
        port.onMessage.addListener((msg: unknown) => {
            if (cancelled) return;
            setObs(msg as HeaderObservation);
        });
        return () => {
            cancelled = true;
            try {
                port.disconnect();
            } catch {}
        };
    }, []);

    return obs;
}
