import posthog from 'posthog-js';

const POSTHOG_KEY = 'phc_wIZh92nyk4vu6HidiLFUzjW6piZlZszuWZZFBS7yHHe';
const POSTHOG_HOST = 'https://hog.metalbear.com';

export const posthogConfig = {
    api_host: POSTHOG_HOST,
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only' as const,
    capture_pageview: false,
    capture_pageleave: false,
    persistence: 'localStorage' as const,
};

export { POSTHOG_KEY };

export function initPostHog() {
    posthog.init(POSTHOG_KEY, posthogConfig);
    return posthog;
}

// Expose instance for e2e test instrumentation via addInitScript.
// Tests use Object.defineProperty to trap this assignment and wrap capture().
if (typeof window !== 'undefined') {
    (window as any).__posthog = posthog;
}
