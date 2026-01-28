import { BADGE } from './constants';

/**
 * Refresh browser extension icon badge text based on the number of
 * active request rules.
 *
 * @param num number of active request rules managed by the extension
 */
export function refreshIconIndicator(num: number) {
    chrome.action.setBadgeTextColor({ color: BADGE.COLOR });
    if (num > 0) {
        chrome.action.setBadgeText({ text: BADGE.ACTIVE });
    } else {
        chrome.action.setBadgeText({ text: BADGE.INACTIVE });
    }
}
