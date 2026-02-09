import posthog from 'posthog-js';

jest.mock('posthog-js', () => ({
    init: jest.fn(),
    __esModule: true,
    default: {
        init: jest.fn(),
    },
}));

import { posthogConfig, POSTHOG_KEY, initPostHog } from '../analytics';

describe('analytics', () => {
    describe('initPostHog', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('calls posthog.init with the correct key and config', () => {
            initPostHog();

            expect(posthog.init).toHaveBeenCalledWith(
                POSTHOG_KEY,
                posthogConfig
            );
        });

        it('returns the posthog instance', () => {
            const result = initPostHog();

            expect(result).toBe(posthog);
        });
    });
});
