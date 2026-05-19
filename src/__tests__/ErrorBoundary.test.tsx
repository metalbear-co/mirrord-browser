import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { emitUserBlocked } from '../analytics';

jest.mock('../analytics', () => ({
    emitUserBlocked: jest.fn(),
    emitUserSucceeded: jest.fn(),
}));

function Bomb(): React.JSX.Element {
    throw new Error('kaboom');
}

beforeEach(() => {
    (emitUserBlocked as jest.Mock).mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    (console.error as jest.Mock).mockRestore();
});

describe('ErrorBoundary', () => {
    it('emits ui_crashed when a child throws', () => {
        render(
            <ErrorBoundary flow="session_monitor" component="popup">
                <Bomb />
            </ErrorBoundary>
        );
        expect(emitUserBlocked).toHaveBeenCalledWith(
            'ui_crashed',
            'user_action',
            expect.objectContaining({
                error: 'kaboom',
                component: 'popup',
                flow: 'session_monitor',
            })
        );
    });

    it('renders fallback UI after crash', () => {
        const { getByText } = render(
            <ErrorBoundary flow="header_injector" component="popup">
                <Bomb />
            </ErrorBoundary>
        );
        expect(getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('renders children when no error', () => {
        const { getByText } = render(
            <ErrorBoundary flow="configure" component="configure">
                <div>healthy content</div>
            </ErrorBoundary>
        );
        expect(getByText('healthy content')).toBeInTheDocument();
    });
});
