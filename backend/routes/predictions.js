/**
 * GENESIS - Predictions & AI Routes
 * Predicciones de ventas y análisis con IA
 */

import { Router } from 'express';
import db from '../database/connection.js';
import { authMiddleware, requireRole } from './auth.js';

const router = Router();

// Configuración de Ollama (LLM local)
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// ==================== PREDICCIÓN DE VENTAS ====================

// GET /api/predictions/sales/forecast - Predicción de ventas
router.get('/sales/forecast', authMiddleware, (req, res) => {
  try {
    const { days = 7, product_id } = req.query;
    
    // Obtener datos históricos (últimos 90 días)
    let sql = `
      SELECT 
        DATE(s.created_at) as date,
        strftime('%w', s.created_at) as day_of_week,
        si.product_id,
        p.name as product_name,
        SUM(si.quantity) as quantity_sold,
        SUM(si.subtotal) as revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed' 
        AND DATE(s.created_at) >= date('now', '-90 days')
    `;
    const params = [];
    
    if (product_id) {
      sql += ' AND si.product_id = ?';
      params.push(product_id);
    }
    
    sql += ' GROUP BY DATE(s.created_at), si.product_id ORDER BY date';
    
    const historicalData = db.prepare(sql).all(...params);
    
    // Calcular promedios por día de la semana
    const dayAverages = calculateDayAverages(historicalData);
    
    // Generar predicciones
    const predictions = generatePredictions(dayAverages, parseInt(days));
    
    // Calcular producción sugerida
    const productionSuggestions = calculateProductionSuggestions(predictions);
    
    res.json({
      success: true,
      forecast: {
        period_days: parseInt(days),
        predictions,
        production_suggestions: productionSuggestions,
        confidence: calculateConfidence(historicalData),
        based_on_days: historicalData.length > 0 ? 
          [...new Set(historicalData.map(h => h.date))].length : 0
      }
    });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ error: true, message: 'Error al generar predicción' });
  }
});

