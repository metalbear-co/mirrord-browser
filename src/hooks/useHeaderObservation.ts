import { useEffect, useState } from 'react';
import {
    HEADER_OBSERVATION_PORT,
    emptyObservation,
    type HeaderObservation,
} from '../headerObservation';

export function useHeaderObservation(): HeaderObservation {
    const [obs, setObs] = useState<HeaderObservation>(() =>
        emptyObservation('')
    );

    useEffect(() => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
            return undefined;
        }
        let cancelled = false;
        const port = chrome.runtime.connect({ name: HEADER_OBSERVATION_PORT });
        port.onMessage.addListener((msg: HeaderObservation) => {
            if (cancelled) return;
            setObs(msg);
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
