import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a render crash on any screen shows a recovery card
 * instead of a blank page, with a way back to Settings (where most fixable
 * problems live) and a reload.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="card space-y-3">
          <h1 className="text-lg font-bold">Something went wrong</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The app hit an error while drawing this screen. Your data is safe in this browser.
          </p>
          <pre className="overflow-auto rounded-xl bg-gray-100 p-2 text-xs dark:bg-gray-800">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2">
            <a
              href="#/settings"
              className="btn btn-secondary flex-1"
              onClick={() => this.setState({ error: null })}
            >
              Open Settings
            </a>
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
