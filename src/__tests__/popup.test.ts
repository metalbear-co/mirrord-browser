import {
    loadRequestRules,
    renderRequestRules,
    loadFormValues,
    saveOverride,
} from '../popup';
import { STORAGE_KEYS } from '../types';

// Mock the chrome API globally
const mockGetDynamicRules = jest.fn();
const mockUpdateDynamicRules = jest.fn();
const mockSetBadgeText = jest.fn();
const mockSetBadgeTextColor = jest.fn();
const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();

globalThis.chrome = {
    declarativeNetRequest: {
        getDynamicRules: mockGetDynamicRules,
        updateDynamicRules: mockUpdateDynamicRules,
        RuleActionType: {
            MODIFY_HEADERS: 'modifyHeaders',
        },
        HeaderOperation: {
            SET: 'set',
        },
        ResourceType: {
            XMLHTTPREQUEST: 'xml_http_request',
            MAIN_FRAME: 'main_frame',
            SUB_FRAME: 'sub_frame',
        },
    },
    action: {
        setBadgeText: mockSetBadgeText,
        setBadgeTextColor: mockSetBadgeTextColor,
    },
    storage: {
        local: {
            get: mockStorageGet,
            set: mockStorageSet,
        },
    },
    runtime: {
        lastError: null,
    },
} as any;

describe('renderRequestRules', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        jest.clearAllMocks();
    });

    it('displays "No active header" when rules are empty', () => {
        renderRequestRules([], container);

        expect(container.textContent).toContain('No active header');
        expect(container.querySelector('.no-rules-message')).not.toBeNull();
    });

    it('renders a header rule with label and remove button', () => {
        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType
                        .MODIFY_HEADERS,
                    requestHeaders: [
                        {
                            header: 'X-MIRRORD-USER',
                            operation:
                                chrome.declarativeNetRequest.HeaderOperation
                                    .SET,
                            value: 'someone',
                        },
                    ],
                },
                condition: {
                    urlFilter: '|',
                    resourceTypes: [
                        chrome.declarativeNetRequest.ResourceType
                            .XMLHTTPREQUEST,
                        chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                        chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                    ],
                },
            },
        ];

        renderRequestRules(rules, container);

        const ruleItem = container.querySelector('.rule-item');
        expect(ruleItem).not.toBeNull();
        expect(ruleItem?.textContent).toContain('X-MIRRORD-USER: someone');
        expect(container.querySelector('button')?.textContent).toBe('Remove');
    });
});

describe('loadRequestRules', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        jest.clearAllMocks();
    });

    it('fetches and renders rules, updates badge', () => {
        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 42,
                priority: 1,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType
                        .MODIFY_HEADERS,
                    requestHeaders: [
                        {
                            header: 'X-MIRRORD-USER',
                            operation:
                                chrome.declarativeNetRequest.HeaderOperation
                                    .SET,
                            value: 'someone',
                        },
                    ],
                },
                condition: {
                    urlFilter: '|',
                    resourceTypes: [
                        chrome.declarativeNetRequest.ResourceType
                            .XMLHTTPREQUEST,
                        chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                        chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                    ],
                },
            },
        ];

        mockGetDynamicRules.mockImplementation((cb) => cb(rules));

        loadRequestRules(container);

        expect(mockGetDynamicRules).toHaveBeenCalled();
        expect(mockSetBadgeTextColor).toHaveBeenCalledWith({
            color: '#ADD8E6',
        });
        expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '✓' });
    });

    it('sets empty badge if no rules returned', () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));

        loadRequestRules(container);

        expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '' });
    });
});

