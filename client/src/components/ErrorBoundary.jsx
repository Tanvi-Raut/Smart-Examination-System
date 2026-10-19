import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 rounded-2xl bg-slate-900 border border-red-500/40 text-red-200 text-center space-y-4 my-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white">Display Notice</h3>
                        <p className="text-xs text-red-300">
                            {this.state.error?.message || 'An error occurred while displaying candidate verification.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={this.handleReset}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md inline-flex items-center space-x-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reset View & Continue</span>
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
