import { STORAGE_KEYS } from './types';
import { capture } from './analytics';

async function storeBackendAndToken(
    backend: string,
    token: string
): Promise<void> {
    await new Promise<void>((resolve) => {
        chrome.storage.local.set(
            {
                [STORAGE_KEYS.MIRRORD_UI_BACKEND]: backend,
                [STORAGE_KEYS.MIRRORD_UI_TOKEN]: token,
            },
            () => resolve()
        );
    });
}

function render(html: string): void {
    const el = document.getElementById('content');
    if (el) el.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(location.search);
    const backend = params.get('backend');
    const token = params.get('token');
    const join = params.get('join');

    if (backend && token) {
        await storeBackendAndToken(backend, token);
        capture('extension_configured', { hasJoinParam: !!join });
        render(
            '<h2>mirrord ui connected</h2><p>You can close this tab and open the extension popup.</p>'
        );
        return;
    }

    if (join) {
        render(
            '<h2>Share URL received</h2><p>Handling of the share URL is not wired up yet.</p>'
        );
        return;
    }

    render(
        '<h2>Missing configuration</h2><p>This page expects <code>backend</code> and <code>token</code> (or <code>join</code>) query parameters.</p>'
    );
});
