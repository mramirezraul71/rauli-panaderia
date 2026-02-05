/**
 * Configuración centralizada de la API
 * Usa VITE_API_BASE (o VITE_API_URL) desde .env
 */
const API_BASE = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || 'https://rauli-panaderia-1.onrender.com/api').replace(/\/+$/, '');

export { API_BASE };
export default API_BASE;
