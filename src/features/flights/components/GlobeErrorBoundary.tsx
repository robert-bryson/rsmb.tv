import { Component, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobeErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Globe rendering error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex items-center justify-center h-full bg-gray-900">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-md mx-4 text-center">
                        <div className="text-4xl mb-4">🌍</div>
                        <h2 className="text-white font-semibold text-lg mb-2">
                            Unable to load the globe
                        </h2>
                        <p className="text-gray-400 text-sm mb-4">
                            There was an error rendering the 3D visualization. This might be due to WebGL
                            compatibility issues or insufficient graphics resources.
                        </p>
                        {this.state.error && (
                            <details className="text-left mb-4">
                                <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-400">
                                    Technical details
                                </summary>
                                <pre className="mt-2 p-2 bg-gray-900 rounded text-red-400 text-xs overflow-auto max-h-24">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
