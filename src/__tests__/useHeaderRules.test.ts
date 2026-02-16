import { renderHook, act } from '@testing-library/react';

// Mock analytics module
const mockCapture = jest.fn();
jest.mock('../analytics', () => ({
    capture: (...args: unknown[]) => mockCapture(...args),
}));

// Mock chrome API
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

describe('useHeaderRules analytics', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (
            chrome.runtime as { lastError: chrome.runtime.LastError | null }
        ).lastError = null;
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockStorageGet.mockImplementation((_keys, cb) => cb({}));
    });

    describe('handleRemove', () => {
        it('captures extension_header_rule_removed on success', () => {
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.handleRemove(1);
            });

            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_removed'
            );
        });

        it('captures extension_error on failure', () => {
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => {
                (
                    chrome.runtime as {
                        lastError: chrome.runtime.LastError | null;
                    }
                ).lastError = { message: 'remove failed' };
                cb();
                (
                    chrome.runtime as {
                        lastError: chrome.runtime.LastError | null;
                    }
                ).lastError = null;
            });
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.handleRemove(1);
            });

            expect(mockCapture).toHaveBeenCalledWith('extension_error', {
                action: 'remove',
                error: 'remove failed',
            });
        });
    });

    describe('handleSave', () => {
        it('captures extension_header_rule_saved on success', async () => {
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
            mockStorageSet.mockImplementation((_data, cb) => cb());
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_saved',
                { has_scope: false }
            );
        });

        it('captures extension_header_rule_saved with scope', async () => {
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
            mockStorageSet.mockImplementation((_data, cb) => cb());
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
                result.current.setScope('*://example.com/*');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_saved',
                { has_scope: true }
            );
        });

        it('captures extension_error on update_rules failure', async () => {
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => {
                (
                    chrome.runtime as {
                        lastError: chrome.runtime.LastError | null;
                    }
                ).lastError = { message: 'update failed' };
                cb();
                (
                    chrome.runtime as {
                        lastError: chrome.runtime.LastError | null;
                    }
                ).lastError = null;
            });
            jest.spyOn(window, 'alert').mockImplementation();
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(mockCapture).toHaveBeenCalledWith('extension_error', {
                action: 'save',
                step: 'update_rules',
                error: 'update failed',
            });
        });

        it('captures extension_error on storage_write failure', async () => {
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
            mockStorageSet.mockImplementation((_data, cb) => {
                (
                    chrome.runtime as {
                        lastError: chrome.runtime.LastError | null;
                    }
                ).lastError = { message: 'storage failed' };
                cb();
                (
                    chrome.runtime as {
                        lastError: chrome.runtime.LastError | null;
                    }
                ).lastError = null;
            });
            jest.spyOn(window, 'alert').mockImplementation();
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(mockCapture).toHaveBeenCalledWith('extension_error', {
                action: 'save',
                step: 'storage_write',
                error: 'storage failed',
            });
        });
    });

    describe('handleReset', () => {
        it('captures extension_header_rule_reset on success', () => {
            mockStorageGet.mockImplementation((_keys, cb) =>
                cb({
                    defaults: {
                        headerName: 'X-Default',
                        headerValue: 'defaultval',
                    },
                })
            );
            mockStorageRemove.mockImplementation((_keys, cb) => cb());
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());

            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.handleReset();
            });

            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_reset'
            );
        });

        it('captures extension_error on storage_remove failure', () => {
            mockStorageGet.mockImplementation((_keys, cb) =>
                cb({
                    defaults: {
                        headerName: 'X-Default',
                        headerValue: 'defaultval',
                    },
                })
            );
            mockStorageRemove.mockImplementation((_keys, cb) => {
                (
                    chrome.runtime as {
                        lastError: chrome.runtime.LastError | null;
                    }
                ).lastError = { message: 'remove failed' };
                cb();
                (
                    chrome.runtime as {
                        lastError: chrome.runtime.LastError | null;
                    }
                ).lastError = null;
            });
            jest.spyOn(window, 'alert').mockImplementation();

            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.handleReset();
            });

            expect(mockCapture).toHaveBeenCalledWith('extension_error', {
                action: 'reset',
                step: 'storage_remove',
                error: 'remove failed',
            });
        });

        it('captures extension_error on update_rules failure', () => {
            mockStorageGet.mockImplementation((_keys, cb) =>
                cb({
                    defaults: {
                        headerName: 'X-Default',
                        headerValue: 'defaultval',
                    },
                })
            );
            mockStorageRemove.mockImplementation((_keys, cb) => cb());
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => {
                (
                    chrome.runtime as {
                        lastError: chrome.runtime.LastError | null;
                    }
                ).lastError = { message: 'update failed' };
                cb();
                (
                    chrome.runtime as {
                        lastError: chrome.runtime.LastError | null;
                    }
                ).lastError = null;
            });
            jest.spyOn(window, 'alert').mockImplementation();

            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.handleReset();
            });

            expect(mockCapture).toHaveBeenCalledWith('extension_error', {
                action: 'reset',
                step: 'update_rules',
                error: 'update failed',
            });
        });
    });
});
