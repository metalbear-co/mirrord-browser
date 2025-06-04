import { refreshIconIndicator } from './util';

chrome.runtime.onStartup.addListener(refreshIcon);
chrome.runtime.onInstalled.addListener(refreshIcon);

function refreshIcon() {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        refreshIconIndicator(rules.length);
    });
}
