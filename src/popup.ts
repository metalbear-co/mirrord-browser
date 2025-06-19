import { refreshIconIndicator } from './util';

/**
 * Render rules managed by the extension in the given HTML element and
 * refresh the extension icon badge indicator based on the number of
 * active rules.
 * @param rulesListEl the HTML element that contains all rendered rules
 */
export function loadRequestRules(rulesListEl: HTMLDivElement) {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        renderRequestRules(rules, rulesListEl);
        refreshIconIndicator(rules.length);
    });
}

/**
 * Render the given declarative net request rules in the given HTML element.
 * Each rule takes a separate row which contains the rule content and a button
 * for removing the rule.
 * The extension only manage rules for HTTP header injection, thus, other rule
 * types are ignored.
 *
 * @param rules declarative net request rules to render
 * @param rulesListEl the HTML element that should contain the rendered rules
 * @returns
 */
export function renderRequestRules(
    rules: chrome.declarativeNetRequest.Rule[],
    rulesListEl: HTMLDivElement
) {
    rulesListEl.innerHTML = '';

    if (rules.length === 0) {
        const message = document.createElement('div');
        message.className = 'no-rules-message';
        message.textContent = 'No active header';
        rulesListEl.appendChild(message);
        return;
    }

    rules.forEach((rule) => {
        const div = document.createElement('div');
        div.className = 'rule-item';

        if (
            rule.action.type ===
                chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS &&
            rule.action.requestHeaders
        ) {
            const headers = rule.action.requestHeaders
                .map((h) => `${h.header}: ${h.value}`)
                .join(', ');
            const label = document.createElement('span');
            label.textContent = headers;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '❌';
            removeBtn.onclick = () => {
                chrome.declarativeNetRequest.updateDynamicRules(
                    { removeRuleIds: [rule.id] },
                    () => {
                        if (!chrome.runtime.lastError) {
                            // update rule list upon successfully removing rules
                            loadRequestRules(rulesListEl);
                        } else {
                            console.error(
                                'Failed to remove rule:',
                                chrome.runtime.lastError
                            );
                        }
                    }
                );
            };

            div.appendChild(label);
            div.appendChild(removeBtn);
            rulesListEl.appendChild(div);
        }
    });
}

/**
 * Main listener of the extension popup menu. Render all declarative net request
 * rules managed by the extension and handle rule removal.
 */
async function popupListener() {
    const rulesListEl = document.getElementById('rulesList') as HTMLDivElement;
    loadRequestRules(rulesListEl);
}

document.addEventListener('DOMContentLoaded', popupListener);
