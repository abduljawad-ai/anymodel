import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { useVaultStore } from '../../vault/vaultStore';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ info });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetVault = () => {
    if (!window.confirm('This will wipe all stored API keys. Continue?')) return;
    useVaultStore.getState().lock();
    localStorage.removeItem('relay.vault.v1');
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const { error, info } = this.state;

    return (
      <div className="error-boundary">
        <div className="error-card">
          <AlertTriangle size={32} aria-hidden />
          <h2>Something went wrong</h2>
          <p className="error-message">{error.message || 'An unexpected error occurred.'}</p>

          {(error.stack || info?.componentStack) && (
            <details className="error-stack">
              <summary>Stack trace</summary>
              <pre>
                {error.stack}
                {info?.componentStack && (
                  <>
                    {'\n\nComponent stack:'}
                    {info.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}

          <div className="error-actions">
            <button className="btn" onClick={this.handleReload} type="button">
              <RefreshCw size={14} aria-hidden />
              Reload
            </button>
            <button className="btn btn-danger" onClick={this.handleResetVault} type="button">
              <Trash2 size={14} aria-hidden />
              Reset vault
            </button>
          </div>
        </div>
      </div>
    );
  }
}