describe('loadFormValues', () => {
    let nameInput: HTMLInputElement;
    let valueInput: HTMLInputElement;
    let scopeInput: HTMLInputElement;

    beforeEach(() => {
        nameInput = document.createElement('input');
        valueInput = document.createElement('input');
        scopeInput = document.createElement('input');
        jest.clearAllMocks();
    });

    it('loads override config when it exists', () => {
        const override = {
            headerName: 'X-Override',
            headerValue: 'overrideValue',
            scope: '*://override.com/*',
        };

        mockStorageGet.mockImplementation((_keys, cb) =>
            cb({ [STORAGE_KEYS.OVERRIDE]: override })
        );

        loadFormValues(nameInput, valueInput, scopeInput);

        expect(mockStorageGet).toHaveBeenCalledWith(
            [STORAGE_KEYS.OVERRIDE, STORAGE_KEYS.DEFAULTS],
            expect.any(Function)
        );
        expect(nameInput.value).toBe('X-Override');
        expect(valueInput.value).toBe('overrideValue');
        expect(scopeInput.value).toBe('*://override.com/*');
    });

    it('falls back to defaults when no override exists', () => {
        const defaults = {
            headerName: 'X-Default',
            headerValue: 'defaultValue',
            scope: '*://default.com/*',
        };

        mockStorageGet.mockImplementation((_keys, cb) =>
            cb({ [STORAGE_KEYS.DEFAULTS]: defaults })
        );

        loadFormValues(nameInput, valueInput, scopeInput);

        expect(nameInput.value).toBe('X-Default');
        expect(valueInput.value).toBe('defaultValue');
        expect(scopeInput.value).toBe('*://default.com/*');
    });

    it('prefers override over defaults when both exist', () => {
        const override = {
            headerName: 'X-Override',
            headerValue: 'overrideValue',
            scope: '*://override.com/*',
        };
        const defaults = {
            headerName: 'X-Default',
            headerValue: 'defaultValue',
            scope: '*://default.com/*',
        };

        mockStorageGet.mockImplementation((_keys, cb) =>
            cb({
                [STORAGE_KEYS.OVERRIDE]: override,
                [STORAGE_KEYS.DEFAULTS]: defaults,
            })
        );

        loadFormValues(nameInput, valueInput, scopeInput);

        expect(nameInput.value).toBe('X-Override');
        expect(valueInput.value).toBe('overrideValue');
        expect(scopeInput.value).toBe('*://override.com/*');
    });

    it('leaves form empty when neither override nor defaults exist', () => {
        mockStorageGet.mockImplementation((_keys, cb) => cb({}));

        loadFormValues(nameInput, valueInput, scopeInput);

        expect(nameInput.value).toBe('');
        expect(valueInput.value).toBe('');
        expect(scopeInput.value).toBe('');
    });

    it('handles config without scope', () => {
        const defaults = {
            headerName: 'X-NoScope',
            headerValue: 'noScopeValue',
        };

        mockStorageGet.mockImplementation((_keys, cb) =>
            cb({ [STORAGE_KEYS.DEFAULTS]: defaults })
        );

        loadFormValues(nameInput, valueInput, scopeInput);

        expect(nameInput.value).toBe('X-NoScope');
        expect(valueInput.value).toBe('noScopeValue');
        expect(scopeInput.value).toBe('');
    });
});

describe('saveOverride', () => {
    let rulesListEl: HTMLDivElement;

    beforeEach(() => {
        rulesListEl = document.createElement('div');
        jest.clearAllMocks();
        (chrome.runtime as any).lastError = null;
    });

    it('saves successfully with header name, value, and scope', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
        mockStorageSet.mockImplementation((_data, cb) => cb());

        await saveOverride(
            'X-Custom',
            'customValue',
            '*://example.com/*',
            rulesListEl
        );

        expect(mockUpdateDynamicRules).toHaveBeenCalledWith(
            expect.objectContaining({
                addRules: expect.arrayContaining([
                    expect.objectContaining({
                        action: expect.objectContaining({
                            requestHeaders: [
                                expect.objectContaining({
                                    header: 'X-Custom',
                                    value: 'customValue',
                                }),
                            ],
                        }),
                        condition: expect.objectContaining({
                            urlFilter: '*://example.com/*',
                        }),
                    }),
                ]),
            }),
            expect.any(Function)
        );

        expect(mockStorageSet).toHaveBeenCalledWith(
            {
                [STORAGE_KEYS.OVERRIDE]: {
                    headerName: 'X-Custom',
                    headerValue: 'customValue',
                    scope: '*://example.com/*',
                },
            },
            expect.any(Function)
        );
    });

    it('saves successfully without scope (applies to all URLs)', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
        mockStorageSet.mockImplementation((_data, cb) => cb());

        await saveOverride('X-AllUrls', 'allUrlsValue', undefined, rulesListEl);

        expect(mockUpdateDynamicRules).toHaveBeenCalledWith(
            expect.objectContaining({
                addRules: expect.arrayContaining([
                    expect.objectContaining({
                        condition: expect.objectContaining({
                            urlFilter: '|',
                        }),
                    }),
                ]),
            }),
            expect.any(Function)
        );

        expect(mockStorageSet).toHaveBeenCalledWith(
            {
                [STORAGE_KEYS.OVERRIDE]: {
                    headerName: 'X-AllUrls',
                    headerValue: 'allUrlsValue',
                    scope: undefined,
                },
            },
            expect.any(Function)
        );
    });

    it('rejects when header name is empty', async () => {
        await expect(
            saveOverride('', 'someValue', undefined, rulesListEl)
        ).rejects.toThrow('Header name and value are required');

        expect(mockUpdateDynamicRules).not.toHaveBeenCalled();
    });

    it('rejects when header value is empty', async () => {
        await expect(
            saveOverride('X-Header', '', undefined, rulesListEl)
        ).rejects.toThrow('Header name and value are required');

        expect(mockUpdateDynamicRules).not.toHaveBeenCalled();
    });

    it('rejects when DNR update fails', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => {
            (chrome.runtime as any).lastError = {
                message: 'DNR update failed',
            };
            cb();
        });

        await expect(
            saveOverride('X-Header', 'value', undefined, rulesListEl)
        ).rejects.toThrow('DNR update failed');
    });

    it('rejects when storage set fails', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
        mockStorageSet.mockImplementation((_data, cb) => {
            (chrome.runtime as any).lastError = { message: 'Storage failed' };
            cb();
        });

        await expect(
            saveOverride('X-Header', 'value', undefined, rulesListEl)
        ).rejects.toThrow('Storage failed');
    });
});
