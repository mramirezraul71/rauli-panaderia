/**
 * GENESIS - Inventory & Manufacturing Routes
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';
import { authMiddleware, requireRole } from './auth.js';

const router = Router();

// ==================== LOTES DE INVENTARIO ====================

// GET /api/inventory/lots - Listar lotes
router.get('/lots', authMiddleware, (req, res) => {
  try {
    const { product_id, status = 'active', expiring_days } = req.query;
    
    let sql = `
      SELECT il.*, p.name as product_name, p.unit
      FROM inventory_lots il
      JOIN products p ON il.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (product_id) {
      sql += ' AND il.product_id = ?';
      params.push(product_id);
    }
    
    if (status !== 'all') {
      sql += ' AND il.status = ?';
      params.push(status);
    }
    
    if (expiring_days) {
      sql += ' AND il.expiration_date <= date("now", "+" || ? || " days")';
      params.push(expiring_days);
    }
    
    sql += ' ORDER BY il.expiration_date ASC NULLS LAST, il.received_date DESC';
    
    const lots = db.prepare(sql).all(...params);
    res.json({ success: true, lots });
  } catch (err) {
    console.error('Error listing lots:', err);
    res.status(500).json({ error: true, message: 'Error al listar lotes' });
  }
});

// GET /api/inventory/lots/expiring - Lotes próximos a vencer
router.get('/lots/expiring', authMiddleware, (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const lots = db.prepare(`
      SELECT il.*, p.name as product_name, p.unit
      FROM inventory_lots il
      JOIN products p ON il.product_id = p.id
      WHERE il.status = 'active'
        AND il.expiration_date IS NOT NULL
        AND il.expiration_date <= date('now', '+' || ? || ' days')
        AND il.expiration_date >= date('now')
      ORDER BY il.expiration_date ASC
    `).all(days);
    
    res.json({ success: true, lots, days: parseInt(days) });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener lotes' });
  }
});

// POST /api/inventory/lots - Crear lote (entrada de inventario)
router.post('/lots', authMiddleware, requireRole('admin', 'gerente', 'inventario'), (req, res) => {
  try {
    const { product_id, batch_number, quantity, cost_per_unit, expiration_date, supplier, notes } = req.body;
    
    if (!product_id || !quantity) {
      return res.status(400).json({ error: true, message: 'Producto y cantidad son requeridos' });
    }
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: true, message: 'Producto no encontrado' });
    }
    
    const id = uuidv4();
    
    const createLot = db.transaction(() => {
      // Crear lote
      db.prepare(`
        INSERT INTO inventory_lots (id, product_id, batch_number, quantity, initial_quantity, cost_per_unit, expiration_date, supplier, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, product_id, batch_number, quantity, quantity, cost_per_unit || 0, expiration_date, supplier, notes);
      
      // Actualizar stock del producto
      const previousStock = product.stock;
      const newStock = previousStock + quantity;
      
      db.prepare('UPDATE products SET stock = ?, updated_at = datetime("now") WHERE id = ?')
        .run(newStock, product_id);
      
      // Registrar movimiento
      db.prepare(`
        INSERT INTO inventory_movements (id, product_id, lot_id, movement_type, quantity, previous_stock, new_stock, notes)
        VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?)
      `).run(uuidv4(), product_id, id, quantity, previousStock, newStock, `Entrada de lote ${batch_number || id}`);
    });
    
    createLot();
    
    const lot = db.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(id);
    res.status(201).json({ success: true, lot });
  } catch (err) {
    console.error('Error creating lot:', err);
    res.status(500).json({ error: true, message: 'Error al crear lote' });
  }
});

// PUT /api/inventory/lots/:id - Actualizar lote
router.put('/lots/:id', authMiddleware, requireRole('admin', 'gerente', 'inventario'), (req, res) => {
  try {
    const { batch_number, expiration_date, supplier, status, notes } = req.body;
    
    db.prepare(`
      UPDATE inventory_lots SET
        batch_number = COALESCE(?, batch_number),
        expiration_date = COALESCE(?, expiration_date),
        supplier = COALESCE(?, supplier),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(batch_number, expiration_date, supplier, status, notes, req.params.id);
    
    const lot = db.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(req.params.id);
    res.json({ success: true, lot });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al actualizar lote' });
  }
});

// ==================== MOVIMIENTOS DE INVENTARIO ====================

// GET /api/inventory/movements - Listar movimientos
router.get('/movements', authMiddleware, (req, res) => {
  try {
    const { product_id, type, start_date, end_date, limit = 100 } = req.query;
    
    let sql = `
      SELECT im.*, p.name as product_name, e.name as employee_name
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      LEFT JOIN employees e ON im.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    
    if (product_id) {
      sql += ' AND im.product_id = ?';
      params.push(product_id);
    }
    
    if (type) {
      sql += ' AND im.movement_type = ?';
      params.push(type);
    }
    
    if (start_date) {
      sql += ' AND DATE(im.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND DATE(im.created_at) <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY im.created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const movements = db.prepare(sql).all(...params);
    res.json({ success: true, movements });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar movimientos' });
  }
});

// POST /api/inventory/adjustment - Ajuste de inventario
router.post('/adjustment', authMiddleware, requireRole('admin', 'gerente', 'inventario'), (req, res) => {
  try {
    const { product_id, quantity, type, notes, employee_id } = req.body;
    
    if (!product_id || quantity === undefined) {
      return res.status(400).json({ error: true, message: 'Producto y cantidad son requeridos' });
    }
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: true, message: 'Producto no encontrado' });
    }
    
    const movementType = type || (quantity >= 0 ? 'ajuste' : 'merma');
    const previousStock = product.stock;
    const newStock = previousStock + quantity;
    
    if (newStock < 0) {
      return res.status(400).json({ error: true, message: 'Stock no puede ser negativo' });
    }
    
    const adjust = db.transaction(() => {
      // Actualizar stock
      db.prepare('UPDATE products SET stock = ?, updated_at = datetime("now") WHERE id = ?')
        .run(newStock, product_id);
      
      // Registrar movimiento
      db.prepare(`
        INSERT INTO inventory_movements (id, product_id, movement_type, quantity, previous_stock, new_stock, notes, employee_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), product_id, movementType, Math.abs(quantity), previousStock, newStock, notes, employee_id);
    });
    
    adjust();
    
    res.json({ 
      success: true, 
      product_id,
      previous_stock: previousStock,
      new_stock: newStock,
      adjustment: quantity
    });
  } catch (err) {
    console.error('Error in inventory adjustment:', err);
    res.status(500).json({ error: true, message: 'Error en ajuste de inventario' });
  }
});

// ==================== RECETAS ====================

// GET /api/inventory/recipes - Listar recetas
router.get('/recipes', authMiddleware, (req, res) => {
  try {
    const recipes = db.prepare(`
      SELECT r.*, p.name as product_name, p.unit as product_unit
      FROM recipes r
      JOIN products p ON r.product_id = p.id
      WHERE r.active = 1
      ORDER BY p.name
    `).all();
    
    // Obtener ingredientes de cada receta
    const getIngredients = db.prepare(`
      SELECT ri.*, p.name as ingredient_name, p.unit as ingredient_unit, p.stock as available_stock
      FROM recipe_ingredients ri
      JOIN products p ON ri.ingredient_id = p.id
      WHERE ri.recipe_id = ?
    `);
    
    for (const recipe of recipes) {
      recipe.ingredients = getIngredients.all(recipe.id);
    }
    
    res.json({ success: true, recipes });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar recetas' });
  }
});

// GET /api/inventory/recipes/:id
router.get('/recipes/:id', authMiddleware, (req, res) => {
  try {
    const recipe = db.prepare(`
      SELECT r.*, p.name as product_name
      FROM recipes r
      JOIN products p ON r.product_id = p.id
      WHERE r.id = ?
    `).get(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({ error: true, message: 'Receta no encontrada' });
    }
    
    recipe.ingredients = db.prepare(`
      SELECT ri.*, p.name as ingredient_name, p.unit, p.stock as available_stock, p.cost
      FROM recipe_ingredients ri
      JOIN products p ON ri.ingredient_id = p.id
      WHERE ri.recipe_id = ?
    `).all(recipe.id);
    
    res.json({ success: true, recipe });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener receta' });
  }
});

// POST /api/inventory/recipes - Crear receta
router.post('/recipes', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { product_id, name, yield_quantity, instructions, prep_time_minutes, ingredients } = req.body;
    
    if (!product_id || !name || !ingredients || ingredients.length === 0) {
      return res.status(400).json({ error: true, message: 'Datos incompletos' });
    }
    
    const id = uuidv4();
    
    const createRecipe = db.transaction(() => {
      // Crear receta
      db.prepare(`
        INSERT INTO recipes (id, product_id, name, yield_quantity, instructions, prep_time_minutes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, product_id, name, yield_quantity || 1, instructions, prep_time_minutes);
      
      // Agregar ingredientes
      const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (const ing of ingredients) {
        insertIngredient.run(uuidv4(), id, ing.ingredient_id, ing.quantity, ing.unit, ing.notes);
      }
      
      // Marcar producto como manufacturado
      db.prepare('UPDATE products SET is_manufactured = 1 WHERE id = ?').run(product_id);
    });
    
    createRecipe();
    
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
    recipe.ingredients = db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ?').all(id);
    
    res.status(201).json({ success: true, recipe });
  } catch (err) {
    console.error('Error creating recipe:', err);
    res.status(500).json({ error: true, message: 'Error al crear receta' });
  }
});

// ==================== PRODUCCIÓN ====================

// GET /api/inventory/production - Listar órdenes de producción
router.get('/production', authMiddleware, (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let sql = `
      SELECT po.*, r.name as recipe_name, p.name as product_name, e.name as employee_name
      FROM production_orders po
      JOIN recipes r ON po.recipe_id = r.id
      JOIN products p ON r.product_id = p.id
      LEFT JOIN employees e ON po.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND po.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY po.created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const orders = db.prepare(sql).all(...params);
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar órdenes' });
  }
});

// POST /api/inventory/production - Crear orden de producción
router.post('/production', authMiddleware, requireRole('admin', 'gerente', 'inventario'), (req, res) => {
  try {
    const { recipe_id, quantity_to_produce, scheduled_date, employee_id, notes } = req.body;
    
    if (!recipe_id || !quantity_to_produce) {
      return res.status(400).json({ error: true, message: 'Receta y cantidad son requeridos' });
    }
    
    const recipe = db.prepare(`
      SELECT r.*, p.name as product_name
      FROM recipes r
      JOIN products p ON r.product_id = p.id
      WHERE r.id = ?
    `).get(recipe_id);
    
    if (!recipe) {
      return res.status(404).json({ error: true, message: 'Receta no encontrada' });
    }
    
    // Verificar disponibilidad de ingredientes
    const ingredients = db.prepare(`
      SELECT ri.*, p.name as ingredient_name, p.stock
      FROM recipe_ingredients ri
      JOIN products p ON ri.ingredient_id = p.id
      WHERE ri.recipe_id = ?
    `).all(recipe_id);
    
    const multiplier = quantity_to_produce / recipe.yield_quantity;
    const insufficientIngredients = [];
    
    for (const ing of ingredients) {
      const required = ing.quantity * multiplier;
      if (ing.stock < required) {
        insufficientIngredients.push({
          name: ing.ingredient_name,
          required,
          available: ing.stock,
          shortage: required - ing.stock
        });
      }
    }
    
    if (insufficientIngredients.length > 0) {
      return res.status(400).json({
        error: true,
        message: 'Ingredientes insuficientes',
        insufficientIngredients
      });
    }
    
    const id = uuidv4();
    db.prepare(`
      INSERT INTO production_orders (id, recipe_id, quantity_to_produce, scheduled_date, employee_id, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, recipe_id, quantity_to_produce, scheduled_date, employee_id, notes);
    
    const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(id);
    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('Error creating production order:', err);
    res.status(500).json({ error: true, message: 'Error al crear orden' });
  }
});

// POST /api/inventory/production/:id/complete - Completar producción (Transformación de Stock)
router.post('/production/:id/complete', authMiddleware, requireRole('admin', 'gerente', 'inventario'), (req, res) => {
  try {
    const { quantity_produced, notes } = req.body;
    
    const order = db.prepare(`
      SELECT po.*, r.product_id, r.yield_quantity
      FROM production_orders po
      JOIN recipes r ON po.recipe_id = r.id
      WHERE po.id = ?
    `).get(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: true, message: 'Orden no encontrada' });
    }
    
    if (order.status === 'completed') {
      return res.status(400).json({ error: true, message: 'Orden ya completada' });
    }
    
    const finalQuantity = quantity_produced || order.quantity_to_produce;
    const multiplier = finalQuantity / order.yield_quantity;
    
    const completeProduction = db.transaction(() => {
      // Obtener ingredientes y descontar
      const ingredients = db.prepare(`
        SELECT ri.*, p.stock
        FROM recipe_ingredients ri
        JOIN products p ON ri.ingredient_id = p.id
        WHERE ri.recipe_id = ?
      `).all(order.recipe_id);
      
      for (const ing of ingredients) {
        const consumed = ing.quantity * multiplier;
        const newStock = ing.stock - consumed;
        
        // Descontar materia prima
        db.prepare('UPDATE products SET stock = ?, updated_at = datetime("now") WHERE id = ?')
          .run(newStock, ing.ingredient_id);
        
        // Registrar movimiento de salida
        db.prepare(`
          INSERT INTO inventory_movements (id, product_id, movement_type, quantity, previous_stock, new_stock, reference_type, reference_id, notes)
          VALUES (?, ?, 'produccion', ?, ?, ?, 'production_order', ?, ?)
        `).run(uuidv4(), ing.ingredient_id, consumed, ing.stock, newStock, order.id, `Producción: ${finalQuantity} unidades`);
      }
      
      // Agregar producto terminado
      const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(order.product_id);
      const newProductStock = product.stock + finalQuantity;
      
      db.prepare('UPDATE products SET stock = ?, updated_at = datetime("now") WHERE id = ?')
        .run(newProductStock, order.product_id);
      
      // Registrar movimiento de entrada
      db.prepare(`
        INSERT INTO inventory_movements (id, product_id, movement_type, quantity, previous_stock, new_stock, reference_type, reference_id, notes)
        VALUES (?, ?, 'produccion', ?, ?, ?, 'production_order', ?, ?)
      `).run(uuidv4(), order.product_id, finalQuantity, product.stock, newProductStock, order.id, 'Producción completada');
      
      // Actualizar orden
      db.prepare(`
        UPDATE production_orders SET
          quantity_produced = ?,
          status = 'completed',
          completed_at = datetime('now'),
          notes = COALESCE(?, notes)
        WHERE id = ?
      `).run(finalQuantity, notes, order.id);
    });
    
    completeProduction();
    
    const completedOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id);
    res.json({ success: true, order: completedOrder });
  } catch (err) {
    console.error('Error completing production:', err);
    res.status(500).json({ error: true, message: 'Error al completar producción' });
  }
});

// GET /api/inventory/summary - Resumen de inventario
router.get('/summary', authMiddleware, (req, res) => {
  try {
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1').get();
    const lowStockCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1 AND stock <= min_stock').get();
    const totalValue = db.prepare('SELECT SUM(stock * cost) as value FROM products WHERE active = 1').get();
    
    const expiringLots = db.prepare(`
      SELECT COUNT(*) as count FROM inventory_lots 
      WHERE status = 'active' AND expiration_date <= date('now', '+7 days') AND expiration_date >= date('now')
    `).get();
    
    const pendingProduction = db.prepare(`
      SELECT COUNT(*) as count FROM production_orders WHERE status IN ('pending', 'in_progress')
    `).get();
    
    const recentMovements = db.prepare(`
      SELECT im.*, p.name as product_name
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      ORDER BY im.created_at DESC
      LIMIT 10
    `).all();
    
    res.json({
      success: true,
      summary: {
        total_products: totalProducts.count,
        low_stock_count: lowStockCount.count,
        total_value: totalValue.value || 0,
        expiring_lots: expiringLots.count,
        pending_production: pendingProduction.count
      },
      recent_movements: recentMovements
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener resumen' });
  }
});

export default router;
