/**
 * GENESIS - Sentinel Service
 * Sistema de Alertas "Centinela" con Semáforo de Salud Global
 * 
 * 🟢 VERDE: Sistema estable
 * 🟡 AMARILLO: Alertas menores
 * 🔴 ROJO: Problemas críticos (bloqueantes)
 */

import localDB, { logAudit } from './dataService';
import accountingCore from '../core/AccountingCore';
import { inventory, products, accounting } from './api';

const readWithMigration = (key, legacyKey) => {
  try {
    const current = localStorage.getItem(key);
    if (current !== null) return current;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      return legacy;
    }
  } catch {}
  return null;
};

// Estados del semáforo
export const HEALTH_STATUS = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red'
};

// Tipos de alertas
export const ALERT_TYPES = {
  // Críticas (ROJO)
  ACCOUNTING_IMBALANCE: 'accounting_imbalance',
  DATA_CORRUPTION: 'data_corruption',
  MIGRATION_FAILURE: 'migration_failure',
  SYNC_CRITICAL: 'sync_critical',
  JOURNAL_IMBALANCE: 'journal_imbalance',
  INVENTORY_NEGATIVE: 'inventory_negative',
  HUMAN_FACTOR_SIGNAL: 'human_factor_signal',
  CASH_EVIDENCE_REQUIRED: 'cash_evidence_required',
  
  // Advertencias (AMARILLO)
  LOW_STOCK: 'low_stock',
  CASH_DISCREPANCY: 'cash_discrepancy',
  SALES_MISMATCH: 'sales_mismatch',
  CASH_SESSION_DRIFT: 'cash_session_drift',
  OFFLINE_PROLONGED: 'offline_prolonged',
  BACKUP_OVERDUE: 'backup_overdue',
  PENDING_SYNC: 'pending_sync',
  EXPIRING_PRODUCTS: 'expiring_products',
  BANK_PAYMENT_FAILED: 'bank_payment_failed',
  EVIDENCE_MISSING: 'evidence_missing',
  EXPENSE_MISSING_RECEIPT: 'expense_missing_receipt',
  SALE_MISSING_EVIDENCE: 'sale_missing_evidence',
  INVENTORY_EVIDENCE_MISSING: 'inventory_evidence_missing',
  PRODUCTION_EVIDENCE_MISSING: 'production_evidence_missing',
  
  // Informativos (VERDE)
  SYSTEM_OK: 'system_ok',
  BACKUP_COMPLETE: 'backup_complete',
  SYNC_COMPLETE: 'sync_complete'
};

// Prioridad de alertas
const ALERT_PRIORITY = {
  [ALERT_TYPES.ACCOUNTING_IMBALANCE]: 100,
  [ALERT_TYPES.DATA_CORRUPTION]: 100,
  [ALERT_TYPES.MIGRATION_FAILURE]: 100,
  [ALERT_TYPES.SYNC_CRITICAL]: 90,
  [ALERT_TYPES.JOURNAL_IMBALANCE]: 90,
  [ALERT_TYPES.INVENTORY_NEGATIVE]: 90,
  [ALERT_TYPES.HUMAN_FACTOR_SIGNAL]: 80,
  [ALERT_TYPES.CASH_EVIDENCE_REQUIRED]: 80,
  [ALERT_TYPES.CASH_DISCREPANCY]: 70,
  [ALERT_TYPES.SALES_MISMATCH]: 65,
  [ALERT_TYPES.CASH_SESSION_DRIFT]: 60,
  [ALERT_TYPES.LOW_STOCK]: 50,
  [ALERT_TYPES.OFFLINE_PROLONGED]: 60,
  [ALERT_TYPES.BACKUP_OVERDUE]: 40,
  [ALERT_TYPES.PENDING_SYNC]: 30,
  [ALERT_TYPES.EXPIRING_PRODUCTS]: 45,
  [ALERT_TYPES.BANK_PAYMENT_FAILED]: 70,
  [ALERT_TYPES.EVIDENCE_MISSING]: 60,
  [ALERT_TYPES.EXPENSE_MISSING_RECEIPT]: 55,
  [ALERT_TYPES.SALE_MISSING_EVIDENCE]: 55,
  [ALERT_TYPES.INVENTORY_EVIDENCE_MISSING]: 50,
  [ALERT_TYPES.PRODUCTION_EVIDENCE_MISSING]: 50,
  [ALERT_TYPES.SYSTEM_OK]: 0,
  [ALERT_TYPES.BACKUP_COMPLETE]: 0,
  [ALERT_TYPES.SYNC_COMPLETE]: 0
};