// GET /api/predictions/sales/trends - Tendencias de ventas
router.get('/sales/trends', authMiddleware, (req, res) => {
  try {
    // Ventas por semana (últimas 12 semanas)
    const weeklyTrend = db.prepare(`
      SELECT 
        strftime('%Y-%W', created_at) as week,
        COUNT(*) as transactions,
        SUM(total) as revenue,
        AVG(total) as avg_ticket
      FROM sales
      WHERE status = 'completed' AND created_at >= date('now', '-84 days')
      GROUP BY week
      ORDER BY week
    `).all();
    
    // Calcular tendencia (regresión lineal simple)
    const trend = calculateTrend(weeklyTrend.map(w => w.revenue));
    
    // Productos con tendencia al alza
    const risingProducts = db.prepare(`
      SELECT 
        si.product_id,
        p.name as product_name,
        SUM(CASE WHEN DATE(s.created_at) >= date('now', '-7 days') THEN si.quantity ELSE 0 END) as last_week,
        SUM(CASE WHEN DATE(s.created_at) >= date('now', '-14 days') AND DATE(s.created_at) < date('now', '-7 days') THEN si.quantity ELSE 0 END) as prev_week,
        CASE 
          WHEN SUM(CASE WHEN DATE(s.created_at) >= date('now', '-14 days') AND DATE(s.created_at) < date('now', '-7 days') THEN si.quantity ELSE 0 END) > 0
          THEN ((SUM(CASE WHEN DATE(s.created_at) >= date('now', '-7 days') THEN si.quantity ELSE 0 END) - 
                 SUM(CASE WHEN DATE(s.created_at) >= date('now', '-14 days') AND DATE(s.created_at) < date('now', '-7 days') THEN si.quantity ELSE 0 END)) /
                SUM(CASE WHEN DATE(s.created_at) >= date('now', '-14 days') AND DATE(s.created_at) < date('now', '-7 days') THEN si.quantity ELSE 0 END)) * 100
          ELSE 0
        END as growth_percent
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed' AND DATE(s.created_at) >= date('now', '-14 days')
      GROUP BY si.product_id
      HAVING last_week > 0 OR prev_week > 0
      ORDER BY growth_percent DESC
      LIMIT 10
    `).all();
    
    res.json({
      success: true,
      trends: {
        weekly: weeklyTrend,
        overall_trend: trend,
        rising_products: risingProducts
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al analizar tendencias' });
  }
});

// ==================== PREDICCIÓN DE INVENTARIO ====================

// GET /api/predictions/inventory/reorder - Sugerencias de reorden
router.get('/inventory/reorder', authMiddleware, (req, res) => {
  try {
    const { days_forecast = 14 } = req.query;
    
    // Calcular velocidad de venta por producto
    const salesVelocity = db.prepare(`
      SELECT 
        p.id as product_id,
        p.name,
        p.stock as current_stock,
        p.min_stock,
        p.cost,
        COALESCE(AVG(daily_sales.quantity), 0) as avg_daily_sales
      FROM products p
      LEFT JOIN (
        SELECT 
          si.product_id,
          DATE(s.created_at) as date,
          SUM(si.quantity) as quantity
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.status = 'completed' AND DATE(s.created_at) >= date('now', '-30 days')
        GROUP BY si.product_id, DATE(s.created_at)
      ) daily_sales ON p.id = daily_sales.product_id
      WHERE p.active = 1
      GROUP BY p.id
    `).all();
    
    // Calcular días de stock restante y necesidad de reorden
    const reorderSuggestions = salesVelocity.map(p => {
      const daysOfStock = p.avg_daily_sales > 0 
        ? Math.floor(p.current_stock / p.avg_daily_sales) 
        : 999;
      const projectedNeed = p.avg_daily_sales * parseInt(days_forecast);
      const reorderQuantity = Math.max(0, projectedNeed - p.current_stock + p.min_stock);
      
      return {
        ...p,
        days_of_stock: daysOfStock,
        projected_need: Math.ceil(projectedNeed),
        suggested_reorder: Math.ceil(reorderQuantity),
        estimated_cost: Math.ceil(reorderQuantity * p.cost),
        urgency: daysOfStock <= 3 ? 'critical' : daysOfStock <= 7 ? 'high' : daysOfStock <= 14 ? 'medium' : 'low'
      };
    }).filter(p => p.suggested_reorder > 0)
      .sort((a, b) => a.days_of_stock - b.days_of_stock);
    
    const totalCost = reorderSuggestions.reduce((sum, p) => sum + p.estimated_cost, 0);
    
    res.json({
      success: true,
      forecast_days: parseInt(days_forecast),
      suggestions: reorderSuggestions,
      summary: {
        products_to_reorder: reorderSuggestions.length,
        critical: reorderSuggestions.filter(p => p.urgency === 'critical').length,
        high: reorderSuggestions.filter(p => p.urgency === 'high').length,
        total_estimated_cost: totalCost
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar sugerencias' });
  }
});

// ==================== ANÁLISIS CON IA (OLLAMA) ====================

// POST /api/predictions/ai/analyze - Análisis con LLM local
router.post('/ai/analyze', authMiddleware, requireRole('admin', 'gerente'), async (req, res) => {
  try {
    const { query, context_type = 'sales' } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: true, message: 'Query requerida' });
    }
    
    // Obtener contexto según el tipo
    const context = await getAnalysisContext(context_type);
    
    // Construir prompt
    const prompt = buildAnalysisPrompt(query, context);
    
    // Intentar llamar a Ollama
    try {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 500
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return res.json({
          success: true,
          analysis: data.response,
          model: OLLAMA_MODEL,
          context_type
        });
      }
    } catch (ollamaErr) {
      console.log('Ollama no disponible, usando análisis básico');
    }
    
    // Fallback: análisis básico sin IA
    const basicAnalysis = generateBasicAnalysis(query, context);
    res.json({
      success: true,
      analysis: basicAnalysis,
      model: 'basic',
      context_type,
      note: 'Ollama no disponible, usando análisis básico'
    });
  } catch (err) {
    console.error('AI analysis error:', err);
    res.status(500).json({ error: true, message: 'Error en análisis' });
  }
});

// GET /api/predictions/ai/suggestions - Sugerencias automáticas
router.get('/ai/suggestions', authMiddleware, (req, res) => {
  try {
    const suggestions = [];
    
    // Verificar stock bajo
    const lowStock = db.prepare(`
      SELECT COUNT(*) as count FROM products WHERE active = 1 AND stock <= min_stock
    `).get();
    if (lowStock.count > 0) {
      suggestions.push({
        type: 'inventory',
        priority: 'high',
        message: `${lowStock.count} producto(s) con stock bajo. Considere reordenar.`,
        action: '/reports/inventory/stock?status=low'
      });
    }
    
    // Verificar lotes por vencer
    const expiringLots = db.prepare(`
      SELECT COUNT(*) as count FROM inventory_lots 
      WHERE status = 'active' AND expiration_date <= date('now', '+7 days') AND expiration_date >= date('now')
    `).get();
    if (expiringLots.count > 0) {
      suggestions.push({
        type: 'inventory',
        priority: 'high',
        message: `${expiringLots.count} lote(s) vencen en los próximos 7 días.`,
        action: '/reports/inventory/expiring'
      });
    }
    
    // Verificar comisiones pendientes
    const pendingCommissions = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM commissions WHERE status = 'pending'
    `).get();
    if (pendingCommissions.total > 0) {
      suggestions.push({
        type: 'hr',
        priority: 'medium',
        message: `$${pendingCommissions.total.toFixed(2)} en comisiones pendientes de aprobar.`,
        action: '/employees/commissions'
      });
    }
    
    // Verificar productos más vendidos hoy vs promedio
    const todaySales = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM sales 
      WHERE DATE(created_at) = DATE('now') AND status = 'completed'
    `).get();
    const avgDailySales = db.prepare(`
      SELECT COALESCE(AVG(daily_total), 0) as avg FROM (
        SELECT DATE(created_at) as date, SUM(total) as daily_total
        FROM sales WHERE status = 'completed' AND DATE(created_at) >= date('now', '-30 days')
        GROUP BY DATE(created_at)
      )
    `).get();
    
    if (todaySales.total > avgDailySales.avg * 1.2) {
      suggestions.push({
        type: 'sales',
        priority: 'info',
        message: `¡Día excepcional! Ventas 20% superiores al promedio.`,
        action: '/reports/sales/daily'
      });
    }
    
    // Sugerir producción basada en día de la semana
    const dayOfWeek = new Date().getDay();
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const avgByDay = db.prepare(`
      SELECT si.product_id, p.name, AVG(si.quantity) as avg_qty
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed' 
        AND strftime('%w', s.created_at) = ?
        AND DATE(s.created_at) >= date('now', '-60 days')
      GROUP BY si.product_id
      ORDER BY avg_qty DESC
      LIMIT 5
    `).all(dayOfWeek.toString());
    
    if (avgByDay.length > 0) {
      suggestions.push({
        type: 'production',
        priority: 'info',
        message: `Para ${dayNames[dayOfWeek]}, los productos más vendidos son: ${avgByDay.map(p => p.name).join(', ')}.`,
        action: '/predictions/sales/forecast'
      });
    }
    
    res.json({ success: true, suggestions });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar sugerencias' });
  }
});

// ==================== FUNCIONES AUXILIARES ====================

function calculateDayAverages(data) {
  const dayTotals = {};
  const dayCounts = {};
  
  for (const row of data) {
    const key = `${row.product_id}-${row.day_of_week}`;
    if (!dayTotals[key]) {
      dayTotals[key] = 0;
      dayCounts[key] = 0;
    }
    dayTotals[key] += row.quantity_sold;
    dayCounts[key]++;
  }
  
  const averages = {};
  for (const key of Object.keys(dayTotals)) {
    averages[key] = {
      avg: dayTotals[key] / dayCounts[key],
      count: dayCounts[key]
    };
  }
  
  return averages;
}

function generatePredictions(dayAverages, numDays) {
  const predictions = [];
  const today = new Date();
  
  for (let i = 1; i <= numDays; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay().toString();
    
    // Agrupar por producto
    const dayPredictions = {};
    for (const [key, value] of Object.entries(dayAverages)) {
      const [productId, dow] = key.split('-');
      if (dow === dayOfWeek) {
        if (!dayPredictions[productId]) {
          dayPredictions[productId] = { quantity: 0, count: 0 };
        }
        dayPredictions[productId].quantity += value.avg;
        dayPredictions[productId].count++;
      }
    }
    
    predictions.push({
      date: date.toISOString().split('T')[0],
      day_of_week: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][date.getDay()],
      products: Object.entries(dayPredictions).map(([id, val]) => ({
        product_id: id,
        predicted_quantity: Math.round(val.quantity)
      }))
    });
  }
  
  return predictions;
}

