/**
 * GENESIS - Connection Status Component
 * Muestra el estado de conexión y sincronización
 */

import { useState, useEffect } from 'react';
import { 
  HiOutlineWifi, 
  HiOutlineStatusOffline, 
  HiOutlineRefresh,
  HiOutlineCloudUpload,
  HiOutlineCheck,
  HiOutlineExclamation
} from 'react-icons/hi';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';

export default function ConnectionStatus({ compact = false }) {
  const { isOnline } = useAuth();
  const { syncStatus, pendingCount, lastSync, syncAll, syncProgress } = useSync();
  const [showDetails, setShowDetails] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Mostrar notificación cuando cambia el estado de conexión
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowToast(true);
    } else if (wasOffline && isOnline) {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      setWasOffline(false);
    }
  }, [isOnline, wasOffline]);

  // Ocultar toast de offline después de un tiempo
  useEffect(() => {
    if (!isOnline) {
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  const getStatusIcon = () => {
    if (!isOnline) {
      return <HiOutlineStatusOffline className="w-5 h-5 text-red-400" />;
    }
    if (syncStatus === 'syncing') {
      return <HiOutlineRefresh className="w-5 h-5 text-blue-400 animate-spin" />;
    }
    if (pendingCount > 0) {
      return <HiOutlineCloudUpload className="w-5 h-5 text-yellow-400" />;
    }
    return <HiOutlineWifi className="w-5 h-5 text-green-400" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Sin conexión';
    if (syncStatus === 'syncing') return 'Sincronizando...';
    if (pendingCount > 0) return `${pendingCount} pendientes`;
    return 'Conectado';
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500/10 border-red-500/30 text-red-400';
    if (syncStatus === 'syncing') return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    if (pendingCount > 0) return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    return 'bg-green-500/10 border-green-500/30 text-green-400';
  };

  // Versión compacta para header
  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${getStatusColor()}`}
          title={getStatusText()}
        >
          {getStatusIcon()}
          {pendingCount > 0 && (
            <span className="text-xs font-medium">{pendingCount}</span>
          )}
        </button>

        {/* Panel de detalles */}
        {showDetails && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-white">Estado de Conexión</h3>
                <button onClick={() => setShowDetails(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>

              {/* Estado actual */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${getStatusColor()}`}>
                {getStatusIcon()}
                <div>
                  <p className="font-medium">{getStatusText()}</p>
                  {lastSync && (
                    <p className="text-xs opacity-70">
                      Última sync: {new Date(lastSync).toLocaleTimeString('es-MX')}
                    </p>
                  )}
                </div>
              </div>

              {/* Progreso de sincronización */}
              {syncStatus === 'syncing' && syncProgress.total > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Sincronizando...</span>
                    <span>{syncProgress.current}/{syncProgress.total}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Pendientes */}
              {pendingCount > 0 && syncStatus !== 'syncing' && (
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <HiOutlineExclamation className="w-4 h-4" />
                    <span className="text-sm">{pendingCount} operaciones pendientes</span>
                  </div>
                  {isOnline && (
                    <button
                      onClick={() => syncAll()}
                      className="mt-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      Sincronizar ahora
                    </button>
                  )}
                </div>
              )}

              {/* Todo sincronizado */}
              {pendingCount === 0 && isOnline && syncStatus !== 'syncing' && (
                <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-green-400">
                    <HiOutlineCheck className="w-4 h-4" />
                    <span className="text-sm">Todo sincronizado</span>
                  </div>
                </div>
              )}

              {/* Modo offline */}
              {!isOnline && (
                <div className="mt-3 p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-300">
                    Trabajando en modo offline. Los cambios se sincronizarán cuando vuelva la conexión.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Versión completa (para Settings o Dashboard)
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <h3 className="font-medium text-white mb-4 flex items-center gap-2">
        {getStatusIcon()}
        Estado de Sincronización
      </h3>

      <div className="space-y-4">
        {/* Estado de conexión */}
        <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <HiOutlineWifi className="w-6 h-6" />
              ) : (
                <HiOutlineStatusOffline className="w-6 h-6" />
              )}
              <div>
                <p className="font-medium">{isOnline ? 'Conectado' : 'Sin conexión'}</p>
                <p className="text-sm opacity-70">
                  {isOnline ? 'Conectado al servidor' : 'Trabajando en modo offline'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-slate-700/30 rounded-lg">
            <p className="text-2xl font-bold text-white">{pendingCount}</p>
            <p className="text-xs text-slate-400">Pendientes</p>
          </div>
          <div className="text-center p-3 bg-slate-700/30 rounded-lg">
            <p className="text-2xl font-bold text-white">
              {syncStatus === 'syncing' ? '⏳' : syncStatus === 'error' ? '❌' : '✓'}
            </p>
            <p className="text-xs text-slate-400">Estado</p>
          </div>
          <div className="text-center p-3 bg-slate-700/30 rounded-lg">
            <p className="text-sm font-bold text-white">
              {lastSync ? new Date(lastSync).toLocaleTimeString('es-MX', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }) : '--:--'}
            </p>
            <p className="text-xs text-slate-400">Última Sync</p>
          </div>
        </div>

        {/* Botón de sincronización */}
        {isOnline && (
          <button
            onClick={() => syncAll()}
            disabled={syncStatus === 'syncing'}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {syncStatus === 'syncing' ? (
              <>
                <HiOutlineRefresh className="w-5 h-5 animate-spin" />
                Sincronizando ({syncProgress.current}/{syncProgress.total})
              </>
            ) : (
              <>
                <HiOutlineRefresh className="w-5 h-5" />
                Sincronizar Ahora
              </>
            )}
          </button>
        )}
      </div>

      {/* Toast de estado */}
      {showToast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-xl border z-50 ${
          isOnline 
            ? 'bg-green-500/20 border-green-500/30' 
            : 'bg-red-500/20 border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            {isOnline ? (
              <HiOutlineWifi className="w-6 h-6 text-green-400" />
            ) : (
              <HiOutlineStatusOffline className="w-6 h-6 text-red-400" />
            )}
            <div>
              <p className={`font-medium ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                {isOnline ? 'Conexión restaurada' : 'Sin conexión'}
              </p>
              <p className="text-sm text-slate-300">
                {isOnline 
                  ? 'Sincronizando datos pendientes...' 
                  : 'Trabajando en modo offline'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
