import { renderHook, act } from '@testing-library/react';
import {
    setupChromeMock,
    resetChromeMock,
    mockGetDynamicRules,
    mockUpdateDynamicRules,
    mockStorageGet,
    mockStorageSet,
    mockStorageRemove,
} from './setup/chromeMock';

const mockCapture = jest.fn();

jest.mock('posthog-js/react', () => ({
    usePostHog: () => ({
        capture: mockCapture,
    }),
}));

setupChromeMock();

import { useHeaderRules } from '../hooks/useHeaderRules';

describe('useHeaderRules PostHog analytics', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetChromeMock();
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockStorageGet.mockImplementation((_keys, cb) => cb({}));
    });

    describe('handleSave', () => {
        it('captures extension_header_rule_saved with has_scope when scope is set', async () => {
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
            mockStorageSet.mockImplementation((_data, cb) => cb());

            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('test-value');
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

        it('captures extension_header_rule_saved with has_scope false when no scope', async () => {
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

            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_saved',
                { has_scope: false }
            );
        });

        it('does not capture event when save fails', async () => {
            (chrome.runtime as any).lastError = {
                message: 'Rule update error',
            };
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
            jest.spyOn(window, 'alert').mockImplementation();

            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.setHeaderName('X-Test');
                result.current.setHeaderValue('test-value');
            });

            await act(async () => {
                result.current.handleSave();
            });

            expect(mockCapture).not.toHaveBeenCalledWith(
                'extension_header_rule_saved',
                expect.anything()
            );
        });
    });

    describe('handleRemove', () => {
        it('captures extension_header_rule_removed on successful remove', () => {
            const rules: chrome.declarativeNetRequest.Rule[] = [
                {
                    id: 42,
                    priority: 1,
                    action: {
                        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
                        requestHeaders: [
                            {
                                header: 'X-Test',
                                operation:
                                    'set' as chrome.declarativeNetRequest.HeaderOperation,
                                value: 'value',
                            },
                        ],
                    },
                    condition: { urlFilter: '|' },
                },
            ];

            mockGetDynamicRules.mockImplementation((cb) => cb(rules));
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());

            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.handleRemove(42);
            });

            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_removed'
            );
        });

        it('does not capture event when remove fails', () => {
            (chrome.runtime as any).lastError = {
                message: 'Remove error',
            };
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation();

            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.handleRemove(42);
            });

            expect(mockCapture).not.toHaveBeenCalledWith(
                'extension_header_rule_removed'
            );

            consoleSpy.mockRestore();
        });
    });

    describe('handleReset', () => {
        it('captures extension_header_rule_reset on successful reset', () => {
            const defaults = {
                headerName: 'X-Default',
                headerValue: 'defaultval',
                scope: '*://default.com/*',
            };

            mockStorageGet.mockImplementation((_keys, cb) => cb({ defaults }));
            mockStorageRemove.mockImplementation((_keys, cb) => cb());
            mockGetDynamicRules.mockImplementation((cb) => cb([]));
            mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());

            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.handleReset();
            });

            expect(mockCapture).toHaveBeenCalledWith(
                'extension_header_rule_reset'
            );
        });

        it('does not capture event when reset fails due to missing defaults', () => {
            mockStorageGet.mockImplementation((_keys, cb) => cb({}));
            jest.spyOn(window, 'alert').mockImplementation();

            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.handleReset();
            });

            expect(mockCapture).not.toHaveBeenCalledWith(
                'extension_header_rule_reset'
            );
        });

        it('does not capture event when remove override fails', () => {
            const defaults = {
                headerName: 'X-Default',
                headerValue: 'defaultval',
            };

            mockStorageGet.mockImplementation((_keys, cb) => cb({ defaults }));
            (chrome.runtime as any).lastError = {
                message: 'Remove override error',
            };
            mockStorageRemove.mockImplementation((_keys, cb) => cb());
            jest.spyOn(window, 'alert').mockImplementation();

            const { result } = renderHook(() => useHeaderRules());

            act(() => {
                result.current.handleReset();
            });

            expect(mockCapture).not.toHaveBeenCalledWith(
                'extension_header_rule_reset'
            );
        });
    });
});
