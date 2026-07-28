import { capture, captureBeacon, optOutReady } from './analytics';

export type PopupSurface = 'side_panel' | 'popup_fallback';

export function trackPopupLifecycle(surface: PopupSurface): () => void {
    let episodeStart = Date.now();
    let closeSent = false;

    void optOutReady.then(() =>
        capture('extension_popup_opened', { surface, resumed: false })
    );

    const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            if (closeSent) {
                return;
            }
            closeSent = true;
            captureBeacon('extension_popup_closed', {
                duration_ms: Date.now() - episodeStart,
                surface,
            });
        } else if (closeSent) {
            closeSent = false;
            episodeStart = Date.now();
            capture('extension_popup_opened', { surface, resumed: true });
        }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
    };
}
