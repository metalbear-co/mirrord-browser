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

const mockClipboardWriteText = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
    clipboard: { writeText: mockClipboardWriteText },
});

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
        id: 'test-extension-id',
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
        mockGetDynamicRules.mockImplementation(
            (cb: (rules: chrome.declarativeNetRequest.Rule[]) => void) => cb([])
        );
        mockStorageGet.mockImplementation(
            (_keys: string[], cb: (result: Record<string, unknown>) => void) =>
                cb({})
        );
    });

    describe('handleToggle', () => {
        it('deactivates when rules exist', async () => {
            const activeRule: chrome.declarativeNetRequest.Rule = {
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
                    requestHeaders: [
                        {
                            header: 'X-Test',
                            operation:
                                'set' as chrome.declarativeNetRequest.HeaderOperation,
                            value: 'val',
                        },
                    ],
                },
                condition: { urlFilter: '|' },
            };

            mockGetDynamicRules.mockImplementation(
                (cb: (rules: chrome.declarativeNetRequest.Rule[]) => void) =>
                    cb([activeRule])
            );
            mockUpdateDynamicRules.mockImplementation(
                (_opts: unknown, cb: () => void) => cb()
            );

            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                // Wait for initial load
            });

            await act(async () => {
                result.current.handleToggle();
            });

            expect(mockUpdateDynamicRules).toHaveBeenCalledWith(
                { removeRuleIds: [1] },
                expect.any(Function)
            );
        });

        it('activates when no rules and config exists', async () => {
            mockGetDynamicRules.mockImplementation(
                (cb: (rules: chrome.declarativeNetRequest.Rule[]) => void) =>
                    cb([])
            );
            mockStorageGet.mockImplementation(
                (
                    _keys: string[],
                    cb: (result: Record<string, unknown>) => void
                ) =>
                    cb({
                        defaults: {
                            headerName: 'X-Test',
                            headerValue: 'val',
                        },
                    })
            );
            mockUpdateDynamicRules.mockImplementation(
                (_opts: unknown, cb: () => void) => cb()
            );

            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                // Wait for initial load
            });

            await act(async () => {
                result.current.handleToggle();
            });

            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_activated'
            );
        });
    });

    describe('handleSave', () => {
        it('captures extension_header_rule_saved on success', async () => {
            mockUpdateDynamicRules.mockImplementation(
                (_opts: unknown, cb: () => void) => cb()
            );
            mockStorageSet.mockImplementation(
                (_data: unknown, cb: () => void) => cb()
            );
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
            mockUpdateDynamicRules.mockImplementation(
                (_opts: unknown, cb: () => void) => cb()
            );
            mockStorageSet.mockImplementation(
                (_data: unknown, cb: () => void) => cb()
            );
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

        it('sets error on update_rules failure', async () => {
            mockUpdateDynamicRules.mockImplementation(
                (_opts: unknown, cb: () => void) => {
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
                }
            );
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(result.current.error).toContain('update failed');
            expect(mockCapture).toHaveBeenCalledWith('extension_error', {
                action: 'save',
                step: 'update_rules',
                error: 'update failed',
            });
        });

        it('sets error on storage_write failure', async () => {
            mockUpdateDynamicRules.mockImplementation(
                (_opts: unknown, cb: () => void) => cb()
            );
            mockStorageSet.mockImplementation(
                (_data: unknown, cb: () => void) => {
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
                }
            );
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(result.current.error).toContain('storage failed');
            expect(mockCapture).toHaveBeenCalledWith('extension_error', {
                action: 'save',
                step: 'storage_write',
                error: 'storage failed',
            });
        });

        it('sets error for empty header name', async () => {
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(result.current.error).toBe(
                'Header name and value are required'
            );
        });
    });

    describe('handleReset', () => {
        it('captures extension_header_rule_reset on success', async () => {
            mockStorageGet.mockImplementation(
                (
                    _keys: string[],
                    cb: (result: Record<string, unknown>) => void
                ) =>
                    cb({
                        defaults: {
                            headerName: 'X-Default',
                            headerValue: 'defaultval',
                        },
                    })
            );
            mockStorageRemove.mockImplementation(
                (_keys: string[], cb: () => void) => cb()
            );
            mockUpdateDynamicRules.mockImplementation(
                (_opts: unknown, cb: () => void) => cb()
            );

            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                result.current.handleReset();
            });

            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_reset'
            );
        });

        it('sets error on storage_remove failure', async () => {
            mockStorageGet.mockImplementation(
                (
                    _keys: string[],
                    cb: (result: Record<string, unknown>) => void
                ) =>
                    cb({
                        defaults: {
                            headerName: 'X-Default',
                            headerValue: 'defaultval',
                        },
                    })
            );
            mockStorageRemove.mockImplementation(
                (_keys: string[], cb: () => void) => {
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
                }
            );

            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                result.current.handleReset();
            });

            expect(result.current.error).toContain('remove failed');
            expect(mockCapture).toHaveBeenCalledWith('extension_error', {
                action: 'reset',
                step: 'storage_remove',
                error: 'remove failed',
            });
        });

        it('sets error on update_rules failure', async () => {
            mockStorageGet.mockImplementation(
                (
                    _keys: string[],
                    cb: (result: Record<string, unknown>) => void
                ) =>
                    cb({
                        defaults: {
                            headerName: 'X-Default',
                            headerValue: 'defaultval',
                        },
                    })
            );
            mockStorageRemove.mockImplementation(
                (_keys: string[], cb: () => void) => cb()
            );
            mockUpdateDynamicRules.mockImplementation(
                (_opts: unknown, cb: () => void) => {
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
                }
            );

            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                result.current.handleReset();
            });

            expect(result.current.error).toContain('update failed');
            expect(mockCapture).toHaveBeenCalledWith('extension_error', {
                action: 'reset',
                step: 'update_rules',
                error: 'update failed',
            });
        });

        it('sets error when no defaults available', async () => {
            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                result.current.handleReset();
            });

            expect(result.current.error).toBe('No defaults available');
        });
    });

    describe('canShare', () => {
        it('is false when form fields are empty', async () => {
            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                // Wait for initial load
            });

            expect(result.current.canShare).toBe(false);
        });

        it('is true when header name and value are set', async () => {
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            expect(result.current.canShare).toBe(true);
        });

        it('is false when only header name is set', async () => {
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
            });

            expect(result.current.canShare).toBe(false);
        });

        it('is false when values are whitespace only', async () => {
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('  ');
                result.current.setHeaderValue('  ');
            });

            expect(result.current.canShare).toBe(false);
        });
    });

    describe('handleShare', () => {
        beforeEach(() => {
            mockClipboardWriteText.mockClear();
        });

        it('copies URL to clipboard with encoded config', async () => {
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleShare();
            });

            expect(mockClipboardWriteText).toHaveBeenCalledTimes(1);
            const url = mockClipboardWriteText.mock.calls[0][0];
            expect(url).toMatch(
                /^chrome-extension:\/\/test-extension-id\/pages\/config\.html\?payload=/
            );
        });

        it('sets shareState to copied', async () => {
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleShare();
            });

            expect(result.current.shareState).toBe('copied');
        });

        it('captures extension_config_shared event', async () => {
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleShare();
            });

            expect(mockCapture).toHaveBeenCalledWith('extension_config_shared');
        });

        it('includes scope in encoded config when set', async () => {
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
                result.current.setScope('*://example.com/*');
            });

            await act(async () => {
                result.current.handleShare();
            });

            const url = mockClipboardWriteText.mock.calls[0][0];
            const payload = url.split('?payload=')[1];
            const decoded = JSON.parse(atob(payload));
            expect(decoded.inject_scope).toBe('*://example.com/*');
        });

        it('does nothing when canShare is false', async () => {
            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                result.current.handleShare();
            });

            expect(mockClipboardWriteText).not.toHaveBeenCalled();
        });
    });

    describe('hasStoredConfig', () => {
        it('is false when no config in storage', async () => {
            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                // Wait for initial load
            });

            expect(result.current.hasStoredConfig).toBe(false);
        });

        it('is true when config exists in storage', async () => {
            mockStorageGet.mockImplementation(
                (
                    _keys: string[],
                    cb: (result: Record<string, unknown>) => void
                ) =>
                    cb({
                        defaults: {
                            headerName: 'X-Test',
                            headerValue: 'val',
                        },
                    })
            );

            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                // Wait for initial load
            });

            expect(result.current.hasStoredConfig).toBe(true);
        });

        it('becomes true after save', async () => {
            mockUpdateDynamicRules.mockImplementation(
                (_opts: unknown, cb: () => void) => cb()
            );
            mockStorageSet.mockImplementation(
                (_data: unknown, cb: () => void) => cb()
            );

            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                // Wait for initial load
            });

            expect(result.current.hasStoredConfig).toBe(false);

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(result.current.hasStoredConfig).toBe(true);
        });
    });
});
