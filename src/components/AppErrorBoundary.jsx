import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Keeps a failed lazy-loaded workspace from leaving the authenticated shell
 * blank. It deliberately does not expose implementation details to users.
 */
export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Workspace rendering error:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-error-state" role="alert">
        <div className="app-error-icon"><AlertTriangle size={26} /></div>
        <div>
          <h2>We could not open this workspace</h2>
          <p>Your academic information is safe. Please reload the portal and try again.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
          <RefreshCw size={16} /> Reload portal
        </button>
      </main>
    );
  }
}

export default AppErrorBoundary;