class SentinelService {
  constructor() {
    this.alerts = [];
    this.listeners = [];
    this.checkInterval = null;
    this.lastCheck = null;
    this.healthStatus = HEALTH_STATUS.GREEN;
    this.lastAutoCorrections = [];
  }

  // ==================== SUSCRIPCIÓN ====================
  
  subscribe(callback) {
    this.listeners.push(callback);
    // Enviar estado actual inmediatamente
    callback(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(callback => callback(state));
  }

  getState() {
    return {
      status: this.healthStatus,
      alerts: this.alerts,
      lastCheck: this.lastCheck,
      lastAutoCorrections: this.lastAutoCorrections,
      criticalCount: this.alerts.filter(a => a.severity === 'critical').length,
      warningCount: this.alerts.filter(a => a.severity === 'warning').length,
      infoCount: this.alerts.filter(a => a.severity === 'info').length
    };
  }

  getAutoCorrectEnabled() {
    try {
      const raw = readWithMigration('genesis_auto_correct_enabled', 'rauli_auto_correct_enabled');
      if (raw === null) return true;
      return raw === 'true';
    } catch {
      return true;
    }
  }

  setAutoCorrectEnabled(enabled) {
    try {
      localStorage.setItem('genesis_auto_correct_enabled', enabled ? 'true' : 'false');
    } catch {}
  }

  getSignalIntensity(value, { green = 0.01, yellow = 0.05 } = {}) {
    if (value >= yellow) return 'red';
    if (value >= green) return 'yellow';
    return 'green';
  }

  async getUserRole(userId) {
    if (!userId) return 'sin_rol';
    try {
      const user = await localDB.users?.get(userId);
      return user?.role || 'sin_rol';
    } catch {
      return 'sin_rol';
    }
  }

  // ==================== GESTIÓN DE ALERTAS ====================

  addAlert(type, message, details = {}) {
    const severity = this.getSeverity(type);
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      details,
      severity,
      priority: ALERT_PRIORITY[type] || 0,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    // Evitar duplicados del mismo tipo
    this.alerts = this.alerts.filter(a => a.type !== type);
    this.alerts.push(alert);
    this.alerts.sort((a, b) => b.priority - a.priority);

    this.updateHealthStatus();
    this.notifyListeners();

    return alert;
  }

  removeAlert(alertId) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.updateHealthStatus();
    this.notifyListeners();
  }

