import { STORAGE_KEYS, type ThemePref } from './types';

function isThemePref(v: unknown): v is ThemePref {
    return v === 'system' || v === 'light' || v === 'dark';
}

export function resolveDark(pref: ThemePref): boolean {
    if (pref === 'dark') return true;
    if (pref === 'light') return false;
    if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
    )
        return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDark(dark: boolean) {
    document.documentElement.classList.toggle('dark', dark);
}

export async function loadTheme(): Promise<ThemePref> {
    try {
        const stored = await chrome.storage.local.get(STORAGE_KEYS.THEME);
        const v = stored?.[STORAGE_KEYS.THEME];
        if (isThemePref(v)) return v;
    } catch {}
    return 'system';
}

export async function saveTheme(pref: ThemePref): Promise<void> {
    try {
        await chrome.storage.local.set({ [STORAGE_KEYS.THEME]: pref });
    } catch {}
}

/**
 * Read the persisted theme preference and apply it to <html>. If the user is
 * on `system`, also subscribe to OS color-scheme changes so the extension
 * follows along while open.
 */
export function initTheme(): () => void {
    let currentPref: ThemePref = 'system';
    applyDark(resolveDark(currentPref));

    const media =
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-color-scheme: dark)')
            : null;
    const onMedia = () => {
        if (currentPref === 'system') applyDark(resolveDark('system'));
    };
    media?.addEventListener('change', onMedia);

    loadTheme()
        .then((pref) => {
            currentPref = pref;
            applyDark(resolveDark(pref));
        })
        .catch(() => {});

    const onStorage = (
        changes: Record<string, chrome.storage.StorageChange>,
        area: chrome.storage.AreaName
    ) => {
        if (area !== 'local') return;
        const change = changes[STORAGE_KEYS.THEME];
        if (!change) return;
        const next = isThemePref(change.newValue) ? change.newValue : 'system';
        currentPref = next;
        applyDark(resolveDark(next));
    };
    chrome.storage.onChanged.addListener(onStorage);

    return () => {
        media?.removeEventListener('change', onMedia);
        chrome.storage.onChanged.removeListener(onStorage);
    };
}
