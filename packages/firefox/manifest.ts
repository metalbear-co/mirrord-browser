import base from '../core/manifest.base.json';

// Firefox-specific manifest. Firefox has no `side_panel` or `externally_connectable`
// and uses an event-page background (`background.scripts`) rather than a service worker.
// To mirror Chrome's "click the toolbar icon to open a docked panel", the popup UI is
// hosted in Firefox's native sidebar (`sidebar_action`) and the action has no default
// popup — clicking it toggles the sidebar via a background `action.onClicked` handler.
// See ../chrome/manifest.ts for the Chrome (side panel) variant.
const manifest = {
    ...base,
    browser_specific_settings: {
        gecko: {
            id: 'mirrord@metalbear.com',
            strict_min_version: '128.0',
        },
    },
    action: {},
    sidebar_action: {
        default_panel: 'pages/popup.html',
        default_title: 'mirrord',
    },
    background: {
        scripts: ['src/background.ts'],
        type: 'module',
    },
};

export default manifest;
