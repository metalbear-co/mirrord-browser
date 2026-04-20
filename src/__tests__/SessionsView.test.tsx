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
        onOpenManualSetup: jest.fn(),
    };

    test('renders a row per session with target + key', () => {
        render(<SessionsView {...baseProps} sessions={sessions} />);
        expect(screen.getAllByText('Deployment/web').length).toBe(3);
        expect(screen.getByText(/k1/)).toBeInTheDocument();
        expect(screen.getByText(/k2/)).toBeInTheDocument();
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

    test('clicking Manual setup link invokes the handler', () => {
        const onOpenManualSetup = jest.fn();
        render(
            <SessionsView
                {...baseProps}
                sessions={sessions}
                onOpenManualSetup={onOpenManualSetup}
            />
        );
        fireEvent.click(screen.getByText(/manual setup/i));
        expect(onOpenManualSetup).toHaveBeenCalled();
    });
});
