/**
 * GENESIS - Sentinel Routes
 * API endpoints para el sistema de monitoreo Centinela
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from './auth.js';

const router = Router();

// Importar servicio (usando require para compatibilidad)
let SentinelService;
try {
  SentinelService = require('../services/SentinelService.js');
} catch (e) {
  console.log('SentinelService will be loaded dynamically');
}

// GET /api/sentinel/diagnostic - Diagnóstico completo
router.get('/diagnostic', authMiddleware, async (req, res) => {
  try {
    if (!SentinelService) {
      SentinelService = require('../services/SentinelService.js');
    }
    const diagnostic = await SentinelService.runFullDiagnostic();
    res.json({ success: true, diagnostic });
  } catch (error) {
    console.error('Sentinel diagnostic error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error ejecutando diagnóstico',
      diagnostic: {
        overallStatus: 'red',
        checks: [],
        alerts: [{ type: 'system', severity: 'critical', message: error.message }]
      }
    });
  }
});

// GET /api/sentinel/status - Estado rápido (para polling)
router.get('/status', authMiddleware, async (req, res) => {
  try {
    if (!SentinelService) {
      SentinelService = require('../services/SentinelService.js');
    }
    
    // Ejecutar checks críticos solamente
    const accountingCheck = await SentinelService.checkAccountingEquation();
    const stockCheck = await SentinelService.checkCriticalStock();
    
    let status = 'green';
    if (accountingCheck.status === 'red' || stockCheck.status === 'red') {
      status = 'red';
    } else if (accountingCheck.status === 'yellow' || stockCheck.status === 'yellow') {
      status = 'yellow';
    }

    res.json({ 
      success: true, 
      status,
      quickChecks: {
        accounting: accountingCheck.status,
        stock: stockCheck.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ success: true, status: 'yellow', timestamp: new Date().toISOString() });
  }
});

// GET /api/sentinel/alerts - Historial de alertas
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    if (!SentinelService) {
      SentinelService = require('../services/SentinelService.js');
    }
    const limit = parseInt(req.query.limit) || 50;
    const alerts = await SentinelService.getAlertHistory(limit);
    res.json({ success: true, alerts });
  } catch (error) {
    res.json({ success: true, alerts: [] });
  }
});

// POST /api/sentinel/alerts/:id/acknowledge - Marcar alerta como vista
router.post('/alerts/:id/acknowledge', authMiddleware, async (req, res) => {
  try {
    if (!SentinelService) {
      SentinelService = require('../services/SentinelService.js');
    }
    const result = await SentinelService.acknowledgeAlert(req.params.id);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/sentinel/metrics - Métricas del sistema
router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    if (!SentinelService) {
      SentinelService = require('../services/SentinelService.js');
    }
    const metrics = await SentinelService.getSystemMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
