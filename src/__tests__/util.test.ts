import { refreshIconIndicator } from '../util';

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
            color: '#ADD8E6',
        });
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '✓' });
    });

    it('sets badge color and clears text when num is 0', () => {
        refreshIconIndicator(0);

        expect(chrome.action.setBadgeTextColor).toHaveBeenCalledWith({
            color: '#ADD8E6',
        });
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });
});
