import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// Mock analytics module (must be before popup import since it fires at module level)
jest.mock('../analytics', () => ({
    capture: jest.fn(),
    captureBeacon: jest.fn(),
    optOutReady: Promise.resolve(),
}));

// Mock @metalbear/ui components to avoid ts-jest type resolution issues with VariantProps
jest.mock('@metalbear/ui', () => ({
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
    CardContent: ({ children }: React.PropsWithChildren) => (
        <div>{children}</div>
    ),
    CardFooter: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <div className={className}>{children}</div>
    ),
    Separator: () => <hr />,
    Switch: ({
        checked,
        onCheckedChange,
        disabled,
        'aria-label': ariaLabel,
    }: {
        checked?: boolean;
        onCheckedChange?: (checked: boolean) => void;
        disabled?: boolean;
        'aria-label'?: string;
    }) => (
        <button
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onCheckedChange?.(!checked)}
        />
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

// Mock chrome API
const mockGetDynamicRules = jest.fn();
const mockUpdateDynamicRules = jest.fn();
const mockSetBadgeText = jest.fn();
const mockSetBadgeTextColor = jest.fn();
const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockStorageRemove = jest.fn();

Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
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
        id: 'test-extension-id',
        openOptionsPage: jest.fn(),
    },
    storage: {
        local: {
            get: mockStorageGet,
            set: mockStorageSet,
            remove: mockStorageRemove,
        },
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
        mockStorageGet.mockImplementation((_keys: string[], cb: Function) =>
            cb({})
        );
    });

    it('shows Inactive status when no rules', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('Inactive')).toBeInTheDocument();
        });
    });

    it('shows Active status with rule preview when rules exist', async () => {
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

        mockGetDynamicRules.mockImplementation((cb: Function) => cb(rules));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('Active')).toBeInTheDocument();
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

        mockGetDynamicRules.mockImplementation((cb: Function) => cb(rules));

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

    it('toggles rule off via switch', async () => {
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

        mockGetDynamicRules.mockImplementation((cb: Function) => cb(rules));
        mockUpdateDynamicRules.mockImplementation(
            (_opts: unknown, cb: Function) => cb()
        );

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('X-TEST: value')).toBeInTheDocument();
        });

        const toggle = screen.getByRole('switch');
        fireEvent.click(toggle);

        await waitFor(() => {
            expect(mockUpdateDynamicRules).toHaveBeenCalledWith(
                { removeRuleIds: [42] },
                expect.any(Function)
            );
        });
    });

    it('toggles rule on via switch when config exists', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockStorageGet.mockImplementation((_keys: string[], cb: Function) =>
            cb({
                defaults: {
                    headerName: 'X-Test',
                    headerValue: 'val',
                },
            })
        );
        mockUpdateDynamicRules.mockImplementation(
            (_opts: unknown, cb: Function) => cb()
        );

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('Inactive')).toBeInTheDocument();
        });

        const toggle = screen.getByRole('switch');
        expect(toggle).not.toBeDisabled();
        fireEvent.click(toggle);

        await waitFor(() => {
            expect(mockUpdateDynamicRules).toHaveBeenCalled();
        });
    });

    it('switch is disabled when inactive and no stored config', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockStorageGet.mockImplementation((_keys: string[], cb: Function) =>
            cb({})
        );

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('Inactive')).toBeInTheDocument();
        });

        const toggle = screen.getByRole('switch');
        expect(toggle).toBeDisabled();
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

        mockGetDynamicRules.mockImplementation((cb: Function) => cb(rules));

        render(<Popup />);

        await waitFor(() => {
            expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '✓' });
            expect(mockSetBadgeTextColor).toHaveBeenCalledWith({
                color: '#ADD8E6',
            });
        });
    });

    it('sets empty badge when no rules', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '' });
        });
    });

    it('renders the configure header form', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
            expect(screen.getByLabelText('Header Value')).toBeInTheDocument();
            expect(screen.getByLabelText('URL Scope')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Save' })
            ).toBeInTheDocument();
        });
    });

    it('loads stored config into form fields', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockStorageGet.mockImplementation((_keys: string[], cb: Function) =>
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
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockStorageGet.mockImplementation((_keys: string[], cb: Function) =>
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
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockStorageGet.mockImplementation((_keys: string[], cb: Function) =>
            cb({})
        );

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

        expect(
            screen.queryByRole('button', { name: 'Reset to Default' })
        ).not.toBeInTheDocument();
    });

    it('saves header when save button is clicked', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockUpdateDynamicRules.mockImplementation(
            (_opts: unknown, cb: Function) => cb()
        );
        mockStorageSet.mockImplementation((_data: unknown, cb: Function) =>
            cb()
        );

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('Header Name'), {
            target: { value: 'X-NEW-HEADER' },
        });
        fireEvent.change(screen.getByLabelText('Header Value'), {
            target: { value: 'newvalue' },
        });

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
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockStorageGet.mockImplementation((_keys: string[], cb: Function) =>
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
        mockStorageRemove.mockImplementation((_keys: string[], cb: Function) =>
            cb()
        );
        mockUpdateDynamicRules.mockImplementation(
            (_opts: unknown, cb: Function) => cb()
        );

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

    it('shows inline error when saving with empty header name', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('Header Value'), {
            target: { value: 'somevalue' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            const errorEl = screen.getByRole('alert');
            expect(errorEl).toHaveTextContent(
                'Header name and value are required'
            );
        });
    });

    it('shows inline error when saving with empty header value', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('Header Name'), {
            target: { value: 'X-Test' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            const errorEl = screen.getByRole('alert');
            expect(errorEl).toHaveTextContent(
                'Header name and value are required'
            );
        });
    });

    it('saves header with URL scope', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockUpdateDynamicRules.mockImplementation(
            (_opts: unknown, cb: Function) => cb()
        );
        mockStorageSet.mockImplementation((_data: unknown, cb: Function) =>
            cb()
        );

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

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
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockUpdateDynamicRules.mockImplementation(
            (_opts: unknown, cb: Function) => cb()
        );
        mockStorageSet.mockImplementation((_data: unknown, cb: Function) =>
            cb()
        );

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
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockStorageGet.mockImplementation((_keys: string[], cb: Function) =>
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
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('mirrord')).toBeInTheDocument();
            expect(screen.getByText('Header Injector')).toBeInTheDocument();
        });
    });

    it('renders tooltip info icon', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByText('Inactive')).toBeInTheDocument();
        });

        const infoIcons = screen.getAllByText('ⓘ');
        expect(infoIcons.length).toBeGreaterThan(0);
    });

    it('renders share button', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));

        render(<Popup />);

        await waitFor(() => {
            expect(
                screen.getByLabelText('Share configuration')
            ).toBeInTheDocument();
        });
    });

    it('share button is disabled when form is empty', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockStorageGet.mockImplementation((_keys: string[], cb: Function) =>
            cb({})
        );

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        });

        const shareBtn = screen.getByLabelText('Share configuration');
        expect(shareBtn).toBeDisabled();
    });

    it('share button is enabled when form has values', async () => {
        mockGetDynamicRules.mockImplementation((cb: Function) => cb([]));
        mockStorageGet.mockImplementation((_keys: string[], cb: Function) =>
            cb({
                defaults: {
                    headerName: 'X-Test',
                    headerValue: 'value',
                },
            })
        );

        render(<Popup />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('X-Test')).toBeInTheDocument();
        });

        const shareBtn = screen.getByLabelText('Share configuration');
        expect(shareBtn).not.toBeDisabled();
    });
});
