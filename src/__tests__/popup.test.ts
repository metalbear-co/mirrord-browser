import { loadRequestRules, renderRequestRules } from '../popup';

// Mock the chrome API globally
const mockGetDynamicRules = jest.fn();
const mockUpdateDynamicRules = jest.fn();
const mockSetBadgeText = jest.fn();
const mockSetBadgeTextColor = jest.fn();

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
        expect(container.querySelector('button')?.textContent).toBe('❌');
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
