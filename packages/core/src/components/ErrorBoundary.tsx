import { Component, ErrorInfo, ReactNode } from 'react';
import { emitUserBlocked } from '../analytics';

type Flow = 'session_monitor' | 'header_injector' | 'configure';

type Props = {
    flow: Flow;
    component: string;
    children: ReactNode;
};

type State = { crashed: boolean };

export class ErrorBoundary extends Component<Props, State> {
    state: State = { crashed: false };

    static getDerivedStateFromError(): State {
        return { crashed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        emitUserBlocked('ui_crashed', 'user_action', {
            error: error.message,
            component: this.props.component,
            flow: this.props.flow,
            stack: info.componentStack?.slice(0, 500),
        });
    }

    render(): ReactNode {
        if (this.state.crashed) {
            return (
                <div style={{ padding: 16, fontFamily: 'system-ui' }}>
                    <h3>Something went wrong.</h3>
                    <p>Please reload the extension.</p>
                </div>
            );
        }
        return this.props.children;
    }
}
