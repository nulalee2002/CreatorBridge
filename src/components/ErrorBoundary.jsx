import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const { dark, fallbackMessage } = this.props;
      return (
        <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${dark ? 'bg-charcoal-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
          <div className="w-14 h-14 rounded-2xl bg-gold-500/15 ring-1 ring-gold-500/25 flex items-center justify-center text-2xl mb-4">
            !
          </div>
          <h2 className="font-display text-xl font-bold mb-2">
            {fallbackMessage || 'Something went wrong'}
          </h2>
          <p className={`text-sm mb-4 text-center max-w-sm ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
            {this.state.error?.message || 'An unexpected error occurred loading this page.'}
          </p>
          <button
            type="button"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-5 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 font-bold text-sm transition-all"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
