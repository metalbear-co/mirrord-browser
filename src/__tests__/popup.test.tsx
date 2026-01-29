import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// Mock @metalbear/ui components to avoid ts-jest type resolution issues with VariantProps
jest.mock('@metalbear/ui', () => ({
    Button: ({
        children,
        onClick,
        className,
    }: React.PropsWithChildren<{
        onClick?: () => void;
        className?: string;
    }>) => (
        <button onClick={onClick} className={className}>
            {children}
        </button>
    ),
    Card: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <div className={className}>{children}</div>
    ),
    Badge: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <span className={className}>{children}</span>
    ),
    Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
    TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock chrome API
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
} as unknown as typeof chrome;

// Import after mocks are set up
import { Popup } from '../popup';

describe('Popup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (
            chrome.runtime as { lastError: chrome.runtime.LastError | null }
        ).lastError = null;
    });

    it('displays "No active headers" when rules are empty', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('No active headers')).toBeInTheDocument();
        });
    });

    it('renders header rules', async () => {
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
                            value: 'testuser',
                        },
                    ],
                },
                condition: {
                    urlFilter: '|',
                    resourceTypes: [
                        chrome.declarativeNetRequest.ResourceType
                            .XMLHTTPREQUEST,
                    ],
                },
            },
        ];

        mockGetDynamicRules.mockImplementation((cb) => cb(rules));

        render(<Popup />);

        await waitFor(() => {
            expect(
                screen.getByText(/X-MIRRORD-USER.*testuser/)
            ).toBeInTheDocument();
            expect(screen.getByText('All URLs')).toBeInTheDocument();
        });
    });

    it('renders scoped header rules', async () => {
        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType
                        .MODIFY_HEADERS,
                    requestHeaders: [
                        {
                            header: 'X-API-KEY',
                            operation:
                                chrome.declarativeNetRequest.HeaderOperation
                                    .SET,
                            value: 'secret123',
                        },
                    ],
                },
                condition: {
                    urlFilter: '*://api.example.com/*',
                    resourceTypes: [
                        chrome.declarativeNetRequest.ResourceType
                            .XMLHTTPREQUEST,
                    ],
                },
            },
        ];

        mockGetDynamicRules.mockImplementation((cb) => cb(rules));

        render(<Popup />);

        await waitFor(() => {
            expect(
                screen.getByText(/X-API-KEY.*secret123/)
            ).toBeInTheDocument();
            expect(
                screen.getByText('*://api.example.com/*')
            ).toBeInTheDocument();
        });
    });

    it('removes rule when remove button is clicked', async () => {
        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 42,
                priority: 1,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType
                        .MODIFY_HEADERS,
                    requestHeaders: [
                        {
                            header: 'X-TEST',
                            operation:
                                chrome.declarativeNetRequest.HeaderOperation
                                    .SET,
                            value: 'value',
                        },
                    ],
                },
                condition: {
                    urlFilter: '|',
                    resourceTypes: [
                        chrome.declarativeNetRequest.ResourceType
                            .XMLHTTPREQUEST,
                    ],
                },
            },
        ];

        mockGetDynamicRules.mockImplementation((cb) => cb(rules));
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText(/X-TEST.*value/)).toBeInTheDocument();
        });

        // Click the remove button
        const removeButton = screen.getByRole('button', { name: '✕' });
        fireEvent.click(removeButton);

        expect(mockUpdateDynamicRules).toHaveBeenCalledWith(
            { removeRuleIds: [42] },
            expect.any(Function)
        );
    });

    it('updates badge indicator on load', async () => {
        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType
                        .MODIFY_HEADERS,
                    requestHeaders: [
                        {
                            header: 'X-TEST',
                            operation:
                                chrome.declarativeNetRequest.HeaderOperation
                                    .SET,
                            value: 'value',
                        },
                    ],
                },
                condition: {
                    urlFilter: '|',
                    resourceTypes: [
                        chrome.declarativeNetRequest.ResourceType
                            .XMLHTTPREQUEST,
                    ],
                },
            },
        ];

        mockGetDynamicRules.mockImplementation((cb) => cb(rules));

        render(<Popup />);

        await waitFor(() => {
            expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '✓' });
            expect(mockSetBadgeTextColor).toHaveBeenCalledWith({
                color: '#ADD8E6',
            });
        });
    });

    it('sets empty badge when no rules', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '' });
        });
    });
});
