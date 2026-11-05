import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { retryCurrentPage } from '../utils/pageRecovery';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    retryLimited: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, retryLimited: false };

    static getDerivedStateFromError(): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Uncaught error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div role="alert" data-testid="page-error" className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
                    <h1 className="text-2xl font-bold text-zinc-200 mb-2">Something went wrong</h1>
                    <p className="text-zinc-400 mb-4">
                        {this.state.retryLimited
                            ? 'This page is still unavailable. Wait a minute before trying again, or visit another page.'
                            : 'This page could not load. Check your connection and try again.'}
                    </p>
                    <button
                        className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600 transition-colors"
                        onClick={() => { if (!retryCurrentPage()) this.setState({ retryLimited: true }); }}
                    >
                        Try again
                    </button>
                    <Link to="/" className="mt-4 text-violet-400 hover:text-violet-300">Go home</Link>
                </div>
            );
        }

        return this.props.children;
    }
}
