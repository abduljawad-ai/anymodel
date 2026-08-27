import { Component, type ReactNode } from 'react';
import { logger } from '../../lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Relay crashed', 'ErrorBoundary', { error, errorInfo });
    this.setState({ errorInfo });
  }

  copyErrorDetails = (): void => {
    const { error, errorInfo } = this.state;
    const details = [
      `Error: ${error?.message ?? 'Unknown'}`,
      error?.stack && `\nStack: ${error.stack}`,
      errorInfo?.componentStack && `\nComponent Stack: ${errorInfo.componentStack}`,
      '\nRecent Logs:',
      ...logger.getRecent(10).map((e) => `  ${e.timestamp} [${e.level}] ${e.message}`),
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(details).then(
      () => alert('Error details copied to clipboard'),
      () => console.error('Failed to copy error details'),
    );
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'grid',
          placeItems: 'center',
          height: '100dvh',
          background: 'var(--paper)',
          padding: 24,
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: 400,
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 12,
            padding: 28,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Something went wrong</h2>
            <p style={{ color: 'var(--muted)', margin: '0 0 16px', fontSize: 14 }}>
              Relay encountered an unexpected error. Your data is safe.
            </p>
            <pre style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--err)',
              background: 'var(--paper)',
              padding: 10,
              borderRadius: 6,
              overflow: 'auto',
              maxHeight: 120,
              marginBottom: 16,
              textAlign: 'left',
            }}>
              {this.state.error?.message ?? 'Unknown error'}
            </pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                className="btn"
                onClick={this.copyErrorDetails}
              >
                Copy Error Details
              </button>
              <button
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                Reload Relay
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
