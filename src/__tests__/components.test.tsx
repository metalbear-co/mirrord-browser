import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// Mock @metalbear/ui components
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
    Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
    TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
    TooltipContent: ({ children }: React.PropsWithChildren) => (
        <span>{children}</span>
    ),
}));

import { RuleItem } from '../components/RuleItem';
import { RulesList } from '../components/RulesList';
import { HeaderForm } from '../components/HeaderForm';
import { HeaderRule } from '../types';

describe('RuleItem', () => {
    const mockRule: HeaderRule = {
        id: 1,
        header: 'X-Test-Header',
        value: 'test-value',
        scope: 'All URLs',
    };

    it('renders header and value with colon separator', () => {
        render(<RuleItem rule={mockRule} />);

        expect(
            screen.getByText('X-Test-Header: test-value')
        ).toBeInTheDocument();
    });

    it('renders the scope', () => {
        render(<RuleItem rule={mockRule} />);

        expect(screen.getByText('All URLs')).toBeInTheDocument();
    });

    it('renders custom scope correctly', () => {
        const scopedRule: HeaderRule = {
            ...mockRule,
            scope: '*://api.example.com/*',
        };
        render(<RuleItem rule={scopedRule} />);

        expect(screen.getByText('*://api.example.com/*')).toBeInTheDocument();
    });
});

describe('RulesList', () => {
    const mockRules: HeaderRule[] = [
        { id: 1, header: 'X-Header-1', value: 'value1', scope: 'All URLs' },
        {
            id: 2,
            header: 'X-Header-2',
            value: 'value2',
            scope: '*://test.com/*',
        },
    ];

    it('renders empty state when no rules', () => {
        render(<RulesList rules={[]} />);

        expect(screen.getByText('No active headers')).toBeInTheDocument();
    });

    it('renders all rules', () => {
        render(<RulesList rules={mockRules} />);

        expect(screen.getByText('X-Header-1: value1')).toBeInTheDocument();
        expect(screen.getByText('X-Header-2: value2')).toBeInTheDocument();
    });
});

describe('HeaderForm', () => {
    const defaultProps = {
        headerName: '',
        headerValue: '',
        scope: '',
        onHeaderNameChange: jest.fn(),
        onHeaderValueChange: jest.fn(),
        onScopeChange: jest.fn(),
    };

    it('renders all form fields', () => {
        render(<HeaderForm {...defaultProps} />);

        expect(screen.getByLabelText('Header Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Header Value')).toBeInTheDocument();
        expect(screen.getByLabelText('URL Scope')).toBeInTheDocument();
    });

    it('renders with initial values', () => {
        render(
            <HeaderForm
                {...defaultProps}
                headerName="X-Initial"
                headerValue="initial-value"
                scope="*://example.com/*"
            />
        );

        expect(screen.getByDisplayValue('X-Initial')).toBeInTheDocument();
        expect(screen.getByDisplayValue('initial-value')).toBeInTheDocument();
        expect(
            screen.getByDisplayValue('*://example.com/*')
        ).toBeInTheDocument();
    });

    it('calls onHeaderNameChange when header name input changes', () => {
        const mockOnChange = jest.fn();
        render(
            <HeaderForm {...defaultProps} onHeaderNameChange={mockOnChange} />
        );

        fireEvent.change(screen.getByLabelText('Header Name'), {
            target: { value: 'X-New-Header' },
        });

        expect(mockOnChange).toHaveBeenCalledWith('X-New-Header');
    });

    it('calls onHeaderValueChange when header value input changes', () => {
        const mockOnChange = jest.fn();
        render(
            <HeaderForm {...defaultProps} onHeaderValueChange={mockOnChange} />
        );

        fireEvent.change(screen.getByLabelText('Header Value'), {
            target: { value: 'new-value' },
        });

        expect(mockOnChange).toHaveBeenCalledWith('new-value');
    });

    it('calls onScopeChange when scope input changes', () => {
        const mockOnChange = jest.fn();
        render(<HeaderForm {...defaultProps} onScopeChange={mockOnChange} />);

        fireEvent.change(screen.getByLabelText('URL Scope'), {
            target: { value: '*://api.test.com/*' },
        });

        expect(mockOnChange).toHaveBeenCalledWith('*://api.test.com/*');
    });

    it('renders placeholder text for inputs', () => {
        render(<HeaderForm {...defaultProps} />);

        expect(
            screen.getByPlaceholderText('X-MIRRORD-USER')
        ).toBeInTheDocument();
        expect(screen.getByPlaceholderText('testuser')).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText('Leave empty for all URLs')
        ).toBeInTheDocument();
    });

    it('renders tooltip trigger for URL Scope', () => {
        render(<HeaderForm {...defaultProps} />);

        // The tooltip trigger is the ⓘ icon
        expect(screen.getByText('ⓘ')).toBeInTheDocument();
    });
});
