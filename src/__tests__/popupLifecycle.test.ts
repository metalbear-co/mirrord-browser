jest.mock('../analytics', () => ({
    capture: jest.fn(),
    captureBeacon: jest.fn(),
    optOutReady: Promise.resolve(),
}));

import { capture, captureBeacon } from '../analytics';
import { trackPopupLifecycle } from '../popupLifecycle';

const captureMock = capture as jest.Mock;
const beaconMock = captureBeacon as jest.Mock;

function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
    });
    document.dispatchEvent(new Event('visibilitychange'));
}

describe('trackPopupLifecycle', () => {
    let cleanup: (() => void) | undefined;

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        cleanup?.();
        cleanup = undefined;
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible',
        });
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('reports the initial open once the opt-out state is known', async () => {
        cleanup = trackPopupLifecycle('side_panel');
        await Promise.resolve();

        expect(captureMock).toHaveBeenCalledTimes(1);
        expect(captureMock).toHaveBeenCalledWith('extension_popup_opened', {
            surface: 'side_panel',
            resumed: false,
        });
        expect(beaconMock).not.toHaveBeenCalled();
    });

    it('reports closed once when hidden, with the elapsed episode time', () => {
        cleanup = trackPopupLifecycle('side_panel');
        jest.advanceTimersByTime(5000);

        setVisibility('hidden');
        expect(beaconMock).toHaveBeenCalledTimes(1);
        expect(beaconMock).toHaveBeenCalledWith('extension_popup_closed', {
            duration_ms: 5000,
            surface: 'side_panel',
        });

        document.dispatchEvent(new Event('visibilitychange'));
        expect(beaconMock).toHaveBeenCalledTimes(1);
    });

    it('pairs a resumed open with a fresh close on the next episode', async () => {
        cleanup = trackPopupLifecycle('popup_fallback');
        await Promise.resolve();
        jest.advanceTimersByTime(1000);
        setVisibility('hidden');
        jest.advanceTimersByTime(60000);

        setVisibility('visible');
        await Promise.resolve();
        expect(captureMock).toHaveBeenLastCalledWith('extension_popup_opened', {
            surface: 'popup_fallback',
            resumed: true,
        });

        jest.advanceTimersByTime(2000);
        setVisibility('hidden');
        expect(beaconMock).toHaveBeenCalledTimes(2);
        expect(beaconMock).toHaveBeenLastCalledWith('extension_popup_closed', {
            duration_ms: 2000,
            surface: 'popup_fallback',
        });
    });

    it('does not report when becoming visible without a prior close', async () => {
        cleanup = trackPopupLifecycle('side_panel');
        await Promise.resolve();
        captureMock.mockClear();

        setVisibility('visible');
        expect(captureMock).not.toHaveBeenCalled();
        expect(beaconMock).not.toHaveBeenCalled();
    });

    it('stops reporting after cleanup', () => {
        const stop = trackPopupLifecycle('side_panel');
        stop();

        setVisibility('hidden');
        expect(beaconMock).not.toHaveBeenCalled();
    });
});
