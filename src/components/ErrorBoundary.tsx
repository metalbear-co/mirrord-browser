import type { ReactNode } from 'react';
import { ErrorBoundary as KitErrorBoundary } from '@metalbear/ui';
import { emitUserBlocked } from '../analytics';

type Flow = 'session_monitor' | 'header_injector' | 'configure';

interface Props {
    flow: Flow;
    component: string;
    children: ReactNode;
}

const MAX_STACK_LENGTH = 500;

export function ErrorBoundary({ flow, component, children }: Props) {
    return (
        <KitErrorBoundary
            fallback={
                <div style={{ padding: 16, fontFamily: 'system-ui' }}>
                    <h3>Something went wrong.</h3>
                    <p>Please reload the extension.</p>
                </div>
            }
            onError={(error, info) => {
                emitUserBlocked('ui_crashed', 'user_action', {
                    error: error.message,
                    component,
                    flow,
                    stack: info.componentStack?.slice(0, MAX_STACK_LENGTH),
                });
            }}
        >
            {children}
        </KitErrorBoundary>
    );
}
