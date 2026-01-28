import '@metalbear/ui/styles.css';
import { refreshIconIndicator } from './util';
import { StoredConfig, STORAGE_KEYS } from './types';
import { STRINGS, ELEMENT_IDS } from './constants';

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
        message.textContent = STRINGS.MSG_NO_ACTIVE_HEADER;
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
                urlFilter === '|'
                    ? STRINGS.MSG_ALL_URLS
                    : urlFilter || STRINGS.MSG_ALL_URLS;

            const headerLabel = document.createElement('div');
            headerLabel.className = 'rule-header';
            headerLabel.textContent = headers;

            const rowDiv = document.createElement('div');
            rowDiv.className = 'rule-item-row';

            const scopeLabel = document.createElement('div');
            scopeLabel.className = 'rule-scope';
            scopeLabel.textContent = scope;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = STRINGS.BTN_REMOVE;
            removeBtn.onclick = () => {
                chrome.declarativeNetRequest.updateDynamicRules(
                    { removeRuleIds: [rule.id] },
                    () => {
                        if (!chrome.runtime.lastError) {
                            // update rule list upon successfully removing rules
                            loadRequestRules(rulesListEl);
                        } else {
                            console.error(
                                STRINGS.ERR_REMOVE_RULE,
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
            reject(new Error(STRINGS.ERR_HEADER_REQUIRED));
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
 * Reset to default config from CLI.
 * Clears override, restores defaults, and updates DNR rule.
 */
export function resetToDefaults(
    nameInput: HTMLInputElement,
    valueInput: HTMLInputElement,
    scopeInput: HTMLInputElement,
    rulesListEl: HTMLDivElement
): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([STORAGE_KEYS.DEFAULTS], (result) => {
            const defaults: StoredConfig | undefined =
                result[STORAGE_KEYS.DEFAULTS];

            if (!defaults) {
                reject(new Error(STRINGS.ERR_NO_DEFAULTS));
                return;
            }

            // Clear override from storage
            chrome.storage.local.remove([STORAGE_KEYS.OVERRIDE], () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                // Update DNR rule with defaults
                const urlFilter = defaults.scope || '|';
                const rules = [
                    {
                        id: 1,
                        priority: 1,
                        action: {
                            type: chrome.declarativeNetRequest.RuleActionType
                                .MODIFY_HEADERS,
                            requestHeaders: [
                                {
                                    header: defaults.headerName,
                                    operation:
                                        chrome.declarativeNetRequest
                                            .HeaderOperation.SET,
                                    value: defaults.headerValue,
                                },
                            ],
                        },
                        condition: {
                            urlFilter,
                            resourceTypes: [
                                chrome.declarativeNetRequest.ResourceType
                                    .XMLHTTPREQUEST,
                                chrome.declarativeNetRequest.ResourceType
                                    .MAIN_FRAME,
                                chrome.declarativeNetRequest.ResourceType
                                    .SUB_FRAME,
                            ],
                        },
                    },
                ];

                chrome.declarativeNetRequest.getDynamicRules(
                    (existingRules) => {
                        chrome.declarativeNetRequest.updateDynamicRules(
                            {
                                removeRuleIds: existingRules.map((r) => r.id),
                                addRules: rules,
                            },
                            () => {
                                if (chrome.runtime.lastError) {
                                    reject(
                                        new Error(
                                            chrome.runtime.lastError.message
                                        )
                                    );
                                    return;
                                }

                                // Update form fields with defaults
                                nameInput.value = defaults.headerName;
                                valueInput.value = defaults.headerValue;
                                scopeInput.value = defaults.scope || '';

                                // Refresh UI
                                refreshIconIndicator(rules.length);
                                loadRequestRules(rulesListEl);
                                resolve();
                            }
                        );
                    }
                );
            });
        });
    });
}

/**
 * Main listener of the extension popup menu. Render all declarative net request
 * rules managed by the extension and handle rule removal.
 */
async function popupListener() {
    const rulesListEl = document.getElementById(
        ELEMENT_IDS.RULES_LIST
    ) as HTMLDivElement;
    const nameInput = document.getElementById(
        ELEMENT_IDS.HEADER_NAME
    ) as HTMLInputElement;
    const valueInput = document.getElementById(
        ELEMENT_IDS.HEADER_VALUE
    ) as HTMLInputElement;
    const scopeInput = document.getElementById(
        ELEMENT_IDS.SCOPE
    ) as HTMLInputElement;
    const saveBtn = document.getElementById(
        ELEMENT_IDS.SAVE_BTN
    ) as HTMLButtonElement;
    const resetBtn = document.getElementById(
        ELEMENT_IDS.RESET_BTN
    ) as HTMLButtonElement;

    // Load existing rules and form values
    loadRequestRules(rulesListEl);
    loadFormValues(nameInput, valueInput, scopeInput);

    // Handle save button click
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = STRINGS.BTN_SAVING;

        try {
            await saveOverride(
                nameInput.value.trim(),
                valueInput.value.trim(),
                scopeInput.value.trim() || undefined,
                rulesListEl
            );
            saveBtn.textContent = STRINGS.BTN_SAVED;
            setTimeout(() => {
                saveBtn.textContent = STRINGS.BTN_SAVE;
                saveBtn.disabled = false;
            }, 1500);
        } catch (err) {
            alert(STRINGS.ERR_SAVE_PREFIX + (err as Error).message);
            saveBtn.textContent = STRINGS.BTN_SAVE;
            saveBtn.disabled = false;
        }
    });

    // Handle reset button click
    resetBtn.addEventListener('click', async () => {
        resetBtn.disabled = true;
        resetBtn.textContent = STRINGS.BTN_RESETTING;

        try {
            await resetToDefaults(
                nameInput,
                valueInput,
                scopeInput,
                rulesListEl
            );
            resetBtn.textContent = STRINGS.BTN_RESET_DONE;
            setTimeout(() => {
                resetBtn.textContent = STRINGS.BTN_RESET;
                resetBtn.disabled = false;
            }, 1500);
        } catch (err) {
            alert(STRINGS.ERR_RESET_PREFIX + (err as Error).message);
            resetBtn.textContent = STRINGS.BTN_RESET;
            resetBtn.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', popupListener);
