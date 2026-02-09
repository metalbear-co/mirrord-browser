import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

const mockCapture = jest.fn();

// Mock posthog-js/react
jest.mock('posthog-js/react', () => ({
    usePostHog: () => ({
        capture: mockCapture,
    }),
}));

// Mock @metalbear/ui components to avoid ts-jest type resolution issues with VariantProps
jest.mock('@metalbear/ui', () => ({
    Badge: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <span className={className}>{children}</span>
    ),
    Button: ({
        children,
        onClick,
        className,
        disabled,
    }: React.PropsWithChildren<{
        onClick?: () => void;
        className?: string;
        disabled?: boolean;
    }>) => (
        <button onClick={onClick} className={className} disabled={disabled}>
            {children}
        </button>
    ),
    Card: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <div className={className}>{children}</div>
    ),
    CardHeader: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <div className={className}>{children}</div>
    ),
    CardTitle: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <h2 className={className}>{children}</h2>
    ),
    CardDescription: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <p className={className}>{children}</p>
    ),
    CardContent: ({ children }: React.PropsWithChildren) => (
        <div>{children}</div>
    ),
    CardFooter: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <div className={className}>{children}</div>
    ),
    Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
    TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
    TooltipContent: ({ children }: React.PropsWithChildren) => (
        <span>{children}</span>
    ),
    TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Input: ({
        id,
        value,
        onChange,
        placeholder,
    }: {
        id?: string;
        value?: string;
        onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
        placeholder?: string;
    }) => (
        <input
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
        />
    ),
    Label: ({
        children,
        htmlFor,
    }: React.PropsWithChildren<{ htmlFor?: string }>) => (
        <label htmlFor={htmlFor}>{children}</label>
    ),
}));

import {
    setupChromeMock,
    resetChromeMock,
    mockGetDynamicRules,
    mockUpdateDynamicRules,
    mockSetBadgeText,
    mockSetBadgeTextColor,
    mockStorageGet,
    mockStorageSet,
    mockStorageRemove,
} from './setup/chromeMock';

setupChromeMock();

// Import after mocks are set up
import { Popup } from '../popup';

