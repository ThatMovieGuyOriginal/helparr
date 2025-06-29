// components/ErrorBoundary.jsx

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 ERROR BOUNDARY CAUGHT:', error);
    console.error('🚨 ERROR INFO:', errorInfo);
    console.error('🚨 COMPONENT STACK:', errorInfo.componentStack);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-red-400 mb-6">🚨 Application Error Caught</h1>
            
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-red-300 mb-4">Error Details</h2>
              <div className="space-y-3">
                <div>
                  <strong className="text-red-200">Error:</strong>
                  <div className="bg-slate-800 p-3 rounded mt-1 font-mono text-sm">
                    {this.state.error && this.state.error.toString()}
                  </div>
                </div>
                
                <div>
                  <strong className="text-red-200">Stack Trace:</strong>
                  <div className="bg-slate-800 p-3 rounded mt-1 font-mono text-xs overflow-auto max-h-40">
                    {this.state.error && this.state.error.stack}
                  </div>
                </div>
                
                <div>
                  <strong className="text-red-200">Component Stack:</strong>
                  <div className="bg-slate-800 p-3 rounded mt-1 font-mono text-xs overflow-auto max-h-40">
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-blue-300 mb-4">🔍 Diagnosis</h2>
              <div className="text-blue-200 space-y-2">
                {this.state.error?.message?.includes('join is not a function') ? (
                  <>
                    <div>✅ <strong>Confirmed:</strong> This is the "t.join is not a function" error</div>
                    <div>📍 <strong>Location:</strong> Error is happening during component render</div>
                    <div>🎯 <strong>Cause:</strong> Some data contains arrays where strings are expected</div>
                    <div>🔧 <strong>Fix needed:</strong> Check the component stack above to see which component is failing</div>
                  </>
                ) : (
                  <div>❓ <strong>Different error:</strong> This may not be the known_for issue</div>
                )}
              </div>
            </div>

            <div className="bg-slate-700 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">🛠️ Quick Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded mr-3"
                >
                  Clear All Data & Reload
                </button>
                
                <button
                  onClick={() => {
                    console.clear();
                    this.setState({ hasError: false, error: null, errorInfo: null });
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded mr-3"
                >
                  Try Again
                </button>

                <button
                  onClick={() => {
                    console.log('🚨 FULL ERROR DETAILS:', {
                      error: this.state.error,
                      errorInfo: this.state.errorInfo,
                      timestamp: new Date().toISOString(),
                      userAgent: navigator.userAgent,
                      url: window.location.href
                    });
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                >
                  Log Full Details to Console
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
