import { useState, useEffect } from 'react';
import { HiOutlineGlobeAlt, HiOutlineShieldCheck, HiOutlineX } from 'react-icons/hi';
import { PROXY_TOGGLE_CONFIG } from '../../config/proxyToggle';

export default function ProxyToggle() {
  const [proxyEnabled, setProxyEnabled] = useState(PROXY_TOGGLE_CONFIG.isProxyEnabled());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Sincronizar estado con configuración
    setProxyEnabled(PROXY_TOGGLE_CONFIG.isProxyEnabled());
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    
    try {
      const newState = !proxyEnabled;
      PROXY_TOGGLE_CONFIG.setProxyEnabled(newState);
      setProxyEnabled(newState);
      
      // Mostrar notificación
      if (newState) {
        console.log('🌐 Proxy internacional habilitado');
      } else {
        console.log('🔒 Proxy internacional deshabilitado');
      }
    } catch (error) {
      console.error('Error al cambiar configuración del proxy:', error);
    } finally {
      setLoading(false);
    }
  };

  const config = PROXY_TOGGLE_CONFIG.getConfig();

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            proxyEnabled 
              ? 'bg-emerald-500/20 border-emerald-500/30' 
              : 'bg-slate-700/50 border-slate-600/50'
          }`}>
            {proxyEnabled ? (
              <HiOutlineGlobeAlt className="w-5 h-5 text-emerald-400" />
            ) : (
              <HiOutlineShieldCheck className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div>
            <h3 className="text-white font-semibold">Proxy Internacional</h3>
            <p className="text-xs text-slate-400">
              {config.status} - {config.workerUrl}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative inline-flex h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none ${
            loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${proxyEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
        >
          <span
            className={`inline-block w-5 h-5 rounded-full bg-white transform transition-transform duration-200 ease-in-out ${
              proxyEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
          <span className="sr-only">
            {proxyEnabled ? 'Desactivar' : 'Activar'} proxy
          </span>
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            proxyEnabled ? 'bg-emerald-400' : 'bg-slate-600'
          }`} />
          <span className="text-slate-300">
            {proxyEnabled ? 'Enmascaramiento activo' : 'Conexión directa'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            proxyEnabled ? 'bg-blue-400' : 'bg-slate-600'
          }`} />
          <span className="text-slate-300">
            {proxyEnabled ? 'Headers US' : 'Headers originales'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            proxyEnabled ? 'bg-purple-400' : 'bg-slate-600'
          }`} />
          <span className="text-slate-300">
            {proxyEnabled ? 'IP falsificada' : 'IP real'}
          </span>
        </div>
      </div>
      
      {proxyEnabled && (
        <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <HiOutlineGlobeAlt className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 text-xs font-medium">
              Proxy Activo
            </span>
          </div>
          <p className="text-xs text-emerald-200">
            Todas las solicitudes a APIs se enmascararán como tráfico internacional
          </p>
        </div>
      )}
    </div>
  );
}
