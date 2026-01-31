/**
 * GENESIS - Servicio API
 * Cliente HTTP para comunicación con el backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE || '/api';

// Estado de autenticación
let authToken = localStorage.getItem('token');

/**
 * Cliente API con configuración de autenticación
 */
class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Configurar token de autenticación
   */
  setToken(token) {
    authToken = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  /**
   * Obtener headers con autenticación
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    return headers;
  }

  /**
   * Manejar respuesta (soporta HTML/404 cuando el backend no está disponible)
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    let data = {};
    try {
      const text = await response.text();
      if (contentType.includes('application/json') && text && text.trim().startsWith('{')) {
        data = JSON.parse(text);
      }
    } catch (_) {
      // Respuesta no es JSON (p. ej. HTML 404) → no re-lanzar
    }

    if (!response.ok) {
      if (response.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
      const error = new Error(data.message || `Error ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return { data, status: response.status, ok: true };
  }

  /**
   * GET request
   */
  async get(endpoint, params = {}) {
    const url = new URL(`${this.baseURL}${endpoint}`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });
    
    return this.handleResponse(response);
  }

  /**
   * POST request
   */
  async post(endpoint, body = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    
    return this.handleResponse(response);
  }

  /**
   * PUT request
   */
  async put(endpoint, body = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    
    return this.handleResponse(response);
  }

  /**
   * DELETE request
   */
  async delete(endpoint) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    
    return this.handleResponse(response);
  }

  /**
   * PATCH request
   */
  async patch(endpoint, body = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    
    return this.handleResponse(response);
  }
}

// Instancia única del cliente
const api = new ApiClient();

// ==================== AUTH ENDPOINTS ====================

export const auth = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (oldPassword, newPassword) => 
    api.put('/auth/password', { oldPassword, newPassword }),
  getUsers: () => api.get('/auth/users'),
  createUser: (userData) => api.post('/auth/users', userData),
};

// ==================== PRODUCTS ENDPOINTS ====================

