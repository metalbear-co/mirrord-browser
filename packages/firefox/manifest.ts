import base from '../core/manifest.base.json';

// Firefox-specific manifest. Firefox has no side panel, no `externally_connectable`
// and uses an event-page background (`background.scripts`) rather than a service
// worker. The popup opens as a normal action popup; popup.tsx already feature-detects
// the missing side panel and falls back to it. See ../chrome/manifest.ts for Chrome.
const manifest = {
    ...base,
    browser_specific_settings: {
        gecko: {
            id: 'mirrord@metalbear.com',
            strict_min_version: '128.0',
        },
    },
    action: {
        default_popup: 'pages/popup.html',
    },
    background: {
        scripts: ['src/background.ts'],
        type: 'module',
    },
};

export default manifest;
