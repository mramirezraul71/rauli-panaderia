/**
 * GENESIS - Sentinel Routes
 * API endpoints for health monitoring.
 */

import { Router } from 'express';
import { authMiddleware } from './auth.js';
import * as SentinelService from '../services/SentinelService.js';

const router = Router();

const quickStatus = async () => {
  const accountingCheck = await SentinelService.checkAccountingEquation();
  const stockCheck = await SentinelService.checkCriticalStock();

  let status = 'green';
  if (accountingCheck.status === 'red' || stockCheck.status === 'red') {
    status = 'red';
  } else if (accountingCheck.status === 'yellow' || stockCheck.status === 'yellow') {
    status = 'yellow';
  }

  return {
    status,
    quickChecks: {
      accounting: accountingCheck.status,
      stock: stockCheck.status
    }
  };
};

// GET /api/sentinel/health - Cheap health endpoint (no auth)
router.get('/health', async (_req, res) => {
  try {
    const result = await quickStatus();
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch {
    res.json({ success: true, status: 'yellow', timestamp: new Date().toISOString() });
  }
});

// GET /api/sentinel/diagnostic - Full diagnostic
router.get('/diagnostic', authMiddleware, async (_req, res) => {
  try {
    const diagnostic = await SentinelService.runFullDiagnostic();
    res.json({ success: true, diagnostic });
  } catch (error) {
    console.error('Sentinel diagnostic error:', error);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando diagnostico',
      diagnostic: {
        overallStatus: 'red',
        checks: [],
        alerts: [{ type: 'system', severity: 'critical', message: error.message }]
      }
    });
  }
});

// GET /api/sentinel/status - Quick poll status
router.get('/status', authMiddleware, async (_req, res) => {
  try {
    const result = await quickStatus();
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch {
    res.json({ success: true, status: 'yellow', timestamp: new Date().toISOString() });
  }
});

// GET /api/sentinel/alerts - Alert history
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const alerts = await SentinelService.getAlertHistory(limit);
    res.json({ success: true, alerts });
  } catch {
    res.json({ success: true, alerts: [] });
  }
});

// POST /api/sentinel/alerts/:id/acknowledge - Ack alert
router.post('/alerts/:id/acknowledge', authMiddleware, async (req, res) => {
  try {
    const result = await SentinelService.acknowledgeAlert(req.params.id);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/sentinel/metrics - System metrics
router.get('/metrics', authMiddleware, async (_req, res) => {
  try {
    const metrics = await SentinelService.getSystemMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
