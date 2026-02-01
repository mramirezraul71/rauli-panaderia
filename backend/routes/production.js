import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

const RECIPES_FILE = path.join(__dirname, '../data/recipes.json');
const PRODUCTS_FILE = path.join(__dirname, '../data/products.json');
const PRODUCTION_FILE = path.join(__dirname, '../data/production_orders.json');

// ══════════════════════════════════════════════════════════════════════════════
// GET ALL RECIPES
// ══════════════════════════════════════════════════════════════════════════════
router.get('/recipes', async (req, res) => {
  try {
    const data = await fs.readFile(RECIPES_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.json([]);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CREATE NEW RECIPE
// ══════════════════════════════════════════════════════════════════════════════
router.post('/recipes', async (req, res) => {
  try {
    let recipes = [];
    try {
      const data = await fs.readFile(RECIPES_FILE, 'utf8');
      recipes = JSON.parse(data);
    } catch (e) {}

    const newRecipe = {
      id: `REC-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    recipes.push(newRecipe);
    await fs.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2));
    res.status(201).json(newRecipe);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE RECIPE
// ══════════════════════════════════════════════════════════════════════════════
router.put('/recipes/:id', async (req, res) => {
  try {
    const data = await fs.readFile(RECIPES_FILE, 'utf8');
    let recipes = JSON.parse(data);

    const index = recipes.findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }

    recipes[index] = {
      ...recipes[index],
      ...req.body,
      id: req.params.id, // Mantener el ID original
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2));
    res.json(recipes[index]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE RECIPE
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/recipes/:id', async (req, res) => {
  try {
    const data = await fs.readFile(RECIPES_FILE, 'utf8');
    let recipes = JSON.parse(data);

    recipes = recipes.filter(r => r.id !== req.params.id);

    await fs.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET ALL PRODUCTION ORDERS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/production-orders', async (req, res) => {
  try {
    const data = await fs.readFile(PRODUCTION_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.json([]);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CREATE PRODUCTION ORDER (WITH EVIDENCE SUPPORT)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/production-orders', async (req, res) => {
  try {
    const newOrder = {
      id: `PROD-${Date.now()}`,
      orderType: req.body.orderType || "recipe",
      recipeId: req.body.recipeId,
      referenceName: req.body.referenceName,
      quantity: req.body.quantity,
      unit: req.body.unit,
      productionDate: req.body.productionDate,
      costCenter: req.body.costCenter,
      projectOrClient: req.body.projectOrClient,
      priority: req.body.priority,
      dueDate: req.body.dueDate,
      notes: req.body.notes,
      evidences: req.body.evidences || [], // ⭐ Soporte para evidencias
      status: 'completed',
      createdAt: new Date().toISOString(),
      createdBy: req.body.userId || 'system'
    };

    let orders = [];
    try {
      const data = await fs.readFile(PRODUCTION_FILE, 'utf8');
      orders = JSON.parse(data);
    } catch (e) {}

    orders.push(newOrder);
    await fs.writeFile(PRODUCTION_FILE, JSON.stringify(orders, null, 2));
    
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET SINGLE PRODUCTION ORDER
// ══════════════════════════════════════════════════════════════════════════════
router.get('/production-orders/:id', async (req, res) => {
  try {
    const data = await fs.readFile(PRODUCTION_FILE, 'utf8');
    const orders = JSON.parse(data);
    const order = orders.find(o => o.id === req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;