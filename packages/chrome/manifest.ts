import base from '../core/manifest.base.json';

// Chrome-specific manifest. Adds the stable extension key, side panel surface,
// `externally_connectable` (for the localhost mirrord CLI handoff) and the MV3
// service-worker background. See ../firefox/manifest.ts for the Firefox variant.
const manifest = {
    ...base,
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoasM13FWg9dB6ufOs6gHQKfExEmQkaXR7uVMRtJPvmLQB8EnivUNLGQ0b8OZ5Eggn21oXNgdEl7WhcKLuK20cHcW61TE7XAKIcV6uDmlc1FJFczxpqI7L+GgeeAtiC9vkHFulBHmfCxq4z8+zqNRLpwZ6xMyt6j9rJ7V1h7Uv0n4shf6xG0ukyTpfAc64Pkp4GtG+bdy51ki9XE0pJEnyotk5I9eGKp/3kL0EAQW0a9ES/5LM+fFwPU2EWZlqkx07zd1AnlzzQ4kz2rceBUIkI/x1mPyzNkPlnOtvlNUooFq8J5L3be2n1pZS099OM5ZLKKjomARcr/iiqgrjdkXAQIDAQAB',
    incognito: 'spanning',
    permissions: [...base.permissions, 'sidePanel'],
    externally_connectable: {
        matches: ['http://localhost/*', 'http://127.0.0.1/*'],
    },
    action: {},
    side_panel: {
        default_path: 'pages/popup.html',
    },
    background: {
        service_worker: 'src/background.ts',
        type: 'module',
    },
};

export default manifest;
