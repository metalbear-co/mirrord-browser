import { renderHook, act } from '@testing-library/react';
import { ALL_RESOURCE_TYPES } from '../types';

// The DNR/storage helpers in ../util wrap the promise-based browser API; mock them here so
// we can assert exactly what rules the hook would install.
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

import { useHeaderRules } from '../hooks/useHeaderRules';

describe('useHeaderRules resource types', () => {
    beforeEach(() => {
        mockGetDynamicRules.mockResolvedValue([]);
        mockUpdateDynamicRules.mockResolvedValue(undefined);
        mockStorageGet.mockResolvedValue({});
        mockStorageSet.mockResolvedValue(undefined);
        mockStorageRemove.mockResolvedValue(undefined);
    });

    it('creates rules with all resource types so headers apply to scripts, stylesheets, images, etc.', async () => {
        // Rule already active — save refreshes it with the full resource-type list.
        mockGetDynamicRules.mockResolvedValue([
            {
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
            },
        ]);

        const { result } = renderHook(() => useHeaderRules());

        await act(async () => {
            // initial load
        });

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

        mockStorageGet.mockResolvedValue({ defaults });

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
