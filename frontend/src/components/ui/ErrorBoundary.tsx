import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  handleReload = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl glass shadow-card ring-1 ring-slate-200/70 dark:ring-white/10 p-6 text-center">
          <div className="w-11 h-11 mx-auto rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.72-3L13.86 4a2 2 0 00-3.72 0L3.21 16a2 2 0 001.72 3z"
              />
            </svg>
          </div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-snug">
            The page hit an unexpected error and had to stop. Reloading usually
            fixes it. If it keeps happening, sign out and back in.
          </p>
          <pre className="mt-3 text-[10px] text-left text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-white/5 rounded-lg p-2 overflow-x-auto max-h-32">
            {this.state.error.message}
          </pre>
          <button
            onClick={this.handleReload}
            className="mt-4 w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2 shadow-md shadow-indigo-500/20"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
