import { useState, useEffect } from 'react';
import { HiOutlineGlobeAlt, HiOutlineServer, HiOutlineCheckCircle, HiOutlineExclamation } from 'react-icons/hi';
import { PROXY_TOGGLE_CONFIG } from '../../config/proxyToggle';
import { INTERNATIONAL_PROXY_CONFIG } from '../../config/internationalProxy';

export default function ProxySettings() {
  const [proxyEnabled, setProxyEnabled] = useState(PROXY_TOGGLE_CONFIG.isProxyEnabled());
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setProxyEnabled(PROXY_TOGGLE_CONFIG.isProxyEnabled());
  }, []);

  const handleToggle = async () => {
    PROXY_TOGGLE_CONFIG.setProxyEnabled(!proxyEnabled);
    setProxyEnabled(!proxyEnabled);
  };

  const testProxy = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch(`${INTERNATIONAL_PROXY_CONFIG.workerUrl}/api/health`);
      const data = await response.json();
      
      setTestResult({
        success: response.ok,
        data: data,
        message: response.ok ? 'Proxy funcionando correctamente' : 'Error en proxy'
      });
    } catch (error) {
      setTestResult({
        success: false,
        data: null,
        message: `Error de conexión: ${error.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const config = PROXY_TOGGLE_CONFIG.getConfig();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <HiOutlineGlobeAlt className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Configuración Proxy Internacional</h2>
            <p className="text-slate-400 text-sm">
              Enmascara solicitudes a APIs para evitar bloqueos
            </p>
          </div>
        </div>
        
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Estado del Proxy</h3>
            <p className="text-slate-400 text-sm">
              {config.status}
            </p>
          </div>
          
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-7 rounded-full w-14 transition-colors duration-200 ease-in-out focus:outline-none ${
              proxyEnabled ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block w-6 h-6 rounded-full bg-white transform transition-transform duration-200 ease-in-out ${
                proxyEnabled ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
            <span className="sr-only">
              {proxyEnabled ? 'Desactivar' : 'Activar'} proxy
            </span>
          </button>
        </div>
        
        {/* URL del Worker */}
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            URL del Worker
          </label>
          <div className="flex items-center gap-2">
            <HiOutlineServer className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={config.workerUrl}
              readOnly
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 text-sm"
            />
          </div>
        </div>
        
        {/* Test Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={testProxy}
            disabled={testing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? 'Probando...' : 'Probar Conexión'}
          </button>
          
          {testResult && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              testResult.success 
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
                : 'bg-red-500/20 border-red-500/30 text-red-300'
            }`}>
              {testResult.success ? (
                <HiOutlineCheckCircle className="w-4 h-4" />
              ) : (
                <HiOutlineExclamation className="w-4 h-4" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Status Details */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Estado del Sistema</h3>
        
        <div className="space-y-4">
          {/* Proxy Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                proxyEnabled ? 'bg-emerald-400' : 'bg-slate-600'
              }`} />
              <span className="text-slate-300">Proxy Internacional</span>
            </div>
            <span className={`text-sm font-medium ${
              proxyEnabled ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              {proxyEnabled ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          
          {/* Enmascaramiento */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                proxyEnabled ? 'bg-blue-400' : 'bg-slate-600'
              }`} />
              <span className="text-slate-300">Enmascaramiento</span>
            </div>
            <span className={`text-sm font-medium ${
              proxyEnabled ? 'text-blue-400' : 'text-slate-500'
            }`}>
              {proxyEnabled ? 'Completo' : 'Desactivado'}
            </span>
          </div>
          
          {/* Geolocalización */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                proxyEnabled ? 'bg-purple-400' : 'bg-slate-600'
              }`} />
              <span className="text-slate-300">Geolocalización</span>
            </div>
            <span className={`text-sm font-medium ${
              proxyEnabled ? 'text-purple-400' : 'text-slate-500'
            }`}>
              {proxyEnabled ? 'US' : 'Real'}
            </span>
          </div>
        </div>
        
        {/* Test Results */}
        {testResult && testResult.success && testResult.data && (
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <h4 className="text-emerald-300 font-medium mb-2">✅ Proxy Funcionando</h4>
            <div className="space-y-2 text-sm text-emerald-200">
              <div>• Status: {testResult.data.status}</div>
              <div>• Versión: {testResult.data.version}</div>
              <div>• Endpoints: {testResult.data.endpoints?.length || 0} disponibles</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Instructions */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Información</h3>
        
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex items-start gap-3">
            <span className="text-emerald-400">•</span>
            <span>El proxy enmascara todas las solicitudes a APIs como tráfico de Estados Unidos</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-emerald-400">•</span>
            <span>Evita bloqueos de Google, OpenAI y otros servicios</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-emerald-400">•</span>
            <span>100,000 requests diarios gratuitos</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-emerald-400">•</span>
            <span>Respuesta rápida desde edge global de Cloudflare</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-emerald-400">•</span>
            <span>Configuración automática de headers y geolocalización</span>
          </div>
        </div>
      </div>
    </div>
  );
}
