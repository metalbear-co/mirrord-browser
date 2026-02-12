export const mockGetDynamicRules = jest.fn();
export const mockUpdateDynamicRules = jest.fn();
export const mockSetBadgeText = jest.fn();
export const mockSetBadgeTextColor = jest.fn();
export const mockStorageGet = jest.fn();
export const mockStorageSet = jest.fn();
export const mockStorageRemove = jest.fn();

export function setupChromeMock() {
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
        storage: {
            local: {
                get: mockStorageGet,
                set: mockStorageSet,
                remove: mockStorageRemove,
            },
        },
    } as unknown as typeof chrome;
}

export function resetChromeMock() {
    (
        chrome.runtime as { lastError: chrome.runtime.LastError | null }
    ).lastError = null;
}
