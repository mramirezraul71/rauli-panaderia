/**
 * GENESIS - Reports Routes
 * Reportes avanzados y analytics
 */

import { Router } from 'express';
import db from '../database/connection.js';
import { authMiddleware, requireRole } from './auth.js';

const router = Router();

// ==================== REPORTES DE VENTAS ====================

// GET /api/reports/sales/daily - Reporte de ventas diarias
router.get('/sales/daily', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    const dailySales = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transactions,
        SUM(total) as total_sales,
        SUM(tax) as total_tax,
        AVG(total) as avg_ticket,
        SUM(CASE WHEN payment_method = 'efectivo' THEN total ELSE 0 END) as cash_sales,
        SUM(CASE WHEN payment_method = 'tarjeta' THEN total ELSE 0 END) as card_sales,
        SUM(CASE WHEN payment_method = 'transferencia' THEN total ELSE 0 END) as transfer_sales
      FROM sales
      WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all(startDate, endDate);
    
    const totals = db.prepare(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(total), 0) as total_sales,
        COALESCE(AVG(total), 0) as avg_ticket
      FROM sales
      WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
    `).get(startDate, endDate);
    
    res.json({
      success: true,
      report: {
        period: { start_date: startDate, end_date: endDate },
        daily: dailySales,
        totals
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// GET /api/reports/sales/by-hour - Ventas por hora
router.get('/sales/by-hour', authMiddleware, (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const hourlyData = db.prepare(`
      SELECT 
        strftime('%H', created_at) as hour,
        COUNT(*) as transactions,
        SUM(total) as total_sales
      FROM sales
      WHERE DATE(created_at) = ? AND status = 'completed'
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `).all(targetDate);
    
    // Llenar horas faltantes
    const fullHours = [];
    for (let i = 0; i < 24; i++) {
      const hourStr = i.toString().padStart(2, '0');
      const existing = hourlyData.find(h => h.hour === hourStr);
      fullHours.push({
        hour: hourStr,
        transactions: existing?.transactions || 0,
        total_sales: existing?.total_sales || 0
      });
    }
    
    res.json({ success: true, date: targetDate, hourly: fullHours });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// GET /api/reports/sales/by-product - Ventas por producto
router.get('/sales/by-product', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date, limit = 20 } = req.query;
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    const products = db.prepare(`
      SELECT 
        si.product_id,
        si.product_name,
        p.category_id,
        c.name as category_name,
        SUM(si.quantity) as total_quantity,
        SUM(si.subtotal) as total_revenue,
        COUNT(DISTINCT si.sale_id) as transactions,
        AVG(si.unit_price) as avg_price
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE DATE(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
      GROUP BY si.product_id, si.product_name
      ORDER BY total_revenue DESC
      LIMIT ?
    `).all(startDate, endDate, parseInt(limit));
    
    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      products
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// GET /api/reports/sales/by-category - Ventas por categoría
router.get('/sales/by-category', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    const categories = db.prepare(`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        SUM(si.quantity) as total_quantity,
        SUM(si.subtotal) as total_revenue,
        COUNT(DISTINCT s.id) as transactions
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE DATE(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `).all(startDate, endDate);
    
    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      categories
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// GET /api/reports/sales/by-employee - Ventas por empleado
router.get('/sales/by-employee', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    const employees = db.prepare(`
      SELECT 
        e.id as employee_id,
        e.name as employee_name,
        e.position,
        COUNT(s.id) as transactions,
        COALESCE(SUM(s.total), 0) as total_sales,
        COALESCE(AVG(s.total), 0) as avg_ticket,
        COALESCE(SUM(c.amount), 0) as total_commissions
      FROM employees e
      LEFT JOIN sales s ON e.id = s.employee_id AND DATE(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
      LEFT JOIN commissions c ON s.id = c.sale_id
      WHERE e.active = 1
      GROUP BY e.id
      ORDER BY total_sales DESC
    `).all(startDate, endDate);
    
    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      employees
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// ==================== REPORTES DE INVENTARIO ====================

// GET /api/reports/inventory/stock - Estado del inventario
router.get('/inventory/stock', authMiddleware, (req, res) => {
  try {
    const { category_id, status } = req.query;
    
    let sql = `
      SELECT 
        p.id,
        p.barcode,
        p.name,
        c.name as category,
        p.stock,
        p.min_stock,
        p.cost,
        p.price,
        (p.stock * p.cost) as stock_value,
        CASE 
          WHEN p.stock <= 0 THEN 'sin_stock'
          WHEN p.stock <= p.min_stock THEN 'bajo'
          ELSE 'normal'
        END as stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1
    `;
    const params = [];
    
    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(category_id);
    }
    
    if (status === 'low') {
      sql += ' AND p.stock <= p.min_stock';
    } else if (status === 'out') {
      sql += ' AND p.stock <= 0';
    }
    
    sql += ' ORDER BY p.name';
    
    const products = db.prepare(sql).all(...params);
    
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN stock > 0 AND stock <= min_stock THEN 1 ELSE 0 END) as low_stock,
        COALESCE(SUM(stock * cost), 0) as total_value
      FROM products WHERE active = 1
    `).get();
    
    res.json({ success: true, products, summary });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// GET /api/reports/inventory/movements - Movimientos de inventario
router.get('/inventory/movements', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date, product_id, type } = req.query;
    const startDate = start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    let sql = `
      SELECT 
        im.*,
        p.name as product_name,
        e.name as employee_name
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      LEFT JOIN employees e ON im.employee_id = e.id
      WHERE DATE(im.created_at) BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];
    
    if (product_id) {
      sql += ' AND im.product_id = ?';
      params.push(product_id);
    }
    
    if (type) {
      sql += ' AND im.movement_type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY im.created_at DESC';
    
    const movements = db.prepare(sql).all(...params);
    
    // Resumen por tipo
    const byType = db.prepare(`
      SELECT 
        movement_type,
        COUNT(*) as count,
        SUM(quantity) as total_quantity
      FROM inventory_movements
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY movement_type
    `).all(startDate, endDate);
    
    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      movements,
      by_type: byType
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// GET /api/reports/inventory/expiring - Lotes por vencer
router.get('/inventory/expiring', authMiddleware, (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const lots = db.prepare(`
      SELECT 
        il.*,
        p.name as product_name,
        p.unit,
        julianday(il.expiration_date) - julianday('now') as days_until_expiry
      FROM inventory_lots il
      JOIN products p ON il.product_id = p.id
      WHERE il.status = 'active'
        AND il.expiration_date IS NOT NULL
        AND il.expiration_date <= date('now', '+' || ? || ' days')
      ORDER BY il.expiration_date ASC
    `).all(parseInt(days));
    
    res.json({ success: true, days: parseInt(days), lots });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// ==================== REPORTES FINANCIEROS ====================

// GET /api/reports/financial/cash-flow - Flujo de caja
router.get('/financial/cash-flow', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    // Ingresos por ventas
    const salesIncome = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        SUM(total) as amount
      FROM sales
      WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(startDate, endDate);
    
    // Transacciones bancarias
    const bankTransactions = db.prepare(`
      SELECT 
        DATE(date) as date,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as inflows,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as outflows
      FROM bank_transactions
      WHERE DATE(date) BETWEEN ? AND ?
      GROUP BY DATE(date)
      ORDER BY date
    `).all(startDate, endDate);
    
    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      sales_income: salesIncome,
      bank_transactions: bankTransactions
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// GET /api/reports/financial/profit-margin - Márgenes de ganancia
router.get('/financial/profit-margin', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    const margins = db.prepare(`
      SELECT 
        si.product_id,
        si.product_name,
        p.cost,
        p.price,
        SUM(si.quantity) as quantity_sold,
        SUM(si.subtotal) as revenue,
        SUM(si.quantity * p.cost) as total_cost,
        SUM(si.subtotal) - SUM(si.quantity * p.cost) as gross_profit,
        CASE 
          WHEN SUM(si.subtotal) > 0 
          THEN ((SUM(si.subtotal) - SUM(si.quantity * p.cost)) / SUM(si.subtotal)) * 100
          ELSE 0 
        END as margin_percent
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE DATE(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
      GROUP BY si.product_id
      ORDER BY gross_profit DESC
    `).all(startDate, endDate);
    
    const totals = db.prepare(`
      SELECT 
        SUM(si.subtotal) as total_revenue,
        SUM(si.quantity * p.cost) as total_cost,
        SUM(si.subtotal) - SUM(si.quantity * p.cost) as total_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE DATE(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
    `).get(startDate, endDate);
    
    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      margins,
      totals: {
        ...totals,
        margin_percent: totals.total_revenue > 0 
          ? ((totals.total_profit / totals.total_revenue) * 100).toFixed(2)
          : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// ==================== REPORTES DE RRHH ====================

// GET /api/reports/hr/attendance - Asistencia de empleados
router.get('/hr/attendance', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { start_date, end_date, employee_id } = req.query;
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    let sql = `
      SELECT 
        es.id,
        es.employee_id,
        e.name as employee_name,
        es.date,
        s.name as shift_name,
        s.start_time,
        s.end_time,
        es.check_in,
        es.check_out,
        es.status,
        CASE 
          WHEN es.check_in IS NOT NULL AND es.check_out IS NOT NULL
          THEN (julianday(es.check_out) - julianday(es.check_in)) * 24
          ELSE 0
        END as hours_worked
      FROM employee_schedules es
      JOIN employees e ON es.employee_id = e.id
      JOIN shifts s ON es.shift_id = s.id
      WHERE es.date BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];
    
    if (employee_id) {
      sql += ' AND es.employee_id = ?';
      params.push(employee_id);
    }
    
    sql += ' ORDER BY es.date DESC, e.name';
    
    const attendance = db.prepare(sql).all(...params);
    
    // Resumen por empleado
    const summary = db.prepare(`
      SELECT 
        e.id as employee_id,
        e.name,
        COUNT(es.id) as scheduled_days,
        SUM(CASE WHEN es.status = 'completed' THEN 1 ELSE 0 END) as completed_days,
        SUM(CASE WHEN es.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN es.check_in IS NOT NULL AND es.check_out IS NOT NULL
          THEN (julianday(es.check_out) - julianday(es.check_in)) * 24 ELSE 0 END) as total_hours
      FROM employees e
      LEFT JOIN employee_schedules es ON e.id = es.employee_id AND es.date BETWEEN ? AND ?
      WHERE e.active = 1
      GROUP BY e.id
    `).all(startDate, endDate);
    
    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      attendance,
      summary
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

// GET /api/reports/hr/commissions - Comisiones de empleados
router.get('/hr/commissions', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    let sql = `
      SELECT 
        e.id as employee_id,
        e.name as employee_name,
        e.commission_rate,
        COUNT(c.id) as commission_count,
        COALESCE(SUM(c.amount), 0) as total_commissions,
        SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END) as pending,
        SUM(CASE WHEN c.status = 'approved' THEN c.amount ELSE 0 END) as approved,
        SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END) as paid
      FROM employees e
      LEFT JOIN commissions c ON e.id = c.employee_id AND DATE(c.created_at) BETWEEN ? AND ?
      WHERE e.active = 1
    `;
    const params = [startDate, endDate];
    
    if (status) {
      sql += ' AND (c.status = ? OR c.id IS NULL)';
      params.push(status);
    }
    
    sql += ' GROUP BY e.id ORDER BY total_commissions DESC';
    
    const commissions = db.prepare(sql).all(...params);
    
    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      commissions
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar reporte' });
  }
});

export default router;