describe('Popup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCapture.mockClear();
        resetChromeMock();
        mockStorageGet.mockImplementation((_keys, cb) => cb({}));
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
                screen.getByText('X-MIRRORD-USER: testuser')
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
                screen.getByText('X-API-KEY: secret123')
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
            expect(screen.getByText('X-TEST: value')).toBeInTheDocument();
        });

        // Click the remove button
        const removeButton = screen.getByRole('button', { name: 'Remove' });
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

    it('renders the configure header form', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('Configure Header')).toBeInTheDocument();
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
            expect(screen.getByLabelText('Header Value')).toBeInTheDocument();
            expect(screen.getByLabelText('URL Scope')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Save' })
            ).toBeInTheDocument();
        });
    });

    it('loads stored config into form fields', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockStorageGet.mockImplementation((_keys, cb) =>
            cb({
                defaults: {
                    headerName: 'X-STORED',
                    headerValue: 'storedvalue',
                    scope: '*://example.com/*',
                },
            })
        );

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('X-STORED')).toBeInTheDocument();
            expect(screen.getByDisplayValue('storedvalue')).toBeInTheDocument();
            expect(
                screen.getByDisplayValue('*://example.com/*')
            ).toBeInTheDocument();
        });
    });

    it('shows reset button when defaults exist', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockStorageGet.mockImplementation((_keys, cb) =>
            cb({
                defaults: {
                    headerName: 'X-DEFAULT',
                    headerValue: 'defaultval',
                },
            })
        );

        render(<Popup />);

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Reset to Default' })
            ).toBeInTheDocument();
        });
    });

    it('hides reset button when no defaults exist', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockStorageGet.mockImplementation((_keys, cb) => cb({}));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('Configure Header')).toBeInTheDocument();
        });

        expect(
            screen.queryByRole('button', { name: 'Reset to Default' })
        ).not.toBeInTheDocument();
    });

    it('saves header when save button is clicked', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
        mockStorageSet.mockImplementation((_data, cb) => cb());

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

        // Fill in the form
        fireEvent.change(screen.getByLabelText('Header Name'), {
            target: { value: 'X-NEW-HEADER' },
        });
        fireEvent.change(screen.getByLabelText('Header Value'), {
            target: { value: 'newvalue' },
        });

        // Click save
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(mockUpdateDynamicRules).toHaveBeenCalledWith(
                expect.objectContaining({
                    addRules: expect.arrayContaining([
                        expect.objectContaining({
                            action: expect.objectContaining({
                                requestHeaders: [
                                    expect.objectContaining({
                                        header: 'X-NEW-HEADER',
                                        value: 'newvalue',
                                    }),
                                ],
                            }),
                        }),
                    ]),
                }),
                expect.any(Function)
            );
        });
    });

    it('resets to defaults when reset button is clicked', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockStorageGet.mockImplementation((_keys, cb) =>
            cb({
                defaults: {
                    headerName: 'X-DEFAULT',
                    headerValue: 'defaultval',
                    scope: '*://default.com/*',
                },
                override: {
                    headerName: 'X-OVERRIDE',
                    headerValue: 'overrideval',
                },
            })
        );
        mockStorageRemove.mockImplementation((_keys, cb) => cb());
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());

        render(<Popup />);

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Reset to Default' })
            ).toBeInTheDocument();
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Reset to Default' })
        );

        await waitFor(() => {
            expect(mockStorageRemove).toHaveBeenCalledWith(
                ['override'],
                expect.any(Function)
            );
        });
    });

    it('displays Active badge when rules exist', async () => {
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
                condition: { urlFilter: '|' },
            },
        ];

        mockGetDynamicRules.mockImplementation((cb) => cb(rules));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('Active')).toBeInTheDocument();
        });
    });

    it('displays Inactive badge when no rules exist', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('Inactive')).toBeInTheDocument();
        });
    });

    it('shows alert when saving with empty header name', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        const mockAlert = jest.spyOn(window, 'alert').mockImplementation();

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

        // Leave header name empty, fill only value
        fireEvent.change(screen.getByLabelText('Header Value'), {
            target: { value: 'somevalue' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(mockAlert).toHaveBeenCalledWith(
            'Header name and value are required'
        );

        mockAlert.mockRestore();
    });

    it('shows alert when saving with empty header value', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        const mockAlert = jest.spyOn(window, 'alert').mockImplementation();

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

        // Fill header name, leave value empty
        fireEvent.change(screen.getByLabelText('Header Name'), {
            target: { value: 'X-Test' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(mockAlert).toHaveBeenCalledWith(
            'Header name and value are required'
        );

        mockAlert.mockRestore();
    });

    it('saves header with URL scope', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
        mockStorageSet.mockImplementation((_data, cb) => cb());

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

        // Fill in the form with scope
        fireEvent.change(screen.getByLabelText('Header Name'), {
            target: { value: 'X-Scoped' },
        });
        fireEvent.change(screen.getByLabelText('Header Value'), {
            target: { value: 'scopedvalue' },
        });
        fireEvent.change(screen.getByLabelText('URL Scope'), {
            target: { value: '*://api.test.com/*' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(mockUpdateDynamicRules).toHaveBeenCalledWith(
                expect.objectContaining({
                    addRules: expect.arrayContaining([
                        expect.objectContaining({
                            condition: expect.objectContaining({
                                urlFilter: '*://api.test.com/*',
                            }),
                        }),
                    ]),
                }),
                expect.any(Function)
            );
        });
    });

    it('stores override config when saving', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockUpdateDynamicRules.mockImplementation((_opts, cb) => cb());
        mockStorageSet.mockImplementation((_data, cb) => cb());

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('Header Name'), {
            target: { value: 'X-Override' },
        });
        fireEvent.change(screen.getByLabelText('Header Value'), {
            target: { value: 'overridevalue' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(mockStorageSet).toHaveBeenCalledWith(
                {
                    override: {
                        headerName: 'X-Override',
                        headerValue: 'overridevalue',
                        scope: undefined,
                    },
                },
                expect.any(Function)
            );
        });
    });

    it('prefers override config over defaults when loading', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));
        mockStorageGet.mockImplementation((_keys, cb) =>
            cb({
                defaults: {
                    headerName: 'X-DEFAULT',
                    headerValue: 'defaultval',
                },
                override: {
                    headerName: 'X-OVERRIDE',
                    headerValue: 'overrideval',
                },
            })
        );

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('X-OVERRIDE')).toBeInTheDocument();
            expect(screen.getByDisplayValue('overrideval')).toBeInTheDocument();
        });
    });

    it('renders mirrord branding header', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('mirrord')).toBeInTheDocument();
            expect(screen.getByText('Header Injector')).toBeInTheDocument();
        });
    });

    it('renders tooltip info icon next to Active Header', async () => {
        mockGetDynamicRules.mockImplementation((cb) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('Active Header')).toBeInTheDocument();
        });

        // There should be tooltip icons (ⓘ) in the UI
        const infoIcons = screen.getAllByText('ⓘ');
        expect(infoIcons.length).toBeGreaterThan(0);
    });

    describe('PostHog analytics', () => {
        it('captures extension_popup_opened on mount', async () => {
            mockGetDynamicRules.mockImplementation((cb) => cb([]));

            render(<Popup />);

            await waitFor(() => {
                expect(mockCapture).toHaveBeenCalledWith(
                    'extension_popup_opened'
                );
            });
        });

        it('calls capture exactly once on mount', async () => {
            mockGetDynamicRules.mockImplementation((cb) => cb([]));

            render(<Popup />);

            await waitFor(() => {
                expect(mockCapture).toHaveBeenCalledTimes(1);
            });
        });
    });
});
