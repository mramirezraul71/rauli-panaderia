/**
 * GENESIS - Health Monitor (Semáforo)
 * Conectado a Dexie.js - Alertas reales del sistema
 */

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SystemAlertsDB } from '../services/dataService';
import {
  HiOutlineExclamation,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiOutlineRefresh,
  HiOutlineX,
  HiOutlineDatabase,
  HiOutlineCloud,
  HiOutlineShieldCheck,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlineDocumentReport
} from 'react-icons/hi';

// Iconos por tipo de alerta
const ALERT_ICONS = {
  backup_overdue: HiOutlineDatabase,
  no_backup: HiOutlineDatabase,
  accounting_imbalance: HiOutlineCurrencyDollar,
  low_stock: HiOutlineCube,
  pending_sync: HiOutlineCloud,
  data_integrity: HiOutlineShieldCheck,
  default: HiOutlineExclamation
};

// Colores por severidad
const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30' },
  warning: { bg: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  info: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30' }
};

export default function HealthMonitor({ mode = 'compact' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('green');
  const [loading, setLoading] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);

  // Datos en vivo de sincronización pendiente
  const pendingSyncCount = useLiveQuery(() => db.syncQueue.where('synced').equals(0).count(), []) || 0;
  
  // Verificar estado del sistema
  const checkHealth = useCallback(async () => {
    setLoading(true);
    try {
      const healthAlerts = await SystemAlertsDB.checkHealth();
      setAlerts(healthAlerts);
      
      // Determinar estado del semáforo
      if (healthAlerts.some(a => a.severity === 'critical')) {
        setStatus('red');
      } else if (healthAlerts.some(a => a.severity === 'warning')) {
        setStatus('yellow');
      } else {
        setStatus('green');
      }
    } catch (err) {
      console.error('Error checking health:', err);
    }
    setLoading(false);
  }, []);

  // Verificar cada 60 segundos
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Generar diagnóstico
  const generateDiagnostics = async () => {
    try {
      const [products, sales, accounts, syncQueue] = await Promise.all([
        db.products.count(),
        db.sales.count(),
        db.accounts.count(),
        db.syncQueue.where('synced').equals(0).count()
      ]);

      // Storage info
      let storageInfo = { used: 0, quota: 0 };
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        storageInfo = {
          used: estimate.usage || 0,
          quota: estimate.quota || 0,
          percentage: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
        };
      }

      // Last backup
      const lastBackup = await db.settings.get('last_backup_timestamp');

      setDiagnostics({
        timestamp: new Date().toISOString(),
        browser: navigator.userAgent.split(' ').slice(-2).join(' '),
        online: navigator.onLine,
        storage: storageInfo,
        database: {
          products,
          sales,
          accounts,
          pendingSync: syncQueue
        },
        lastBackup: lastBackup?.value || 'Nunca'
      });
      setShowDiagnostics(true);
    } catch (err) {
      console.error('Error generating diagnostics:', err);
    }
  };

  // Formatear bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // ==================== MODO COMPACTO (Header) ====================
  if (mode === 'compact') {
    return (
      <div className="relative">
        {/* Botón del semáforo */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 bg-slate-700/50 hover:bg-slate-700 rounded-full px-3 py-1.5 transition-colors"
        >
          {/* LEDs del semáforo */}
          <div className="flex gap-1">
            <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
              status === 'green' ? 'bg-green-500 shadow-green-500/50 shadow-sm' : 'bg-slate-600'
            }`} />
            <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
              status === 'yellow' ? 'bg-yellow-500 shadow-yellow-500/50 shadow-sm animate-pulse' : 'bg-slate-600'
            }`} />
            <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
              status === 'red' ? 'bg-red-500 shadow-red-500/50 shadow-sm animate-pulse' : 'bg-slate-600'
            }`} />
          </div>
          
          {/* Contador de alertas */}
          {alerts.length > 0 && (
            <span className={`text-xs font-medium ${
              status === 'red' ? 'text-red-400' : 
              status === 'yellow' ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {alerts.length}
            </span>
          )}
        </button>

        {/* Panel desplegable */}
        {isOpen && (
          <>
            {/* Overlay */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            
            {/* Panel */}
            <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              {/* Header del panel */}
              <div className="p-3 bg-slate-700/50 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status === 'green' && <HiOutlineCheckCircle className="w-5 h-5 text-green-400" />}
                  {status === 'yellow' && <HiOutlineExclamation className="w-5 h-5 text-yellow-400" />}
                  {status === 'red' && <HiOutlineExclamationCircle className="w-5 h-5 text-red-400" />}
                  <span className="font-medium text-white text-sm">
                    {status === 'green' ? 'Sistema OK' : 
                     status === 'yellow' ? 'Atención Requerida' : 'Problemas Detectados'}
                  </span>
                </div>
                <button 
                  onClick={checkHealth}
                  disabled={loading}
                  className="p-1 hover:bg-slate-600 rounded"
                >
                  <HiOutlineRefresh className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Lista de alertas */}
              <div className="max-h-64 overflow-y-auto">
                {alerts.length > 0 ? (
                  <div className="p-2 space-y-2">
                    {alerts.map((alert, idx) => {
                      const Icon = ALERT_ICONS[alert.type] || ALERT_ICONS.default;
                      const colors = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info;
                      
                      return (
                        <div 
                          key={idx}
                          className={`p-3 rounded-lg bg-slate-700/30 border ${colors.border}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded ${colors.bg}/20`}>
                              <Icon className={`w-4 h-4 ${colors.text}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white">{alert.message}</p>
                              <p className={`text-xs ${colors.text} capitalize`}>{alert.severity}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <HiOutlineCheckCircle className="w-10 h-10 mx-auto text-green-400 mb-2" />
                    <p className="text-sm text-slate-400">Todo funcionando correctamente</p>
                  </div>
                )}
              </div>

              {/* Footer con acciones */}
              <div className="p-2 bg-slate-700/30 border-t border-slate-700 flex gap-2">
                <button
                  onClick={generateDiagnostics}
                  className="flex-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg flex items-center justify-center gap-1"
                >
                  <HiOutlineDocumentReport className="w-4 h-4" />
                  Diagnóstico
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </>
        )}

        {/* Modal de diagnóstico */}
        {showDiagnostics && diagnostics && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden">
              <div className="p-4 bg-slate-700/50 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-medium text-white">Diagnóstico del Sistema</h3>
                <button onClick={() => setShowDiagnostics(false)} className="text-slate-400 hover:text-white">
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Estado de conexión */}
                <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Estado</span>
                  <span className={`text-sm font-medium ${diagnostics.online ? 'text-green-400' : 'text-red-400'}`}>
                    {diagnostics.online ? '🟢 En línea' : '🔴 Sin conexión'}
                  </span>
                </div>

                {/* Almacenamiento */}
                <div className="p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Almacenamiento</span>
                    <span className="text-white text-sm">
                      {formatBytes(diagnostics.storage.used)} / {formatBytes(diagnostics.storage.quota)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500"
                      style={{ width: `${diagnostics.storage.percentage || 0}%` }}
                    />
                  </div>
                </div>

                {/* Base de datos */}
                <div className="p-3 bg-slate-700/30 rounded-lg space-y-2">
                  <p className="text-slate-400 text-sm mb-2">Base de Datos</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Productos:</span>
                      <span className="text-white">{diagnostics.database.products}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ventas:</span>
                      <span className="text-white">{diagnostics.database.sales}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cuentas:</span>
                      <span className="text-white">{diagnostics.database.accounts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sync pendiente:</span>
                      <span className={diagnostics.database.pendingSync > 0 ? 'text-yellow-400' : 'text-green-400'}>
                        {diagnostics.database.pendingSync}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Último backup */}
                <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Último Backup</span>
                  <span className="text-white text-sm">{diagnostics.lastBackup}</span>
                </div>

                {/* Navegador */}
                <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Navegador</span>
                  <span className="text-white text-sm truncate ml-4">{diagnostics.browser}</span>
                </div>
              </div>

              <div className="p-4 border-t border-slate-700">
                <button
                  onClick={() => setShowDiagnostics(false)}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== MODO COMPLETO (Dashboard) ====================
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Estado del Sistema</h2>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg"
        >
          <HiOutlineRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Semáforo grande */}
      <div className="flex justify-center mb-6">
        <div className="bg-slate-900 rounded-full p-4 flex gap-3">
          <div className={`w-8 h-8 rounded-full transition-all ${
            status === 'green' ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-slate-700'
          }`} />
          <div className={`w-8 h-8 rounded-full transition-all ${
            status === 'yellow' ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50 animate-pulse' : 'bg-slate-700'
          }`} />
          <div className={`w-8 h-8 rounded-full transition-all ${
            status === 'red' ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse' : 'bg-slate-700'
          }`} />
        </div>
      </div>

      {/* Lista de alertas detallada */}
      <div className="space-y-3">
        {alerts.length > 0 ? (
          alerts.map((alert, idx) => {
            const Icon = ALERT_ICONS[alert.type] || ALERT_ICONS.default;
            const colors = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info;
            
            return (
              <div 
                key={idx}
                className={`p-4 rounded-xl bg-slate-700/30 border ${colors.border}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${colors.bg}/20`}>
                    <Icon className={`w-6 h-6 ${colors.text}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-white">{alert.message}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${colors.bg}/20 ${colors.text}`}>
                        {alert.severity}
                      </span>
                    </div>
                    {alert.details && (
                      <p className="text-sm text-slate-400 mt-1">
                        {JSON.stringify(alert.details).slice(0, 100)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <HiOutlineCheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Todo en Orden</h3>
            <p className="text-slate-400">No se detectaron problemas en el sistema</p>
          </div>
        )}
      </div>

      {/* Botón de diagnóstico */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <button
          onClick={generateDiagnostics}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg flex items-center justify-center gap-2"
        >
          <HiOutlineDocumentReport className="w-5 h-5" />
          Generar Reporte de Diagnóstico
        </button>
      </div>
    </div>
  );
}
