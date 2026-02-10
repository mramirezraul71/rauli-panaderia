// Configuración de Toggle para Proxy Internacional
// Permite activar/desactivar el proxy dinámicamente

export const PROXY_TOGGLE_CONFIG = {
  // Estado actual del proxy
  enabled: true,
  
  // Función para verificar si el proxy está habilitado
  isProxyEnabled: () => {
    return PROXY_TOGGLE_CONFIG.enabled;
  },
  
  // Función para habilitar/deshabilitar proxy
  setProxyEnabled: (enabled) => {
    PROXY_TOGGLE_CONFIG.enabled = enabled;
    console.log(`🤖 Proxy ${enabled ? 'HABILITADO' : 'DESHABILITADO'}`);
    
    // Guardar preferencia en localStorage
    try {
      localStorage.setItem('rauli_proxy_enabled', String(enabled));
    } catch (e) {
      console.warn('No se pudo guardar preferencia de proxy:', e);
    }
  },
  
  // Cargar preferencia guardada
  loadProxyPreference: () => {
    try {
      const saved = localStorage.getItem('rauli_proxy_enabled');
      if (saved !== null) {
        PROXY_TOGGLE_CONFIG.enabled = saved === 'true';
      }
    } catch (e) {
      console.warn('No se pudo cargar preferencia de proxy:', e);
    }
  },
  
  // Función para obtener la configuración actual
  getConfig: () => {
    return {
      proxyEnabled: PROXY_TOGGLE_CONFIG.enabled,
      workerUrl: 'https://rauli-panaderia.mramirezraul71.workers.dev',
      status: PROXY_TOGGLE_CONFIG.enabled ? 'Activo' : 'Inactivo'
    };
  }
};

// Cargar preferencia al iniciar
PROXY_TOGGLE_CONFIG.loadProxyPreference();
