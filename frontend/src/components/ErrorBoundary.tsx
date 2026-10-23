import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Rendered when the tree throws. Must stay safety-relevant. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors so a single broken component cannot blank the
 * page — which would also remove the Quick Exit control that lets a person
 * in danger leave the site immediately.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Only technical context is logged — never case data or narratives.
    console.error('SafeReport render error:', error.message, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="page" style={{ padding: '40px 20px' }}>
        <div className="card span-12" role="alert">
          <h1 className="page-title">Something went wrong</h1>
          <p className="card-sub">
            The page could not be displayed. Your report was not lost — nothing was sent.
          </p>
          <button className="btn" onClick={this.reset}>Try again</button>
        </div>
      </div>
    );
  }
}
