/**
 * GENESIS - Sales Routes (POS)
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';
import { authMiddleware } from './auth.js';
import { createSaleJournalEntry, reverseEntry } from '../services/accounting.js';

const router = Router();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toMoney = (value) => Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;

const computeSaleTotals = ({ items, saleDiscount = 0, taxRate = 0, getProduct }) => {
  if (!items || items.length === 0) {
    throw new Error('La venta debe tener al menos un producto');
  }

  const lineItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = getProduct.get(item.product_id);
    if (!product || product.active === 0) {
      throw new Error('Producto inválido o inactivo');
    }

    const quantity = toNumber(item.quantity);
    if (quantity <= 0) {
      throw new Error('Cantidad inválida');
    }

    const unitPrice = toMoney(product.price ?? item.unit_price ?? 0);
    const lineSubtotal = toMoney(unitPrice * quantity);
    const lineDiscount = Math.min(toMoney(item.discount || 0), lineSubtotal);
    const lineTotal = toMoney(lineSubtotal - lineDiscount);

    subtotal = toMoney(subtotal + lineTotal);
    lineItems.push({
      product,
      quantity,
      unitPrice,
      discount: lineDiscount,
      total: lineTotal,
      productName: item.product_name || product.name
    });
  }

  const discount = Math.min(toMoney(saleDiscount), subtotal);
  const taxableBase = toMoney(subtotal - discount);
  const tax = toMoney(taxableBase * toNumber(taxRate));
  const total = toMoney(taxableBase + tax);

  return { subtotal: taxableBase, discount, tax, total, lineItems };
};

// GET /api/sales - Listar ventas
router.get('/', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date, employee_id, status, limit = 50, offset = 0 } = req.query;
    
    let sql = `
      SELECT s.*, e.name as employee_name
      FROM sales s
      LEFT JOIN employees e ON s.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    
    if (start_date) {
      sql += ' AND DATE(s.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND DATE(s.created_at) <= ?';
      params.push(end_date);
    }
    
    if (employee_id) {
      sql += ' AND s.employee_id = ?';
      params.push(employee_id);
    }
    
    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const sales = db.prepare(sql).all(...params);
    
    // Obtener items de cada venta
    const getItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
    for (const sale of sales) {
      sale.items = getItems.all(sale.id);
    }
    
    // Total count
    let countSql = 'SELECT COUNT(*) as total FROM sales WHERE 1=1';
    const countParams = params.slice(0, -2);
    if (start_date) countSql += ' AND DATE(created_at) >= ?';
    if (end_date) countSql += ' AND DATE(created_at) <= ?';
    if (employee_id) countSql += ' AND employee_id = ?';
    if (status) countSql += ' AND status = ?';
    
    const { total } = db.prepare(countSql).get(...countParams);
    
    res.json({ success: true, sales, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    console.error('Error listing sales:', err);
    res.status(500).json({ error: true, message: 'Error al listar ventas' });
  }
});

// GET /api/sales/today - Resumen de ventas del día
router.get('/today', authMiddleware, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total), 0) as total_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'efectivo' THEN total ELSE 0 END), 0) as cash_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'tarjeta' THEN total ELSE 0 END), 0) as card_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'transferencia' THEN total ELSE 0 END), 0) as transfer_amount
      FROM sales
      WHERE DATE(created_at) = ? AND status = 'completed'
    `).get(today);
    
    const topProducts = db.prepare(`
      SELECT 
        si.product_name,
        SUM(si.quantity) as total_quantity,
        SUM(si.total) as total_amount
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.created_at) = ? AND s.status = 'completed'
      GROUP BY si.product_id
      ORDER BY total_quantity DESC
      LIMIT 5
    `).all(today);
    
    const hourlyStats = db.prepare(`
      SELECT 
        strftime('%H', created_at) as hour,
        COUNT(*) as sales_count,
        SUM(total) as total_amount
      FROM sales
      WHERE DATE(created_at) = ? AND status = 'completed'
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `).all(today);
    
    res.json({ success: true, summary, topProducts, hourlyStats, date: today });
  } catch (err) {
    console.error('Error getting today sales:', err);
    res.status(500).json({ error: true, message: 'Error al obtener resumen' });
  }
});

// POST /api/sales - Crear venta
router.post('/', authMiddleware, (req, res) => {
  try {
    const { 
      local_id,
      cash_session_id,
      employee_id,
      customer_name,
      items,
      discount = 0,
      payment_method = 'efectivo',
      payment_received,
      change_given = 0,
      notes
    } = req.body;
    
    const saleId = uuidv4();
    
    // Transacción para venta e items
    const createSale = db.transaction(() => {
      const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
      const taxRateRow = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
      const taxRate = toNumber(taxRateRow?.value || 0);
      const { subtotal, tax, total, lineItems } = computeSaleTotals({
        items,
        saleDiscount: discount,
        taxRate,
        getProduct
      });

      const received = toMoney(payment_received ?? total);
      const change = Math.max(toMoney(received - total), 0);

      // Insertar venta
      db.prepare(`
        INSERT INTO sales (id, local_id, cash_session_id, employee_id, customer_name, subtotal, discount, tax, total, payment_method, payment_received, change_given, notes, status, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 1)
      `).run(
        saleId,
        local_id || saleId,
        cash_session_id,
        employee_id,
        customer_name,
        subtotal,
        discount,
        tax,
        total,
        payment_method,
        received,
        change,
        notes
      );
      
      // Insertar items y actualizar stock
      const insertItem = db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, discount, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const updateStock = db.prepare(`
        UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?
      `);
      
      const insertMovement = db.prepare(`
        INSERT INTO inventory_movements (id, product_id, movement_type, quantity, previous_stock, new_stock, reference_type, reference_id, employee_id)
        VALUES (?, ?, 'venta', ?, ?, ?, 'sale', ?, ?)
      `);

      for (const line of lineItems) {
        insertItem.run(
          uuidv4(),
          saleId,
          line.product.id,
          line.productName,
          line.quantity,
          line.unitPrice,
          line.discount,
          line.total
        );
        
        // Actualizar stock
        if (line.product) {
          const newStock = line.product.stock - line.quantity;
          updateStock.run(line.quantity, line.product.id);
          
          // Registrar movimiento
          insertMovement.run(
            uuidv4(),
            line.product.id,
            line.quantity,
            line.product.stock,
            newStock,
            saleId,
            employee_id
          );
        }
      }
      
      // Calcular comisión si el empleado tiene
      if (employee_id) {
        const employee = db.prepare('SELECT commission_rate FROM employees WHERE id = ?').get(employee_id);
        if (employee && employee.commission_rate > 0) {
          const commissionAmount = toMoney(total * employee.commission_rate);
          db.prepare(`
            INSERT INTO commissions (id, employee_id, sale_id, amount, rate, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
          `).run(uuidv4(), employee_id, saleId, commissionAmount, employee.commission_rate);
        }
      }
      
      // Crear asiento contable
      createSaleJournalEntry({
        id: saleId,
        sale_number: local_id || saleId,
        subtotal,
        tax,
        total,
        employee_id
      }, payment_method);
    });
    
    createSale();
    
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
    
    res.status(201).json({ success: true, sale });
  } catch (err) {
    console.error('Error creating sale:', err);
    const badRequestMessages = ['La venta debe', 'Producto inválido', 'Cantidad inválida'];
    if (badRequestMessages.some((msg) => err?.message?.includes(msg))) {
      return res.status(400).json({ error: true, message: err.message });
    }
    res.status(500).json({ error: true, message: 'Error al crear venta' });
  }
});

// POST /api/sales/:id/cancel - Cancelar venta
router.post('/:id/cancel', authMiddleware, (req, res) => {
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    
    if (!sale) {
      return res.status(404).json({ error: true, message: 'Venta no encontrada' });
    }
    
    if (sale.status !== 'completed') {
      return res.status(400).json({ error: true, message: 'Solo se pueden cancelar ventas completadas' });
    }
    
    const cancelSale = db.transaction(() => {
      // Actualizar estado
      db.prepare(`
        UPDATE sales SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?
      `).run(req.params.id);
      
      // Devolver stock
      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
      const updateStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
      
      for (const item of items) {
        updateStock.run(item.quantity, item.product_id);
      }
      
      // Cancelar comisión
      db.prepare(`
        UPDATE commissions SET status = 'cancelled' WHERE sale_id = ?
      `).run(req.params.id);

      // Contra-asiento contable
      const entry = db.prepare(
        "SELECT id FROM journal_entries WHERE reference_type = 'sale' AND reference_id = ? ORDER BY date DESC LIMIT 1"
      ).get(req.params.id);
      if (entry?.id) {
        const reversalId = reverseEntry(entry.id, 'Anulación de venta', { useTransaction: false });
        if (!reversalId) {
          throw new Error('No se pudo generar el contra-asiento');
        }
      }
    });
    
    cancelSale();
    
    res.json({ success: true, message: 'Venta cancelada' });
  } catch (err) {
    console.error('Error cancelling sale:', err);
    res.status(500).json({ error: true, message: 'Error al cancelar venta' });
  }
});

// POST /api/sales/sync - Sincronizar ventas offline
router.post('/sync', authMiddleware, (req, res) => {
  try {
    const { sales } = req.body;
    const results = { synced: 0, errors: [] };
    const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
    const taxRateRow = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
    const taxRate = toNumber(taxRateRow?.value || 0);
    
    for (const sale of sales) {
      try {
        // Verificar si ya existe
        const existing = db.prepare('SELECT id FROM sales WHERE local_id = ?').get(sale.local_id);
        
        if (!existing) {
          const saleId = uuidv4();
          const { subtotal, tax, total, lineItems } = computeSaleTotals({
            items: sale.items,
            saleDiscount: sale.discount || 0,
            taxRate,
            getProduct
          });
          const received = toMoney(sale.payment_received ?? total);
          const change = Math.max(toMoney(received - total), 0);

          db.prepare(`
            INSERT INTO sales (id, local_id, cash_session_id, employee_id, customer_name, subtotal, discount, tax, total, payment_method, payment_received, change_given, notes, status, synced, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
          `).run(
            saleId,
            sale.local_id,
            sale.cash_session_id,
            sale.employee_id,
            sale.customer_name,
            subtotal,
            sale.discount || 0,
            tax,
            total,
            sale.payment_method,
            received,
            change,
            sale.notes,
            sale.status || 'completed',
            sale.created_at
          );
          
          // Insertar items
          for (const line of lineItems) {
            db.prepare(`
              INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, discount, total)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              uuidv4(),
              saleId,
              line.product.id,
              line.productName,
              line.quantity,
              line.unitPrice,
              line.discount,
              line.total
            );
          }
          
          results.synced++;
        }
      } catch (err) {
        results.errors.push({ local_id: sale.local_id, error: err.message });
      }
    }
    
    res.json({ success: true, results });
  } catch (err) {
    console.error('Error syncing sales:', err);
    res.status(500).json({ error: true, message: 'Error en sincronización' });
  }
});

// ==================== CASH SESSIONS ====================

// GET /api/sales/cash-sessions - Listar sesiones de caja
router.get('/cash-sessions/list', authMiddleware, (req, res) => {
  try {
    const { status, limit = 20 } = req.query;
    
    let sql = `
      SELECT cs.*, cr.name as register_name, e.name as employee_name
      FROM cash_sessions cs
      JOIN cash_registers cr ON cs.register_id = cr.id
      LEFT JOIN employees e ON cs.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND cs.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY cs.opened_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const sessions = db.prepare(sql).all(...params);
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar sesiones' });
  }
});

// GET /api/sales/cash-sessions/current - Sesión actual
router.get('/cash-sessions/current', authMiddleware, (req, res) => {
  try {
    const session = db.prepare(`
      SELECT cs.*, cr.name as register_name, e.name as employee_name
      FROM cash_sessions cs
      JOIN cash_registers cr ON cs.register_id = cr.id
      LEFT JOIN employees e ON cs.employee_id = e.id
      WHERE cs.status = 'open'
      ORDER BY cs.opened_at DESC
      LIMIT 1
    `).get();
    
    if (session) {
      // Calcular totales de la sesión
      const totals = db.prepare(`
        SELECT 
          COALESCE(SUM(total), 0) as total_sales,
          COALESCE(SUM(CASE WHEN payment_method = 'efectivo' THEN total ELSE 0 END), 0) as cash_sales,
          COUNT(*) as transaction_count
        FROM sales
        WHERE cash_session_id = ? AND status = 'completed'
      `).get(session.id);
      
      session.totals = totals;
    }
    
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener sesión' });
  }
});

// POST /api/sales/cash-sessions/open - Abrir caja
router.post('/cash-sessions/open', authMiddleware, (req, res) => {
  try {
    const { register_id, employee_id, opening_amount } = req.body;
    
    // Verificar que no hay sesión abierta
    const openSession = db.prepare(`
      SELECT id FROM cash_sessions WHERE register_id = ? AND status = 'open'
    `).get(register_id);
    
    if (openSession) {
      return res.status(400).json({ error: true, message: 'Ya existe una sesión abierta para esta caja' });
    }
    
    const id = uuidv4();
    db.prepare(`
      INSERT INTO cash_sessions (id, register_id, employee_id, opening_amount, status)
      VALUES (?, ?, ?, ?, 'open')
    `).run(id, register_id, employee_id, opening_amount || 0);
    
    const session = db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(id);
    res.status(201).json({ success: true, session });
  } catch (err) {
    console.error('Error opening cash session:', err);
    res.status(500).json({ error: true, message: 'Error al abrir caja' });
  }
});

// POST /api/sales/cash-sessions/:id/close - Cerrar caja (Cierre Ciego)
router.post('/cash-sessions/:id/close', authMiddleware, (req, res) => {
  try {
    const { closing_amount, notes } = req.body;
    
    const session = db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(req.params.id);
    
    if (!session) {
      return res.status(404).json({ error: true, message: 'Sesión no encontrada' });
    }
    
    if (session.status !== 'open') {
      return res.status(400).json({ error: true, message: 'La sesión ya está cerrada' });
    }
    
    // Calcular monto esperado
    const totals = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'efectivo' THEN total ELSE 0 END), 0) as cash_sales
      FROM sales
      WHERE cash_session_id = ? AND status = 'completed'
    `).get(session.id);
    
    const expected_amount = session.opening_amount + totals.cash_sales;
    const difference = closing_amount - expected_amount;
    
    db.prepare(`
      UPDATE cash_sessions SET
        closing_amount = ?,
        expected_amount = ?,
        difference = ?,
        status = 'closed',
        closed_at = datetime('now'),
        notes = ?
      WHERE id = ?
    `).run(closing_amount, expected_amount, difference, notes, req.params.id);
    
    const closedSession = db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(req.params.id);
    
    res.json({ 
      success: true, 
      session: closedSession,
      summary: {
        opening: session.opening_amount,
        expected: expected_amount,
        counted: closing_amount,
        difference
      }
    });
  } catch (err) {
    console.error('Error closing cash session:', err);
    res.status(500).json({ error: true, message: 'Error al cerrar caja' });
  }
});

// GET /api/sales/registers - Listar cajas registradoras
router.get('/registers', authMiddleware, (req, res) => {
  try {
    const registers = db.prepare(`
      SELECT cr.*, 
        (SELECT COUNT(*) FROM cash_sessions WHERE register_id = cr.id AND status = 'open') as has_open_session
      FROM cash_registers cr
      WHERE cr.active = 1
    `).all();
    
    res.json({ success: true, registers });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar cajas' });
  }
});

// GET /api/sales/:id - Obtener venta (DEBE IR AL FINAL para no capturar otras rutas)
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const sale = db.prepare(`
      SELECT s.*, e.name as employee_name
      FROM sales s
      LEFT JOIN employees e ON s.employee_id = e.id
      WHERE s.id = ?
    `).get(req.params.id);
    
    if (!sale) {
      return res.status(404).json({ error: true, message: 'Venta no encontrada' });
    }
    
    sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
    
    res.json({ success: true, sale });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener venta' });
  }
});

export default router;
