import { refreshIconIndicator } from '../util';
import { BADGE } from '../constants';

describe('refreshIconIndicator', () => {
    beforeEach(() => {
        globalThis.chrome = {
            action: {
                setBadgeTextColor: jest.fn(),
                setBadgeText: jest.fn(),
            },
        } as any;
    });

    it('sets badge color and ✓ when num > 0', () => {
        refreshIconIndicator(1);

        expect(chrome.action.setBadgeTextColor).toHaveBeenCalledWith({
            color: BADGE.COLOR,
        });
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
            text: BADGE.ACTIVE,
        });
    });

    it('sets badge color and clears text when num is 0', () => {
        refreshIconIndicator(0);

        expect(chrome.action.setBadgeTextColor).toHaveBeenCalledWith({
            color: BADGE.COLOR,
        });
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
            text: BADGE.INACTIVE,
        });
    });
});
