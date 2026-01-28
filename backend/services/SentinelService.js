/**
 * GENESIS - Sentinel Service (Backend)
 * Servicio de monitoreo de salud del sistema
 */

import db from '../database/connection.js';

// ==================== VERIFICACIONES ====================

// Verificar ecuación contable: Activo = Pasivo + Capital
export async function checkAccountingEquation() {
  try {
    const activos = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total 
      FROM accounts 
      WHERE type IN ('activo', 'activo_circulante', 'activo_fijo') AND active = 1
    `).get();
    
    const pasivos = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total 
      FROM accounts 
      WHERE type IN ('pasivo', 'pasivo_corto', 'pasivo_largo') AND active = 1
    `).get();
    
    const capital = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total 
      FROM accounts 
      WHERE type IN ('capital', 'patrimonio') AND active = 1
    `).get();
    
    const totalActivos = activos?.total || 0;
    const totalPasivos = pasivos?.total || 0;
    const totalCapital = capital?.total || 0;
    const diferencia = totalActivos - (totalPasivos + totalCapital);
    const balanced = Math.abs(diferencia) < 0.01;
    
    return {
      status: balanced ? 'green' : 'red',
      activos: totalActivos,
      pasivos: totalPasivos,
      capital: totalCapital,
      diferencia,
      balanced
    };
  } catch (error) {
    return { status: 'yellow', error: error.message };
  }
}

// Verificar stock crítico
export async function checkCriticalStock() {
  try {
    const lowStock = db.prepare(`
      SELECT COUNT(*) as count FROM products 
      WHERE active = 1 AND stock <= COALESCE(min_stock, 5)
    `).get();
    
    const outOfStock = db.prepare(`
      SELECT COUNT(*) as count FROM products 
      WHERE active = 1 AND stock = 0
    `).get();
    
    let status = 'green';
    if (outOfStock?.count > 0) status = 'red';
    else if (lowStock?.count > 0) status = 'yellow';
    
    return {
      status,
      lowStockCount: lowStock?.count || 0,
      outOfStockCount: outOfStock?.count || 0
    };
  } catch (error) {
    return { status: 'yellow', error: error.message };
  }
}

// Ejecutar diagnóstico completo
export async function runFullDiagnostic() {
  const checks = [];
  let overallStatus = 'green';
  
  // Check contabilidad
  const accountingCheck = await checkAccountingEquation();
  checks.push({
    name: 'Ecuación Contable',
    ...accountingCheck
  });
  if (accountingCheck.status === 'red') overallStatus = 'red';
  else if (accountingCheck.status === 'yellow' && overallStatus !== 'red') overallStatus = 'yellow';
  
  // Check stock
  const stockCheck = await checkCriticalStock();
  checks.push({
    name: 'Estado de Stock',
    ...stockCheck
  });
  if (stockCheck.status === 'red' && overallStatus !== 'red') overallStatus = 'red';
  else if (stockCheck.status === 'yellow' && overallStatus !== 'red') overallStatus = 'yellow';
  
  // Check ventas del día
  try {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM sales 
      WHERE DATE(created_at) = ? AND status = 'completed'
    `).get(today);
    
    checks.push({
      name: 'Ventas del Día',
      status: 'green',
      count: todaySales?.count || 0,
      total: todaySales?.total || 0
    });
  } catch (error) {
    checks.push({
      name: 'Ventas del Día',
      status: 'yellow',
      error: error.message
    });
  }
  
  // Check sesión de caja
  try {
    const openSession = db.prepare(`
      SELECT * FROM cash_sessions WHERE status = 'open' LIMIT 1
    `).get();
    
    checks.push({
      name: 'Sesión de Caja',
      status: openSession ? 'green' : 'yellow',
      hasOpenSession: !!openSession,
      sessionId: openSession?.id
    });
  } catch (error) {
    checks.push({
      name: 'Sesión de Caja',
      status: 'yellow',
      error: error.message
    });
  }
  
  return {
    overallStatus,
    checks,
    timestamp: new Date().toISOString()
  };
}

// Obtener historial de alertas (simplificado)
export async function getAlertHistory(limit = 50) {
  // En una implementación completa, esto vendría de una tabla de alertas
  return [];
}

// Reconocer alerta
export async function acknowledgeAlert(alertId) {
  // En una implementación completa, esto actualizaría la tabla de alertas
  return true;
}

// Obtener métricas del sistema
export async function getSystemMetrics() {
  try {
    const todayStart = new Date().toISOString().split('T')[0];
    
    const sales = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM sales WHERE DATE(created_at) >= ? AND status = 'completed'
    `).get(todayStart);
    
    const products = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN stock <= 5 THEN 1 ELSE 0 END) as low
      FROM products WHERE active = 1
    `).get();
    
    const employees = db.prepare(`
      SELECT COUNT(*) as count FROM employees WHERE active = 1
    `).get();
    
    return {
      sales: {
        today: sales?.count || 0,
        totalToday: sales?.total || 0
      },
      products: {
        total: products?.total || 0,
        lowStock: products?.low || 0
      },
      employees: {
        active: employees?.count || 0
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { error: error.message };
  }
}

export default {
  checkAccountingEquation,
  checkCriticalStock,
  runFullDiagnostic,
  getAlertHistory,
  acknowledgeAlert,
  getSystemMetrics
};