function calculateProductionSuggestions(predictions) {
  const productTotals = {};
  
  for (const day of predictions) {
    for (const prod of day.products) {
      if (!productTotals[prod.product_id]) {
        productTotals[prod.product_id] = 0;
      }
      productTotals[prod.product_id] += prod.predicted_quantity;
    }
  }
  
  // Obtener nombres de productos y stock actual
  const suggestions = [];
  for (const [productId, total] of Object.entries(productTotals)) {
    const product = db.prepare('SELECT name, stock FROM products WHERE id = ?').get(productId);
    if (product) {
      const needed = Math.max(0, total - product.stock);
      if (needed > 0) {
        suggestions.push({
          product_id: productId,
          product_name: product.name,
          current_stock: product.stock,
          predicted_demand: total,
          suggested_production: Math.ceil(needed * 1.1) // 10% buffer
        });
      }
    }
  }
  
  return suggestions.sort((a, b) => b.suggested_production - a.suggested_production);
}

function calculateConfidence(data) {
  if (data.length < 7) return 'baja';
  if (data.length < 30) return 'media';
  if (data.length < 60) return 'alta';
  return 'muy_alta';
}

function calculateTrend(values) {
  if (values.length < 2) return { direction: 'stable', change: 0 };
  
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgY = sumY / n;
  const changePercent = avgY !== 0 ? (slope / avgY) * 100 : 0;
  
  return {
    direction: slope > 0.5 ? 'up' : slope < -0.5 ? 'down' : 'stable',
    change_percent: changePercent.toFixed(2),
    slope: slope.toFixed(2)
  };
}

