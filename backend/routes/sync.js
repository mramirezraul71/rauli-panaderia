/**
 * GENESIS - Sync Routes
 * Manejo de sincronización offline-first
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';
import { authMiddleware } from './auth.js';

const router = Router();

// ==================== COLA DE SINCRONIZACIÓN ====================

// GET /api/sync/status - Estado de sincronización
router.get('/status', authMiddleware, (req, res) => {
  try {
    const pendingCount = db.prepare(`
      SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'
    `).get();
    
    const failedCount = db.prepare(`
      SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'
    `).get();
    
    const lastSync = db.prepare(`
      SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 1
    `).get();
    
    res.json({
      success: true,
      status: {
        pending: pendingCount.count,
        failed: failedCount.count,
        last_sync: lastSync,
        server_time: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener estado' });
  }
});

// GET /api/sync/pending - Obtener operaciones pendientes
router.get('/pending', authMiddleware, (req, res) => {
  try {
    const { device_id, limit = 100 } = req.query;
    
    let sql = `SELECT * FROM sync_queue WHERE status = 'pending'`;
    const params = [];
    
    if (device_id) {
      sql += ' AND device_id = ?';
      params.push(device_id);
    }
    
    sql += ' ORDER BY created_at ASC LIMIT ?';
    params.push(parseInt(limit));
    
    const operations = db.prepare(sql).all(...params);
    res.json({ success: true, operations });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener pendientes' });
  }
});

// POST /api/sync/push - Recibir datos del cliente
router.post('/push', authMiddleware, (req, res) => {
  try {
    const { operations, device_id, last_sync_timestamp } = req.body;
    
    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({ error: true, message: 'Operaciones requeridas' });
    }
    
    const results = [];
    const errors = [];
    
    for (const op of operations) {
      try {
        const result = processOperation(op, device_id);
        results.push({ local_id: op.local_id, server_id: result.id, status: 'synced' });
      } catch (err) {
        errors.push({ local_id: op.local_id, error: err.message });
      }
    }
    
    // Registrar sincronización
    if (results.length > 0) {
      db.prepare(`
        INSERT INTO sync_log (id, device_id, direction, records_synced, status)
        VALUES (?, ?, 'push', ?, 'completed')
      `).run(uuidv4(), device_id, results.length);
    }
    
    res.json({
      success: true,
      synced: results,
      errors,
      server_timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Sync push error:', err);
    res.status(500).json({ error: true, message: 'Error en sincronización' });
  }
});

// POST /api/sync/pull - Enviar datos al cliente
router.post('/pull', authMiddleware, (req, res) => {
  try {
    const { device_id, last_sync_timestamp, tables } = req.body;
    
    const timestamp = last_sync_timestamp || '1970-01-01T00:00:00.000Z';
    const requestedTables = tables || ['products', 'categories', 'employees', 'settings'];
    
    const data = {};
    
    // Productos
    if (requestedTables.includes('products')) {
      data.products = db.prepare(`
        SELECT * FROM products 
        WHERE updated_at > ? OR created_at > ?
      `).all(timestamp, timestamp);
    }
    
    // Categorías
    if (requestedTables.includes('categories')) {
      data.categories = db.prepare(`
        SELECT * FROM categories
        WHERE updated_at > ? OR created_at > ?
      `).all(timestamp, timestamp);
    }
    
    // Empleados
    if (requestedTables.includes('employees')) {
      data.employees = db.prepare(`
        SELECT id, code, name, position, base_salary, commission_rate, active
        FROM employees
        WHERE updated_at > ?
      `).all(timestamp);
    }
    
    // Configuración
    if (requestedTables.includes('settings')) {
      data.settings = db.prepare(`SELECT * FROM settings`).all();
    }
    
    // Cajas registradoras
    if (requestedTables.includes('cash_registers')) {
      data.cash_registers = db.prepare(`
        SELECT * FROM cash_registers WHERE active = 1
      `).all();
    }
    
    // Registrar pull
    const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
    if (totalRecords > 0) {
      db.prepare(`
        INSERT INTO sync_log (id, device_id, direction, records_synced, status)
        VALUES (?, ?, 'pull', ?, 'completed')
      `).run(uuidv4(), device_id, totalRecords);
    }
    
    res.json({
      success: true,
      data,
      server_timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Sync pull error:', err);
    res.status(500).json({ error: true, message: 'Error al obtener datos' });
  }
});

// POST /api/sync/sales - Sincronizar ventas offline
router.post('/sales', authMiddleware, (req, res) => {
  try {
    const { sales, device_id } = req.body;
    
    if (!sales || !Array.isArray(sales)) {
      return res.status(400).json({ error: true, message: 'Ventas requeridas' });
    }
    
    const results = [];
    const errors = [];
    
    const syncSales = db.transaction(() => {
      for (const sale of sales) {
        try {
          // Verificar si ya existe
          const existing = db.prepare('SELECT id FROM sales WHERE local_id = ?').get(sale.local_id);
          if (existing) {
            results.push({ local_id: sale.local_id, server_id: existing.id, status: 'already_synced' });
            continue;
          }
          
          const id = uuidv4();
          const saleNumber = db.prepare('SELECT COALESCE(MAX(sale_number), 0) + 1 as next FROM sales').get().next;
          
          // Insertar venta
          db.prepare(`
            INSERT INTO sales (id, sale_number, local_id, employee_id, subtotal, tax, discount, total, 
                             payment_method, amount_paid, change_amount, status, synced, device_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 1, ?, ?)
          `).run(
            id, saleNumber, sale.local_id, sale.employee_id,
            sale.subtotal, sale.tax || 0, sale.discount || 0, sale.total,
            sale.payment_method, sale.amount_paid, sale.change_amount || 0,
            device_id, sale.created_at || new Date().toISOString()
          );
          
          // Insertar items
          if (sale.items && sale.items.length > 0) {
            const insertItem = db.prepare(`
              INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, subtotal)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            for (const item of sale.items) {
              insertItem.run(
                uuidv4(), id, item.product_id, item.product_name,
                item.quantity, item.unit_price, item.subtotal
              );
              
              // Actualizar stock si aún no se hizo
              db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
                .run(item.quantity, item.product_id);
            }
          }
          
          results.push({ local_id: sale.local_id, server_id: id, sale_number: saleNumber, status: 'synced' });
        } catch (err) {
          errors.push({ local_id: sale.local_id, error: err.message });
        }
      }
    });
    
    syncSales();
    
    res.json({
      success: true,
      synced: results,
      errors,
      server_timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Sales sync error:', err);
    res.status(500).json({ error: true, message: 'Error en sincronización de ventas' });
  }
});

// GET /api/sync/conflicts - Obtener conflictos de sincronización
router.get('/conflicts', authMiddleware, (req, res) => {
  try {
    const conflicts = db.prepare(`
      SELECT * FROM sync_queue 
      WHERE status = 'conflict'
      ORDER BY created_at DESC
    `).all();
    
    res.json({ success: true, conflicts });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener conflictos' });
  }
});

// POST /api/sync/resolve - Resolver conflicto
router.post('/resolve', authMiddleware, (req, res) => {
  try {
    const { queue_id, resolution } = req.body;
    
    if (!queue_id || !resolution) {
      return res.status(400).json({ error: true, message: 'Datos incompletos' });
    }
    
    const item = db.prepare('SELECT * FROM sync_queue WHERE id = ?').get(queue_id);
    if (!item) {
      return res.status(404).json({ error: true, message: 'Item no encontrado' });
    }
    
    if (resolution === 'server') {
      // Mantener versión del servidor, marcar como resuelto
      db.prepare(`
        UPDATE sync_queue SET status = 'resolved', resolved_at = datetime('now')
        WHERE id = ?
      `).run(queue_id);
    } else if (resolution === 'client') {
      // Aplicar versión del cliente
      const data = JSON.parse(item.data);
      processOperation({ ...item, ...data }, item.device_id);
      db.prepare(`
        UPDATE sync_queue SET status = 'resolved', resolved_at = datetime('now')
        WHERE id = ?
      `).run(queue_id);
    }
    
    res.json({ success: true, message: 'Conflicto resuelto' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al resolver conflicto' });
  }
});

// Función auxiliar para procesar operaciones
function processOperation(op, deviceId) {
  const { entity_type, operation, data, local_id } = op;
  
  switch (entity_type) {
    case 'product':
      return processProductOperation(operation, data, local_id);
    case 'sale':
      return processSaleOperation(operation, data, local_id, deviceId);
    case 'inventory_movement':
      return processInventoryOperation(operation, data, local_id);
    default:
      throw new Error(`Tipo de entidad no soportado: ${entity_type}`);
  }
}

function processProductOperation(operation, data, localId) {
  if (operation === 'create') {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO products (id, barcode, name, description, category_id, price, cost, stock, min_stock, unit, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, data.barcode, data.name, data.description, data.category_id, data.price, data.cost || 0, data.stock || 0, data.min_stock || 0, data.unit || 'unidad');
    return { id };
  } else if (operation === 'update') {
    db.prepare(`
      UPDATE products SET 
        name = COALESCE(?, name),
        price = COALESCE(?, price),
        stock = COALESCE(?, stock),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(data.name, data.price, data.stock, data.id);
    return { id: data.id };
  }
  throw new Error('Operación no soportada');
}

function processSaleOperation(operation, data, localId, deviceId) {
  if (operation === 'create') {
    const existing = db.prepare('SELECT id FROM sales WHERE local_id = ?').get(localId);
    if (existing) return { id: existing.id };
    
    const id = uuidv4();
    const saleNumber = db.prepare('SELECT COALESCE(MAX(sale_number), 0) + 1 as next FROM sales').get().next;
    
    db.prepare(`
      INSERT INTO sales (id, sale_number, local_id, employee_id, subtotal, tax, discount, total, 
                       payment_method, amount_paid, change_amount, status, synced, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 1, ?)
    `).run(id, saleNumber, localId, data.employee_id, data.subtotal, data.tax || 0, data.discount || 0, 
           data.total, data.payment_method, data.amount_paid, data.change_amount || 0, deviceId);
    
    return { id, sale_number: saleNumber };
  }
  throw new Error('Operación no soportada');
}

function processInventoryOperation(operation, data, localId) {
  if (operation === 'adjustment') {
    const id = uuidv4();
    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(data.product_id);
    const newStock = product.stock + data.quantity;
    
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, data.product_id);
    db.prepare(`
      INSERT INTO inventory_movements (id, product_id, movement_type, quantity, previous_stock, new_stock, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.product_id, data.type || 'ajuste', Math.abs(data.quantity), product.stock, newStock, data.notes);
    
    return { id };
  }
  throw new Error('Operación no soportada');
}

export default router;
