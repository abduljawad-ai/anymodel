import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Relay crashed:', error, errorInfo);
  }

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
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload Relay
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