async function getAnalysisContext(type) {
  switch (type) {
    case 'sales':
      return {
        today: db.prepare(`
          SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
          FROM sales WHERE DATE(created_at) = DATE('now') AND status = 'completed'
        `).get(),
        week: db.prepare(`
          SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
          FROM sales WHERE DATE(created_at) >= date('now', '-7 days') AND status = 'completed'
        `).get(),
        topProducts: db.prepare(`
          SELECT p.name, SUM(si.quantity) as qty
          FROM sale_items si
          JOIN products p ON si.product_id = p.id
          JOIN sales s ON si.sale_id = s.id
          WHERE DATE(s.created_at) >= date('now', '-7 days') AND s.status = 'completed'
          GROUP BY si.product_id
          ORDER BY qty DESC
          LIMIT 5
        `).all()
      };
    case 'inventory':
      return {
        lowStock: db.prepare(`SELECT name, stock, min_stock FROM products WHERE stock <= min_stock AND active = 1`).all(),
        totalValue: db.prepare(`SELECT SUM(stock * cost) as value FROM products WHERE active = 1`).get()
      };
    default:
      return {};
  }
}

function buildAnalysisPrompt(query, context) {
  return `Eres un asistente de análisis de negocio para cualquier tipo de empresa. 
Analiza los siguientes datos y responde la pregunta del usuario de forma concisa y útil.

Datos del negocio:
${JSON.stringify(context, null, 2)}

Pregunta del usuario: ${query}

Responde en español, de forma clara y con recomendaciones prácticas si aplica.`;
}

function generateBasicAnalysis(query, context) {
  const queryLower = query.toLowerCase();
  
  if (queryLower.includes('venta') || queryLower.includes('vender')) {
    if (context.today) {
      return `Hoy se han realizado ${context.today.count} ventas por un total de $${context.today.total.toFixed(2)}. ` +
        `Esta semana: ${context.week.count} ventas totalizando $${context.week.total.toFixed(2)}. ` +
        `Los productos más vendidos son: ${context.topProducts?.map(p => p.name).join(', ') || 'No disponible'}.`;
    }
  }
  
  if (queryLower.includes('inventario') || queryLower.includes('stock')) {
    if (context.lowStock) {
      const lowItems = context.lowStock.slice(0, 5).map(p => p.name).join(', ');
      return `Hay ${context.lowStock.length} productos con stock bajo: ${lowItems}. ` +
        `Valor total del inventario: $${context.totalValue?.value?.toFixed(2) || '0'}.`;
    }
  }
  
  return 'Análisis básico no disponible para esta consulta. Intente con preguntas sobre ventas o inventario.';
}

export default router;
