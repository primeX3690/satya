import React from 'react';

/**
 * Catches any rendering error anywhere below it in the tree and shows a
 * recoverable message instead of leaving the whole app blank/white.
 * Without this, a single bad piece of data (a malformed API response, a
 * missing field) can crash the entire React tree with no visible feedback.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('SatyaNet crashed:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container" style={{ marginTop: 60, textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p style={{ color: 'var(--muted)' }}>
            This page hit an unexpected error. Reloading usually fixes it.
          </p>
          <button className="btn" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
