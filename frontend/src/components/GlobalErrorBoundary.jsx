import React from 'react';
import { HiOutlineExclamation } from 'react-icons/hi';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Global app error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <HiOutlineExclamation className="w-6 h-6 text-red-400" />
              <h2 className="text-lg font-semibold text-red-400">Error cargando la app</h2>
            </div>
            <p className="text-slate-300 mb-4">
              Ocurrió un problema inesperado al renderizar la aplicación.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-950/70 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 mb-4">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
