import '@metalbear/ui/styles.css';
import { refreshIconIndicator } from './util';
import { StoredConfig, STORAGE_KEYS } from './types';

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

            // Get scope from urlFilter ('|' means all URLs)
            const urlFilter = rule.condition?.urlFilter;
            const scope =
                urlFilter === '|' ? 'All URLs' : urlFilter || 'All URLs';

            const headerLabel = document.createElement('div');
            headerLabel.className = 'rule-header';
            headerLabel.textContent = headers;

            const rowDiv = document.createElement('div');
            rowDiv.className = 'rule-item-row';

            const scopeLabel = document.createElement('div');
            scopeLabel.className = 'rule-scope';
            scopeLabel.textContent = scope;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
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

            rowDiv.appendChild(scopeLabel);
            rowDiv.appendChild(removeBtn);
            div.appendChild(headerLabel);
            div.appendChild(rowDiv);
            rulesListEl.appendChild(div);
        }
    });
}

/**
 * Load stored config (override or defaults) into form fields.
 */
export function loadFormValues(
    nameInput: HTMLInputElement,
    valueInput: HTMLInputElement,
    scopeInput: HTMLInputElement
) {
    chrome.storage.local.get(
        [STORAGE_KEYS.OVERRIDE, STORAGE_KEYS.DEFAULTS],
        (result) => {
            // Prefer override, fall back to defaults
            const config: StoredConfig | undefined =
                result[STORAGE_KEYS.OVERRIDE] || result[STORAGE_KEYS.DEFAULTS];

            if (config) {
                nameInput.value = config.headerName || '';
                valueInput.value = config.headerValue || '';
                scopeInput.value = config.scope || '';
            }
        }
    );
}

/**
 * Save override config and update DNR rule.
 */
export function saveOverride(
    headerName: string,
    headerValue: string,
    scope: string | undefined,
    rulesListEl: HTMLDivElement
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!headerName || !headerValue) {
            reject(new Error('Header name and value are required'));
            return;
        }

        const override: StoredConfig = {
            headerName,
            headerValue,
            scope: scope || undefined,
        };

        // Use scope if provided, otherwise apply to all URLs
        // See: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-RuleCondition
        const urlFilter = scope || '|';

        const rules = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType
                        .MODIFY_HEADERS,
                    requestHeaders: [
                        {
                            header: headerName,
                            operation:
                                chrome.declarativeNetRequest.HeaderOperation
                                    .SET,
                            value: headerValue,
                        },
                    ],
                },
                condition: {
                    urlFilter,
                    resourceTypes: [
                        chrome.declarativeNetRequest.ResourceType
                            .XMLHTTPREQUEST,
                        chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                        chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                    ],
                },
            },
        ];

        // Update DNR rule
        chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
            chrome.declarativeNetRequest.updateDynamicRules(
                {
                    removeRuleIds: existingRules.map((r) => r.id),
                    addRules: rules,
                },
                () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    // Save override to storage
                    chrome.storage.local.set(
                        { [STORAGE_KEYS.OVERRIDE]: override },
                        () => {
                            if (chrome.runtime.lastError) {
                                reject(
                                    new Error(chrome.runtime.lastError.message)
                                );
                                return;
                            }
                            refreshIconIndicator(rules.length);
                            loadRequestRules(rulesListEl);
                            resolve();
                        }
                    );
                }
            );
        });
    });
}

/**
 * Main listener of the extension popup menu. Render all declarative net request
 * rules managed by the extension and handle rule removal.
 */
async function popupListener() {
    const rulesListEl = document.getElementById('rulesList') as HTMLDivElement;
    const nameInput = document.getElementById('headerName') as HTMLInputElement;
    const valueInput = document.getElementById(
        'headerValue'
    ) as HTMLInputElement;
    const scopeInput = document.getElementById('scope') as HTMLInputElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;

    // Load existing rules and form values
    loadRequestRules(rulesListEl);
    loadFormValues(nameInput, valueInput, scopeInput);

    // Handle save button click
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            await saveOverride(
                nameInput.value.trim(),
                valueInput.value.trim(),
                scopeInput.value.trim() || undefined,
                rulesListEl
            );
            saveBtn.textContent = 'Saved!';
            setTimeout(() => {
                saveBtn.textContent = 'Save';
                saveBtn.disabled = false;
            }, 1500);
        } catch (err) {
            alert('Failed to save: ' + (err as Error).message);
            saveBtn.textContent = 'Save';
            saveBtn.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', popupListener);
