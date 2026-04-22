/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import type { OperatorSessionSummary, OperatorWatchStatus } from '../types';

jest.mock('@metalbear/ui', () => ({
    Card: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <div className={className}>{children}</div>
    ),
    CardContent: ({
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
    Button: ({
        children,
        onClick,
        className,
        'aria-label': ariaLabel,
    }: React.PropsWithChildren<{
        onClick?: () => void;
        className?: string;
        'aria-label'?: string;
    }>) => (
        <button onClick={onClick} className={className} aria-label={ariaLabel}>
            {children}
        </button>
    ),
    Label: ({
        children,
        htmlFor,
    }: React.PropsWithChildren<{ htmlFor?: string }>) => (
        <label htmlFor={htmlFor}>{children}</label>
    ),
    Select: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SelectTrigger: ({ children }: React.PropsWithChildren) => (
        <button>{children}</button>
    ),
    SelectValue: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SelectItem: ({
        children,
        value,
    }: React.PropsWithChildren<{ value?: string }>) => (
        <div data-value={value}>{children}</div>
    ),
}));

import SessionsView from '../components/SessionsView';

const s = (
    name: string,
    key: string | null,
    namespace = 'ns',
    createdAt: string | null = null
): OperatorSessionSummary => ({
    name,
    key,
    namespace,
    owner: { username: 'alice', k8sUsername: 'alice@ex' },
    target: { kind: 'Deployment', name: 'web', container: 'app' },
    createdAt,
});

describe('SessionsView', () => {
    const sessions = [
        s('a', 'k1', 'ns-a'),
        s('b', 'k2', 'ns-b'),
        s('c', null, 'ns-a'),
    ];

    const baseProps = {
        namespaces: ['', 'ns-a', 'ns-b'],
        namespace: '',
        setNamespace: jest.fn(),
        joinState: {
            joinedKey: null,
            joinedSessionName: null,
            sessionEnded: false,
        },
        status: { status: 'watching' } as OperatorWatchStatus,
        onJoin: jest.fn(),
        onClear: jest.fn(),
        onShare: jest.fn(),
    };

    test('renders one group per key, omitting keyless sessions', () => {
        render(<SessionsView {...baseProps} sessions={sessions} />);
        expect(screen.getByText('k1')).toBeInTheDocument();
        expect(screen.getByText('k2')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /join \(no key\)/i })
        ).toBeNull();
    });

    test('clicking Join on a row calls onJoin with that session key', () => {
        const onJoin = jest.fn();
        render(
            <SessionsView {...baseProps} sessions={sessions} onJoin={onJoin} />
        );
        fireEvent.click(screen.getByRole('button', { name: /join k1/i }));
        expect(onJoin).toHaveBeenCalledWith('k1');
    });

    test('shows a connected banner when a session is joined', () => {
        render(
            <SessionsView
                {...baseProps}
                sessions={sessions}
                joinState={{
                    joinedKey: 'k1',
                    joinedSessionName: 'a',
                    sessionEnded: false,
                }}
            />
        );
        expect(screen.getByText(/currently connected/i)).toBeInTheDocument();
        expect(screen.getByText(/session live/i)).toBeInTheDocument();
    });

    test('shows session-ended banner when joined session was removed', () => {
        render(
            <SessionsView
                {...baseProps}
                sessions={sessions}
                joinState={{
                    joinedKey: 'k1',
                    joinedSessionName: 'a',
                    sessionEnded: true,
                }}
            />
        );
        expect(screen.getByText(/session ended/i)).toBeInTheDocument();
    });

    test('renders "no sessions visible" when list is empty', () => {
        render(<SessionsView {...baseProps} sessions={[]} />);
        expect(screen.getByText(/no sessions visible/i)).toBeInTheDocument();
    });
});
