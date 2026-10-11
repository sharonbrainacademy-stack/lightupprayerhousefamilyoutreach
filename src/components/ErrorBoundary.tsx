import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React application:', error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d1322] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#182238] border border-amber-500/30 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Something went wrong</h2>
              <p className="text-gray-300 text-sm">
                The application encountered an issue while loading. Please try refreshing the page.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="p-3 bg-[#0d1322] border border-gray-800 rounded-xl text-left overflow-x-auto text-xs font-mono text-red-300 max-h-32">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full inline-flex items-center justify-center space-x-2 px-6 py-3 bg-[#F26522] hover:bg-[#d9561a] text-white font-bold rounded-xl text-sm transition-colors cursor-pointer shadow-lg"
            >
              <RefreshCw size={16} />
              <span>Refresh Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
