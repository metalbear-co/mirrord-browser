/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import type { OperatorSessionSummary, OperatorWatchStatus } from '../types';

// Mock @metalbear/ui components to avoid ts-jest type resolution issues.
jest.mock('@metalbear/ui', () => ({
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
    CardContent: ({
        children,
        className,
    }: React.PropsWithChildren<{ className?: string }>) => (
        <div className={className}>{children}</div>
    ),
    Separator: () => <hr />,
}));

import SessionsView from '../components/SessionsView';

const s = (
    name: string,
    key: string | null,
    namespace = 'ns'
): OperatorSessionSummary => ({
    name,
    key,
    namespace,
    owner: { username: 'alice', k8sUsername: 'alice@ex' },
    target: { kind: 'Deployment', name: 'web', container: 'app' },
    createdAt: null,
});

describe('SessionsView', () => {
    const grouped = {
        k1: [s('a', 'k1'), s('b', 'k1', 'ns-b')],
        '': [s('u', null)],
    };

    const baseProps = {
        namespaces: ['', 'ns', 'ns-b'],
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

    test('renders a row per key group with count', () => {
        render(<SessionsView {...baseProps} grouped={grouped} />);
        expect(screen.getByText('k1')).toBeInTheDocument();
        expect(screen.getByText('(ungrouped)')).toBeInTheDocument();
        expect(screen.getByText('2 sessions')).toBeInTheDocument();
    });

    test('clicking a key calls onJoin(key)', () => {
        const onJoin = jest.fn();
        render(
            <SessionsView {...baseProps} grouped={grouped} onJoin={onJoin} />
        );
        fireEvent.click(screen.getByRole('button', { name: /join k1/i }));
        expect(onJoin).toHaveBeenCalledWith('k1');
    });

    test('renders session-ended banner when sessionEnded is true', () => {
        render(
            <SessionsView
                {...baseProps}
                grouped={{}}
                joinState={{
                    joinedKey: 'k1',
                    joinedSessionName: 'a',
                    sessionEnded: true,
                }}
            />
        );
        expect(screen.getByText(/session ended/i)).toBeInTheDocument();
    });

    test('renders "no sessions visible" when grouped is empty and status is watching', () => {
        render(<SessionsView {...baseProps} grouped={{}} />);
        expect(screen.getByText(/no sessions visible/i)).toBeInTheDocument();
    });
});
