import { renderHook, act } from '@testing-library/react';

// Mock analytics module
const mockCapture = jest.fn();
jest.mock('../analytics', () => ({
    capture: (...args: unknown[]) => mockCapture(...args),
    emitUserBlocked: jest.fn(),
    emitUserSucceeded: jest.fn(),
}));

jest.mock('../headerObservation', () => {
    const actual = jest.requireActual('../headerObservation');
    return {
        ...actual,
        armCanary: jest.fn(),
        cancelCanary: jest.fn(),
        notifyHeaderObserved: jest.fn(),
    };
});

// The DNR/storage helpers in ../util wrap the promise-based browser API; mock them so the
// hook's behaviour can be driven and asserted. Everything else (parseRules, buildDnrRule,
// refreshIconIndicator, buildShareUrl) stays real and uses the shared browser mock.
const mockGetDynamicRules = jest.fn();
const mockUpdateDynamicRules = jest.fn();
const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockStorageRemove = jest.fn();

jest.mock('../util', () => {
    const actual = jest.requireActual('../util');
    return {
        ...actual,
        getDynamicRules: mockGetDynamicRules,
        updateDynamicRules: mockUpdateDynamicRules,
        storageGet: mockStorageGet,
        storageSet: mockStorageSet,
        storageRemove: mockStorageRemove,
    };
});

const mockClipboardWriteText = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
    clipboard: { writeText: mockClipboardWriteText },
});

import { useHeaderRules } from '../hooks/useHeaderRules';
import type { DnrRule } from '../types';

describe('useHeaderRules analytics', () => {
    beforeEach(() => {
        mockGetDynamicRules.mockResolvedValue([]);
        mockUpdateDynamicRules.mockResolvedValue(undefined);
        mockStorageGet.mockResolvedValue({});
        mockStorageSet.mockResolvedValue(undefined);
        mockStorageRemove.mockResolvedValue(undefined);
    });

    describe('handleToggle', () => {
        it('deactivates when rules exist', async () => {
            const activeRule: DnrRule = {
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        {
                            header: 'X-Test',
                            operation: 'set',
                            value: 'val',
                        },
                    ],
                },
                condition: { urlFilter: '|' },
            };

            mockGetDynamicRules.mockResolvedValue([activeRule]);
            mockUpdateDynamicRules.mockResolvedValue(undefined);

            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                // Wait for initial load
            });

            await act(async () => {
                result.current.handleToggle();
            });

            expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
                removeRuleIds: [1],
                addRules: [],
            });
        });

        it('activates when no rules and config exists', async () => {
            mockGetDynamicRules.mockResolvedValue([]);
            mockStorageGet.mockResolvedValue({
                defaults: {
                    headerName: 'X-Test',
                    headerValue: 'val',
                },
            });
            mockUpdateDynamicRules.mockResolvedValue(undefined);
            mockStorageRemove.mockResolvedValue(undefined);

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
            mockUpdateDynamicRules.mockResolvedValue(undefined);
            mockStorageSet.mockResolvedValue(undefined);
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
                { has_scope: false, was_active: false }
            );
        });

        it('captures extension_header_rule_saved with scope', async () => {
            mockUpdateDynamicRules.mockResolvedValue(undefined);
            mockStorageSet.mockResolvedValue(undefined);
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
                { has_scope: true, was_active: false }
            );
        });

        it('does not update DNR rules when no rules are active (toggle off)', async () => {
            // No active rules, no config — toggle is off
            mockGetDynamicRules.mockResolvedValue([]);
            mockStorageSet.mockResolvedValue(undefined);
            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('value');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(mockUpdateDynamicRules).not.toHaveBeenCalled();
            expect(mockStorageSet).toHaveBeenCalledTimes(1);
            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_saved',
                { has_scope: false, was_active: false }
            );
        });

        it('updates DNR rules when a rule is already active (toggle on)', async () => {
            const activeRule: DnrRule = {
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        {
                            header: 'X-Old',
                            operation: 'set',
                            value: 'old',
                        },
                    ],
                },
                condition: { urlFilter: '|' },
            };
            mockGetDynamicRules.mockResolvedValue([activeRule]);
            mockUpdateDynamicRules.mockResolvedValue(undefined);
            mockStorageSet.mockResolvedValue(undefined);
            mockStorageRemove.mockResolvedValue(undefined);

            const { result } = renderHook(() => useHeaderRules());
            await act(async () => {
                // initial load
            });

            act(() => {
                result.current.setHeaderName('X-New');
                result.current.setHeaderValue('new');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(mockUpdateDynamicRules).toHaveBeenCalled();
            expect(mockStorageSet).toHaveBeenCalledTimes(1);
            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_saved',
                { has_scope: false, was_active: true }
            );
        });

        it('sets error on update_rules failure', async () => {
            // Must have an active rule for the update path to run on save.
            const activeRule: DnrRule = {
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        {
                            header: 'X-Test',
                            operation: 'set',
                            value: 'val',
                        },
                    ],
                },
                condition: { urlFilter: '|' },
            };
            mockGetDynamicRules.mockResolvedValue([activeRule]);
            mockUpdateDynamicRules.mockRejectedValueOnce(
                new Error('update failed')
            );
            const { result } = renderHook(() => useHeaderRules());
            await act(async () => {
                // initial load
            });

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
            mockUpdateDynamicRules.mockResolvedValue(undefined);
            mockStorageSet.mockRejectedValueOnce(new Error('storage failed'));
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
            mockStorageGet.mockResolvedValue({
                defaults: {
                    headerName: 'X-Default',
                    headerValue: 'defaultval',
                },
            });
            mockStorageRemove.mockResolvedValue(undefined);
            mockUpdateDynamicRules.mockResolvedValue(undefined);

            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                result.current.handleReset();
            });

            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_reset'
            );
        });

        it('sets error on storage_remove failure', async () => {
            mockStorageGet.mockResolvedValue({
                defaults: {
                    headerName: 'X-Default',
                    headerValue: 'defaultval',
                },
            });
            mockStorageRemove.mockRejectedValueOnce(new Error('remove failed'));

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
            mockStorageGet.mockResolvedValue({
                defaults: {
                    headerName: 'X-Default',
                    headerValue: 'defaultval',
                },
            });
            mockStorageRemove.mockResolvedValue(undefined);
            mockUpdateDynamicRules.mockRejectedValueOnce(
                new Error('update failed')
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
            mockStorageGet.mockResolvedValue({
                defaults: {
                    headerName: 'X-Test',
                    headerValue: 'val',
                },
            });

            const { result } = renderHook(() => useHeaderRules());

            await act(async () => {
                // Wait for initial load
            });

            expect(result.current.hasStoredConfig).toBe(true);
        });

        it('becomes true after save', async () => {
            mockUpdateDynamicRules.mockResolvedValue(undefined);
            mockStorageSet.mockResolvedValue(undefined);

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