export const products = {
  list: (params) => api.get('/products', params),
  get: (id) => api.get(`/products/${id}`),
  getByBarcode: (barcode) => api.get(`/products/barcode/${barcode}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  lowStock: () => api.get('/products/low-stock'),
  categories: () => api.get('/products/categories'),
  createCategory: (data) => api.post('/products/categories', data),
  updateCategory: (id, data) => api.put(`/products/categories/${id}`, data),
  bulkUpsert: (products) => api.post('/products/bulk', { products }),
};

// ==================== SALES ENDPOINTS ====================

export const sales = {
  list: (params) => api.get('/sales', params),
  get: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  cancel: (id, reason) => api.post(`/sales/${id}/cancel`, { reason }),
  today: () => api.get('/sales/today'),
  sync: (salesData) => api.post('/sales/sync', salesData),
  
  // Cash Sessions
  currentSession: () => api.get('/sales/cash-sessions/current'),
  openSession: (data) => api.post('/sales/cash-sessions/open', data),
  closeSession: (id, data) => api.post(`/sales/cash-sessions/${id}/close`, data),
  listSessions: (params) => api.get('/sales/cash-sessions/list', params),
  
  // Cash Registers
  registers: () => api.get('/sales/registers'),
};

// ==================== INVENTORY ENDPOINTS ====================

export const inventory = {
  lots: (params) => api.get('/inventory/lots', params),
  createLot: (data) => api.post('/inventory/lots', data),
  updateLot: (id, data) => api.put(`/inventory/lots/${id}`, data),
  deleteLot: (id) => api.delete(`/inventory/lots/${id}`),
  expiringLots: (days) => api.get('/inventory/lots/expiring', { days }),
  
  movements: (params) => api.get('/inventory/movements', params),
  adjustment: (data) => api.post('/inventory/adjustment', data),
  
  recipes: () => api.get('/inventory/recipes'),
  getRecipe: (id) => api.get(`/inventory/recipes/${id}`),
  createRecipe: (data) => api.post('/inventory/recipes', data),
  
  production: (params) => api.get('/inventory/production', params),
  createProduction: (data) => api.post('/inventory/production', data),
  completeProduction: (id, data) => api.post(`/inventory/production/${id}/complete`, data),
  
  summary: () => api.get('/inventory/summary'),
};

// ==================== EMPLOYEES ENDPOINTS ====================

export const employees = {
  list: (params) => api.get('/employees', params),
  get: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  sendInvites: (data) => api.post('/employees/invitations/send', data),
  testSmtp: () => api.post('/employees/invitations/test-smtp', {}),
  
  shifts: () => api.get('/employees/shifts/list'),
  createShift: (data) => api.post('/employees/shifts', data),
  
  schedules: (params) => api.get('/employees/schedules', params),
  assignShift: (data) => api.post('/employees/schedules', data),
  bulkSchedule: (data) => api.post('/employees/schedules/bulk', data),
  checkIn: (id) => api.put(`/employees/schedules/${id}/check-in`),
  checkOut: (id, data) => api.put(`/employees/schedules/${id}/check-out`, data),
  
  commissions: (params) => api.get('/employees/commissions', params),
  approveCommissions: (ids) => api.post('/employees/commissions/approve', { ids }),
  payCommissions: (ids) => api.post('/employees/commissions/pay', { ids }),
  
  payroll: (params) => api.get('/employees/payroll', params),
  generatePayroll: (data) => api.post('/employees/payroll/generate', data),
  approvePayroll: (id) => api.put(`/employees/payroll/${id}/approve`),
  payPayroll: (id) => api.put(`/employees/payroll/${id}/pay`),
  
  dashboard: () => api.get('/employees/dashboard'),
};

// ==================== ACCOUNTING ENDPOINTS ====================

export const accounting = {
  accounts: () => api.get('/accounting/accounts'),
  createAccount: (data) => api.post('/accounting/accounts', data),
  
  entries: (params) => api.get('/accounting/entries', params),
  getEntry: (id) => api.get(`/accounting/entries/${id}`),
  createEntry: (data) => api.post('/accounting/entries', data),
  createExpense: (data) => api.post('/accounting/expenses', data),
  
  bankAccounts: () => api.get('/accounting/bank-accounts'),
  bankTransactions: (params) => api.get('/accounting/bank-transactions', params),
  createBankTransaction: (data) => api.post('/accounting/bank-transactions', data),
  reconcile: (id) => api.post('/accounting/reconcile', { transactionId: id }),
  
  balanceSheet: (params) => api.get('/accounting/reports/balance', params),
  incomeStatement: (params) => api.get('/accounting/reports/income-statement', params),
  taxSummary: (params) => api.get('/accounting/reports/tax-summary', params),
  
  dashboard: () => api.get('/accounting/dashboard'),
  cashBalance: () => api.get('/accounting/cash-balance'),
  balanceCheck: () => api.get('/accounting/balance-check'),
};

// ==================== SYNC ENDPOINTS ====================

export const sync = {
  push: (operations, deviceId) => api.post('/sync/push', { operations, device_id: deviceId }),
  pull: (deviceId, lastSync, tables) => 
    api.post('/sync/pull', { device_id: deviceId, last_sync_timestamp: lastSync, tables }),
  sales: (sales, deviceId) => api.post('/sync/sales', { sales, device_id: deviceId }),
  status: () => api.get('/sync/status'),
  conflicts: () => api.get('/sync/conflicts'),
  resolveConflict: (id, resolution) => api.post(`/sync/conflicts/${id}/resolve`, { resolution }),
};

// ==================== REPORTS ENDPOINTS ====================

export const reports = {
  salesDaily: (params) => api.get('/reports/sales/daily', params),
  salesByPeriod: (params) => api.get('/reports/sales/by-period', params),
  salesByProduct: (params) => api.get('/reports/sales/by-product', params),
  salesByEmployee: (params) => api.get('/reports/sales/by-employee', params),
  
  inventoryStatus: () => api.get('/reports/inventory/status'),
  inventoryMovements: (params) => api.get('/reports/inventory/movements', params),
  
  employeePerformance: (params) => api.get('/reports/employees/performance', params),
  
  export: (type, params) => api.get(`/reports/export/${type}`, params),
};

// ==================== PREDICTIONS ENDPOINTS ====================

export const predictions = {
  salesForecast: (params) => api.get('/predictions/sales/forecast', params),
  inventoryNeeds: () => api.get('/predictions/inventory/needs'),
  productTrends: (productId) => api.get(`/predictions/products/${productId}/trends`),
  businessInsights: () => api.get('/predictions/insights'),
};

// Exportar instancia del cliente
export default api;