  resolveAlertsByReference(referenceType, referenceId) {
    if (!referenceType || !referenceId) return;
    const next = this.alerts.filter((alert) => {
      const details = alert.details || {};
      return !(details.reference_type === referenceType && details.reference_id === referenceId);
    });
    if (next.length !== this.alerts.length) {
      this.alerts = next;
      this.updateHealthStatus();
      this.notifyListeners();
    }
  }

  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.notifyListeners();
    }
  }

  clearAlerts(severity = null) {
    if (severity) {
      this.alerts = this.alerts.filter(a => a.severity !== severity);
    } else {
      this.alerts = [];
    }
    this.updateHealthStatus();
    this.notifyListeners();
  }

  getSeverity(type) {
    const priority = ALERT_PRIORITY[type] || 0;
    if (priority >= 90) return 'critical';
    if (priority >= 30) return 'warning';
    return 'info';
  }

  updateHealthStatus() {
    const hasCritical = this.alerts.some(a => a.severity === 'critical' && !a.acknowledged);
    const hasWarning = this.alerts.some(a => a.severity === 'warning' && !a.acknowledged);

    if (hasCritical) {
      this.healthStatus = HEALTH_STATUS.RED;
    } else if (hasWarning) {
      this.healthStatus = HEALTH_STATUS.YELLOW;
    } else {
      this.healthStatus = HEALTH_STATUS.GREEN;
    }
  }

  // ==================== VERIFICACIONES DE SALUD ====================

  async runHealthCheck() {
    console.log('🔍 Sentinel: Ejecutando verificación de salud...');
    this.lastCheck = new Date().toISOString();

    try {
      // Verificar ecuación contable
      await this.checkAccountingBalance();

      // Verificar integridad de asientos contables
      await this.checkJournalIntegrity();

      // Verificar integridad de ventas
      await this.checkSalesIntegrity();

      // Verificar integridad de caja
      await this.checkCashIntegrity();

      // Verificar integridad de inventario
      await this.checkInventoryIntegrity();

      // Ciclo cerrado: autocorreccion de datos derivados
      const corrections = await this.applyAutoCorrections();
      if (corrections.length > 0) {
        this.lastAutoCorrections = corrections.slice(0, 10);
        await this.checkSalesIntegrity();
        await this.checkCashIntegrity();
      }

      // Verificar stock bajo
      await this.checkLowStock();

      // Verificar productos por vencer
      await this.checkExpiringProducts();

      // Verificar estado de conexión
      this.checkConnectionStatus();

      // Verificar sincronización pendiente
      await this.checkPendingSync();

      // Verificar backups
      await this.checkBackupStatus();

      // Si no hay alertas críticas o de advertencia, agregar OK
      if (this.alerts.filter(a => a.severity !== 'info').length === 0) {
        this.addAlert(ALERT_TYPES.SYSTEM_OK, 'Sistema funcionando correctamente');
      }

    } catch (error) {
      console.error('Sentinel: Error en verificación de salud:', error);
      this.addAlert(ALERT_TYPES.DATA_CORRUPTION, 'Error al verificar integridad del sistema', {
        error: error.message
      });
    }

    this.notifyListeners();
    return this.getState();
  }

  // Verificar ecuación contable (usa API con token para evitar 401)
  async checkAccountingBalance() {
    try {
      const { data } = await accounting.balanceCheck();
      if (data.balanced === false) {
        this.addAlert(
          ALERT_TYPES.ACCOUNTING_IMBALANCE,
          'CRÍTICO: La ecuación contable no cuadra',
          {
            activos: data.activos,
            pasivos: data.pasivos,
            capital: data.capital,
            diferencia: data.diferencia
          }
        );
      } else {
        this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.ACCOUNTING_IMBALANCE);
      }
    } catch (error) {
      // Si estamos offline, verificar localmente si es posible
      try {
        await accountingCore.initialize();
        const report = await accountingCore.getBalanceSheet();
        if (!report?.balanced) {
          this.addAlert(
            ALERT_TYPES.ACCOUNTING_IMBALANCE,
            'CRÍTICO: La ecuación contable no cuadra (local)',
            {
              totalActivos: report?.assets?.total || 0,
              totalPasivos: report?.liabilities?.total || 0,
              totalPatrimonio: report?.equity?.total || 0,
              netIncome: report?.equity?.netIncome || 0
            }
          );
        } else {
          this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.ACCOUNTING_IMBALANCE);
        }
      } catch (e) {
        console.log('Sentinel: Verificación contable local falló');
      }
    }
  }

  async checkJournalIntegrity() {
    try {
      const entries = await localDB.journalEntries?.toArray() || [];
      const lines = await localDB.journalLines?.toArray() || [];
      const grouped = lines.reduce((acc, line) => {
        const key = line.entry_id || line.entryId;
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(line);
        return acc;
      }, {});

      const unbalanced = [];
      entries.forEach((entry) => {
        const entryLines = grouped[entry.id] || [];
        if (entryLines.length === 0) {
          unbalanced.push({ id: entry.id, reason: 'sin lineas' });
          return;
        }
        const debit = entryLines.reduce((s, l) => s + (l.debit || 0), 0);
        const credit = entryLines.reduce((s, l) => s + (l.credit || 0), 0);
        if (Math.abs(debit - credit) > 0.01) {
          unbalanced.push({ id: entry.id, debit, credit });
        }
      });

      if (unbalanced.length > 0) {
        this.addAlert(
          ALERT_TYPES.JOURNAL_IMBALANCE,
          `Asientos descuadrados: ${unbalanced.length}`,
          { samples: unbalanced.slice(0, 5) }
        );
      } else {
        this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.JOURNAL_IMBALANCE);
      }
    } catch (error) {
      console.log('Sentinel: Error verificando asientos:', error);
    }
  }

  async checkSalesIntegrity() {
    try {
      const sales = await localDB.sales?.filter(s => !s.voided_at).toArray() || [];
      const saleItems = await localDB.saleItems?.toArray() || [];
      const itemsBySale = saleItems.reduce((acc, item) => {
        const key = item.sale_id || item.saleId;
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {});

      const mismatches = [];
      sales.forEach((sale) => {
        const items = Array.isArray(sale.items) ? sale.items : (itemsBySale[sale.id] || []);
        const totalItems = items.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
        if (sale.total !== undefined && Math.abs(totalItems - (sale.total || 0)) > 0.01) {
          mismatches.push({ id: sale.id, total: sale.total, itemsTotal: totalItems });
        }
      });

      if (mismatches.length > 0) {
        this.addAlert(
          ALERT_TYPES.SALES_MISMATCH,
          `Ventas con descuadre: ${mismatches.length}`,
          { samples: mismatches.slice(0, 5) }
        );
        const worst = mismatches[0];
        const ratio = Math.abs(worst.itemsTotal - worst.total) / Math.max(1, worst.total || 1);
        this.addAlert(
          ALERT_TYPES.HUMAN_FACTOR_SIGNAL,
          'Posible variacion por factor humano en ventas',
          {
            source: 'sales_mismatch',
            stage: 'ventas',
            intensity: this.getSignalIntensity(ratio, { green: 0.01, yellow: 0.05 })
          }
        );
      } else {
        this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.SALES_MISMATCH);
      }
    } catch (error) {
      console.log('Sentinel: Error verificando ventas:', error);
    }
  }

  async checkCashIntegrity() {
    try {
      const sessions = await localDB.cashSessions?.toArray() || [];
      const movements = await localDB.cashMovements?.toArray() || [];
      const variances = await localDB.cashVariances?.toArray() || [];

      const varianceTotal = variances.reduce((sum, v) => sum + Math.abs(v.variance || 0), 0);
      if (variances.length > 0) {
        this.addAlert(
          ALERT_TYPES.CASH_DISCREPANCY,
          `Descuadres de caja: ${variances.length}`,
          { totalVariance: varianceTotal }
        );
        const varianceUserId = variances[0]?.user_id || sessions[0]?.closed_by || null;
        const varianceRole = await this.getUserRole(varianceUserId);
        const ratio = varianceTotal / Math.max(1, sessions.reduce((sum, s) => sum + (s.expected_cash || 0), 0));
        this.addAlert(
          ALERT_TYPES.HUMAN_FACTOR_SIGNAL,
          'Posible variacion por factor humano en caja',
          {
            source: 'cash_variance',
            stage: 'caja_cierre',
            intensity: this.getSignalIntensity(ratio, { green: 0.005, yellow: 0.02 }),
            userId: varianceUserId,
            role: varianceRole
          }
        );
      } else {
        this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.CASH_DISCREPANCY);
      }

      const bySession = movements.reduce((acc, m) => {
        if (!acc[m.session_id]) acc[m.session_id] = [];
        acc[m.session_id].push(m);
        return acc;
      }, {});

      const drift = [];
      sessions.filter(s => s.status === 'open').forEach((session) => {
        const sessionMovements = bySession[session.id] || [];
        const totals = sessionMovements.reduce((acc, m) => {
          const amount = m.amount || 0;
          if (m.type === 'sale') acc.sales += amount;
          if (m.type === 'refund') acc.refunds += amount;
          if (m.type === 'cash_in') acc.cashIn += amount;
          if (m.type === 'cash_out') acc.cashOut += amount;
          return acc;
        }, { sales: 0, refunds: 0, cashIn: 0, cashOut: 0 });

        const expected = (session.opening_amount || 0) + totals.sales - totals.refunds + totals.cashIn - totals.cashOut;
        if (Math.abs(expected - (session.expected_cash || 0)) > 0.01) {
          drift.push({ id: session.id, expected, recorded: session.expected_cash || 0 });
        }
      });

      if (drift.length > 0) {
        this.addAlert(
          ALERT_TYPES.CASH_SESSION_DRIFT,
          `Caja con variación interna: ${drift.length}`,
          { samples: drift.slice(0, 5) }
        );
        this.addAlert(
          ALERT_TYPES.HUMAN_FACTOR_SIGNAL,
          'Variacion detectada en movimientos de caja',
          { source: 'cash_drift', stage: 'caja_movimientos', intensity: 'yellow' }
        );
      } else {
        this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.CASH_SESSION_DRIFT);
      }
    } catch (error) {
      console.log('Sentinel: Error verificando caja:', error);
    }
  }

  async checkInventoryIntegrity() {
    try {
      const products = await localDB.products?.toArray() || [];
      const movements = await localDB.inventoryMovements?.toArray() || [];
      const productSet = new Set(products.map(p => p.id));

      const negative = products.filter(p => (p.stock || 0) < 0);
      if (negative.length > 0) {
        this.addAlert(
          ALERT_TYPES.INVENTORY_NEGATIVE,
          `Inventario negativo: ${negative.length}`,
          { samples: negative.slice(0, 5).map(p => ({ id: p.id, stock: p.stock })) }
        );
      } else {
        this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.INVENTORY_NEGATIVE);
      }

      const orphanMovements = movements.filter(m => m.product_id && !productSet.has(m.product_id));
      if (orphanMovements.length > 0) {
        this.addAlert(
          ALERT_TYPES.DATA_CORRUPTION,
          `Movimientos huérfanos: ${orphanMovements.length}`,
          { samples: orphanMovements.slice(0, 5) }
        );
      } else {
        this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.DATA_CORRUPTION || a.message?.startsWith('Movimientos huérfanos') === false);
      }
    } catch (error) {
      console.log('Sentinel: Error verificando inventario:', error);
    }
  }

  async applyAutoCorrections() {
    if (!this.getAutoCorrectEnabled()) return [];
    const corrections = [];
    try {
      // Corregir expected_cash de sesiones abiertas usando movimientos
      const sessions = await localDB.cashSessions?.where('status').equals('open').toArray() || [];
      const movements = await localDB.cashMovements?.toArray() || [];
      const bySession = movements.reduce((acc, m) => {
        if (!acc[m.session_id]) acc[m.session_id] = [];
        acc[m.session_id].push(m);
        return acc;
      }, {});

      for (const session of sessions) {
        const sessionMovements = bySession[session.id] || [];
        const totals = sessionMovements.reduce((acc, m) => {
          const amount = m.amount || 0;
          if (m.type === 'sale') acc.sales += amount;
          if (m.type === 'refund') acc.refunds += amount;
          if (m.type === 'cash_in') acc.cashIn += amount;
          if (m.type === 'cash_out') acc.cashOut += amount;
          return acc;
        }, { sales: 0, refunds: 0, cashIn: 0, cashOut: 0 });
        const expected = (session.opening_amount || 0) + totals.sales - totals.refunds + totals.cashIn - totals.cashOut;
        if (Math.abs(expected - (session.expected_cash || 0)) > 0.01) {
          await localDB.cashSessions?.update(session.id, { expected_cash: expected });
          corrections.push({ type: 'cash_expected_recalc', sessionId: session.id, expected });
          await logAudit('cash_session', session.id, 'auto_correct', null, {
            expected,
            recorded: session.expected_cash || 0
          });
        }
      }

      // Corregir total de ventas basado en items
      const sales = await localDB.sales?.filter(s => !s.voided_at).toArray() || [];
      for (const sale of sales) {
        const items = Array.isArray(sale.items) ? sale.items : [];
        if (items.length === 0) continue;
        const totalItems = items.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
        if (sale.total !== undefined && Math.abs(totalItems - (sale.total || 0)) > 0.01) {
          await localDB.sales?.update(sale.id, { total: totalItems });
          corrections.push({ type: 'sale_total_recalc', saleId: sale.id, total: totalItems });
          await logAudit('sale', sale.id, 'auto_correct', null, {
            before: { total: sale.total },
            after: { total: totalItems }
          });
        }
      }
    } catch (error) {
      console.log('Sentinel: Error en autocorreccion:', error);
    }
    return corrections;
  }

  // Verificar productos con stock bajo (usa API con token para evitar 401)
  async checkLowStock() {
    try {
      const { data } = await products.lowStock();
      const lowStockProducts = data.products || [];
      if (lowStockProducts.length > 0) {
        this.addAlert(
          ALERT_TYPES.LOW_STOCK,
          `${lowStockProducts.length} producto(s) con stock bajo`,
          { products: lowStockProducts.map(p => ({ name: p.name, stock: p.stock, min: p.min_stock })) }
        );
      } else {
        this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.LOW_STOCK);
      }
    } catch (error) {
      // No loguear cuando la API no está (404/502/503/HTML) o sin red
      const msg = String(error?.message || '');
      const silent = [401, 404, 502, 503].includes(error?.status)
        || error?.name === 'TypeError' || error?.name === 'SyntaxError'
        || msg.includes('Unexpected token') || msg.includes('is not valid JSON');
      if (!silent) console.log('Sentinel: Error verificando stock:', error);
    }
  }

  // Verificar productos por vencer (usa API con token para evitar 401)
  async checkExpiringProducts() {
    try {
      const { data } = await inventory.expiringLots(7);
      const expiringLots = data.lots || [];
      if (expiringLots.length > 0) {
        this.addAlert(
          ALERT_TYPES.EXPIRING_PRODUCTS,
          `${expiringLots.length} lote(s) próximos a vencer`,
          { lots: expiringLots }
        );
      } else {
        this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.EXPIRING_PRODUCTS);
      }
    } catch (error) {
      const msg = String(error?.message || '');
      const silent = [401, 404, 502, 503].includes(error?.status)
        || error?.name === 'TypeError' || error?.name === 'SyntaxError'
        || msg.includes('Unexpected token') || msg.includes('is not valid JSON');
      if (!silent) console.log('Sentinel: Error verificando vencimientos:', error);
    }
  }

  // Verificar estado de conexión
  checkConnectionStatus() {
    const isOnline = navigator.onLine;
    const lastOnline = localStorage.getItem('last_online_timestamp');

    if (!isOnline && lastOnline) {
      const offlineDuration = Date.now() - new Date(lastOnline).getTime();
      const hoursDiff = offlineDuration / (1000 * 60 * 60);

      if (hoursDiff > 1) { // Más de 1 hora offline
        this.addAlert(
          ALERT_TYPES.OFFLINE_PROLONGED,
          `Sistema offline por ${Math.round(hoursDiff)} hora(s)`,
          { offlineSince: lastOnline, duration: hoursDiff }
        );
      }
    } else if (isOnline) {
      localStorage.setItem('last_online_timestamp', new Date().toISOString());
      this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.OFFLINE_PROLONGED);
    }
  }

  // Verificar sincronización pendiente
  async checkPendingSync() {
    try {
      const pendingCount = await localDB.getPendingSyncCount();

      if (pendingCount > 10) {
        this.addAlert(
          ALERT_TYPES.PENDING_SYNC,
          `${pendingCount} operaciones pendientes de sincronizar`,
          { count: pendingCount }
        );
      } else {
        this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.PENDING_SYNC);
      }
    } catch (error) {
      console.log('Sentinel: Error verificando sync pendiente:', error);
    }
  }

  // Verificar estado de backups
  async checkBackupStatus() {
    const lastBackup = localStorage.getItem('last_backup_timestamp');

    if (!lastBackup) {
      this.addAlert(
        ALERT_TYPES.BACKUP_OVERDUE,
        'No hay backups registrados. Se recomienda exportar datos.',
        { recommendation: 'Ir a Configuración > Exportar Datos' }
      );
      return;
    }

    const daysSinceBackup = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceBackup > 7) {
      this.addAlert(
        ALERT_TYPES.BACKUP_OVERDUE,
        `Último backup hace ${Math.round(daysSinceBackup)} días`,
        { lastBackup, daysSince: daysSinceBackup }
      );
    } else {
      this.alerts = this.alerts.filter(a => a.type !== ALERT_TYPES.BACKUP_OVERDUE);
    }
  }

  // ==================== CONTROL DEL SERVICIO ====================

  start(intervalMs = 60000) {
    console.log('🚦 Sentinel: Iniciando monitoreo...');
    
    // Verificación inicial
    this.runHealthCheck();

    // Verificaciones periódicas
    this.checkInterval = setInterval(() => {
      this.runHealthCheck();
    }, intervalMs);

    // Escuchar cambios de conexión
    window.addEventListener('online', () => this.checkConnectionStatus());
    window.addEventListener('offline', () => this.checkConnectionStatus());
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('🚦 Sentinel: Monitoreo detenido');
  }

  // ==================== DIAGNÓSTICO ====================

  async generateDiagnosticReport() {
    const report = {
      timestamp: new Date().toISOString(),
      healthStatus: this.healthStatus,
      alerts: this.alerts,
      systemInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        online: navigator.onLine,
        cookiesEnabled: navigator.cookieEnabled
      },
      storage: {},
      sync: {}
    };

    // Info de almacenamiento
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        report.storage = {
          quota: estimate.quota,
          usage: estimate.usage,
          percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
        };
      }
    } catch (e) {
      report.storage.error = e.message;
    }

    // Info de sincronización
    try {
      report.sync = {
        pendingCount: await localDB.getPendingSyncCount(),
        lastSync: localStorage.getItem('last_sync')
      };
    } catch (e) {
      report.sync.error = e.message;
    }

    return report;
  }
}

// Singleton
const sentinelService = new SentinelService();
export default sentinelService;
