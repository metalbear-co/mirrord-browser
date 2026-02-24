import { renderHook, act } from '@testing-library/react';
import { ALL_RESOURCE_TYPES } from '../types';

const mockGetDynamicRules = jest.fn();
const mockUpdateDynamicRules = jest.fn();
const mockSetBadgeText = jest.fn();
const mockSetBadgeTextColor = jest.fn();
const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockStorageRemove = jest.fn();

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
            MAIN_FRAME: 'main_frame',
            SUB_FRAME: 'sub_frame',
            STYLESHEET: 'stylesheet',
            SCRIPT: 'script',
            IMAGE: 'image',
            FONT: 'font',
            OBJECT: 'object',
            XMLHTTPREQUEST: 'xmlhttprequest',
            PING: 'ping',
            MEDIA: 'media',
            WEBSOCKET: 'websocket',
            OTHER: 'other',
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

import { useHeaderRules } from '../hooks/useHeaderRules';

describe('useHeaderRules resource types', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (
            chrome.runtime as { lastError: chrome.runtime.LastError | null }
        ).lastError = null;
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockStorageGet.mockImplementation((_keys, cb) => cb({}));
    });

    it('creates rules with all resource types so headers apply to scripts, stylesheets, images, etc.', async () => {
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
        mockStorageSet.mockImplementation((_data, cb) => cb());

        const { result } = renderHook(() => useHeaderRules());

        act(() => {
            result.current.setHeaderName('X-Test');
            result.current.setHeaderValue('test-value');
        });

        await act(async () => {
            result.current.handleSave();
        });

        const addedRules = mockUpdateDynamicRules.mock.calls[0][0].addRules;
        expect(addedRules).toHaveLength(1);
        expect(addedRules[0].condition.resourceTypes).toEqual(
            ALL_RESOURCE_TYPES
        );
    });

    it('reset creates rules with all resource types', async () => {
        const defaults = {
            headerName: 'X-Default',
            headerValue: 'defaultval',
        };

        mockStorageGet.mockImplementation((_keys, cb) => cb({ defaults }));
        mockStorageRemove.mockImplementation((_keys, cb) => cb());
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());

        const { result } = renderHook(() => useHeaderRules());

        await act(async () => {
            result.current.handleReset();
        });

        const addedRules = mockUpdateDynamicRules.mock.calls[0][0].addRules;
        expect(addedRules).toHaveLength(1);
        expect(addedRules[0].condition.resourceTypes).toEqual(
            ALL_RESOURCE_TYPES
        );
    });
});
