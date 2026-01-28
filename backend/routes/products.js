/**
 * GENESIS - Products Routes
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';
import { authMiddleware, requireRole } from './auth.js';

const router = Router();

// GET /api/products - Listar productos
router.get('/', (req, res) => {
  try {
    const { category, search, active = '1' } = req.query;
    
    let sql = `
      SELECT p.*, c.name as category_name, c.color as category_color
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    
    if (active !== 'all') {
      sql += ' AND p.active = ?';
      params.push(parseInt(active));
    }
    
    if (category) {
      sql += ' AND p.category_id = ?';
      params.push(category);
    }
    
    if (search) {
      sql += ' AND (p.name LIKE ? OR p.barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    sql += ' ORDER BY c.sort_order, p.name';
    
    const products = db.prepare(sql).all(...params);
    res.json({ success: true, products });
  } catch (err) {
    console.error('Error listing products:', err);
    res.status(500).json({ error: true, message: 'Error al listar productos' });
  }
});

// GET /api/products/categories - Listar categorías
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.active = 1
      WHERE c.active = 1
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `).all();
    
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar categorías' });
  }
});

// GET /api/products/low-stock - Productos con stock bajo
router.get('/low-stock', authMiddleware, (req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1 AND p.stock <= p.min_stock
      ORDER BY (p.stock / NULLIF(p.min_stock, 0))
    `).all();
    
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener productos' });
  }
});

// GET /api/products/:id - Obtener producto
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, c.name as category_name, c.color as category_color
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: true, message: 'Producto no encontrado' });
    }
    
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener producto' });
  }
});

// GET /api/products/barcode/:code - Buscar por código de barras
router.get('/barcode/:code', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.barcode = ? AND p.active = 1
    `).get(req.params.code);
    
    if (!product) {
      return res.status(404).json({ error: true, message: 'Producto no encontrado' });
    }
    
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al buscar producto' });
  }
});

// POST /api/products - Crear producto
router.post('/', authMiddleware, requireRole('admin', 'gerente', 'inventario'), (req, res) => {
  try {
    const { name, description, category_id, price, cost, stock, min_stock, unit, barcode, is_manufactured, image_url } = req.body;
    
    if (!name || price === undefined) {
      return res.status(400).json({ error: true, message: 'Nombre y precio son requeridos' });
    }
    
    // Verificar barcode único
    if (barcode) {
      const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
      if (existing) {
        return res.status(400).json({ error: true, message: 'Código de barras ya existe' });
      }
    }
    
    const id = uuidv4();
    db.prepare(`
      INSERT INTO products (id, name, description, category_id, price, cost, stock, min_stock, unit, barcode, is_manufactured, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description || null, category_id || null, price, cost || 0, stock || 0, min_stock || 0, unit || 'unidad', barcode || null, is_manufactured ? 1 : 0, image_url || null);
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: true, message: 'Error al crear producto' });
  }
});

// PUT /api/products/:id - Actualizar producto
router.put('/:id', authMiddleware, requireRole('admin', 'gerente', 'inventario'), (req, res) => {
  try {
    const { name, description, category_id, price, cost, stock, min_stock, unit, barcode, is_manufactured, active, image_url } = req.body;
    
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: true, message: 'Producto no encontrado' });
    }
    
    // Verificar barcode único
    if (barcode) {
      const duplicateBarcode = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(barcode, req.params.id);
      if (duplicateBarcode) {
        return res.status(400).json({ error: true, message: 'Código de barras ya existe' });
      }
    }
    
    db.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        category_id = COALESCE(?, category_id),
        price = COALESCE(?, price),
        cost = COALESCE(?, cost),
        stock = COALESCE(?, stock),
        min_stock = COALESCE(?, min_stock),
        unit = COALESCE(?, unit),
        barcode = COALESCE(?, barcode),
        is_manufactured = COALESCE(?, is_manufactured),
        active = COALESCE(?, active),
        image_url = COALESCE(?, image_url),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name, description, category_id, price, cost, stock, min_stock, unit, barcode, is_manufactured, active, image_url, req.params.id);
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({ success: true, product });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: true, message: 'Error al actualizar producto' });
  }
});

// DELETE /api/products/:id - Desactivar producto
router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare('UPDATE products SET active = 0, updated_at = datetime("now") WHERE id = ?')
      .run(req.params.id);
    
    res.json({ success: true, message: 'Producto desactivado' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al desactivar producto' });
  }
});

// POST /api/products/categories - Crear categoría
router.post('/categories', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { name, description, color, icon } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: true, message: 'Nombre requerido' });
    }
    
    const id = uuidv4();
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM categories').get();
    
    db.prepare(`
      INSERT INTO categories (id, name, description, color, icon, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, description || null, color || '#6366f1', icon || 'package', (maxOrder?.max || 0) + 1);
    
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.status(201).json({ success: true, category });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al crear categoría' });
  }
});

// PUT /api/products/categories/:id
router.put('/categories/:id', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { name, description, color, icon, sort_order, active } = req.body;
    
    db.prepare(`
      UPDATE categories SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(name, description, color, icon, sort_order, active, req.params.id);
    
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json({ success: true, category });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al actualizar categoría' });
  }
});

// Bulk update para sincronización
router.post('/bulk', authMiddleware, (req, res) => {
  try {
    const { products } = req.body;
    const results = { created: 0, updated: 0, errors: [] };
    
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO products (id, name, description, category_id, price, cost, stock, min_stock, unit, barcode, is_manufactured, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    const transaction = db.transaction((items) => {
      for (const p of items) {
        try {
          const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(p.id);
          insertStmt.run(p.id, p.name, p.description, p.category_id, p.price, p.cost, p.stock, p.min_stock, p.unit, p.barcode, p.is_manufactured ? 1 : 0, p.active ?? 1);
          if (existing) results.updated++;
          else results.created++;
        } catch (err) {
          results.errors.push({ id: p.id, error: err.message });
        }
      }
    });
    
    transaction(products);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error en actualización masiva' });
  }
});

export default router;
