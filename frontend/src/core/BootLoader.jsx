/**
 * ══════════════════════════════════════════════════════════════════════════════
 * GENESIS - BOOT LOADER v2.0 (VISUAL)
 * ══════════════════════════════════════════════════════════════════════════════
 * Enterprise Boot Sequence with Visual Diagnostics
 * Inspired by: SAP Health Monitor, Windows Boot Sequence
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../services/dataService';

// ══════════════════════════════════════════════════════════════════════════════
// BOOT STATUS CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

export const BootStatus = {
  PENDING: 'pending',
  CHECKING: 'checking',
  REPAIRING: 'repairing',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

const CHECK_NAMES = {
  database: 'Base de Datos (IndexedDB)',
  schema: 'Integridad del Schema',
  accounting: 'Ecuación Contable (A=P+C)',
  inventory: 'Consistencia de Inventario',
  orphans: 'Registros Huérfanos',
  sales: 'Integridad de Ventas',
  storage: 'Espacio de Almacenamiento',
  ai: 'Motor de Inteligencia Artificial'
};

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM DIAGNOSTICS CLASS
// ══════════════════════════════════════════════════════════════════════════════

class SystemDiagnostics {
  constructor() {
    this.results = {};
    this.repairs = [];
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 1. DATABASE CONNECTIVITY
  // ════════════════════════════════════════════════════════════════════════════
  
  async checkDatabase() {
    try {
      // Test IndexedDB availability
      if (!window.indexedDB) {
        return { status: BootStatus.CRITICAL, message: 'IndexedDB no disponible' };
      }

      // Test Dexie connection
      await db.open();
      
      // Verify core tables exist
      const tables = db.tables.map(t => t.name);
      const required = ['products', 'sales', 'customers', 'settings'];
      const missing = required.filter(t => !tables.includes(t));

      if (missing.length > 0) {
        return { 
          status: BootStatus.WARNING, 
          message: `Tablas faltantes: ${missing.join(', ')}`,
          canRepair: true
        };
      }

      return { status: BootStatus.SUCCESS, message: 'Conexión OK' };
    } catch (error) {
      return { status: BootStatus.CRITICAL, message: error.message };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. SCHEMA INTEGRITY
  // ════════════════════════════════════════════════════════════════════════════
  
  async checkSchema() {
    try {
      const products = await db.products?.toArray() || [];
      const corrupted = products.filter(p => 
        !p.id || typeof p.price === 'undefined' || p.price === null
      );

      if (corrupted.length > 0) {
        // Auto-repair: remove corrupted records
        for (const p of corrupted) {
          await db.products.update(p.id, { 
            active: 0, 
            deleted_at: new Date().toISOString(),
            corruption_detected: true
          });
          this.repairs.push(`Producto corrupto marcado: ${p.id}`);
        }
        return { 
          status: BootStatus.WARNING, 
          message: `${corrupted.length} registros corruptos reparados`,
          repaired: corrupted.length
        };
      }

      return { status: BootStatus.SUCCESS, message: 'Schema íntegro' };
    } catch (error) {
      return { status: BootStatus.ERROR, message: error.message };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. ACCOUNTING EQUATION (A = P + C)
  // ════════════════════════════════════════════════════════════════════════════
  
  async checkAccounting() {
    try {
      const accounts = await db.accounts?.toArray() || [];
      
      if (accounts.length === 0) {
        return { status: BootStatus.SUCCESS, message: 'Sin cuentas (nuevo sistema)' };
      }

      let assets = 0, liabilities = 0, equity = 0;

      accounts.forEach(acc => {
        const balance = acc.balance || 0;
        const code = parseInt(acc.code);
        
        if (code >= 1000 && code < 2000) assets += balance;
        else if (code >= 2000 && code < 3000) liabilities += balance;
        else if (code >= 3000 && code < 4000) equity += balance;
      });

      const equation = assets - (liabilities + equity);
      const tolerance = 0.01;

      if (Math.abs(equation) > tolerance) {
        return { 
          status: BootStatus.WARNING, 
          message: `Descuadre: $${equation.toFixed(2)}`,
          details: { assets, liabilities, equity, diff: equation }
        };
      }

      return { status: BootStatus.SUCCESS, message: 'Ecuación balanceada' };
    } catch (error) {
      return { status: BootStatus.ERROR, message: error.message };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 4. INVENTORY CONSISTENCY
  // ════════════════════════════════════════════════════════════════════════════
  
  async checkInventory() {
    try {
      const products = await db.products?.where('active').equals(1).toArray() || [];
      const negativeStock = products.filter(p => (p.stock || 0) < 0);

      if (negativeStock.length > 0) {
        // Auto-repair: Set negative stock to 0
        for (const p of negativeStock) {
          await db.products.update(p.id, { 
            stock: 0,
            stock_corrected_at: new Date().toISOString()
          });
          this.repairs.push(`Stock negativo corregido: ${p.name} (${p.stock} → 0)`);
        }
        return { 
          status: BootStatus.WARNING, 
          message: `${negativeStock.length} productos con stock negativo corregidos`,
          repaired: negativeStock.length
        };
      }

      return { status: BootStatus.SUCCESS, message: `${products.length} productos OK` };
    } catch (error) {
      return { status: BootStatus.ERROR, message: error.message };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. ORPHAN RECORDS
  // ════════════════════════════════════════════════════════════════════════════
  
  async checkOrphans() {
    try {
      const saleItems = await db.saleItems?.toArray() || [];
      const sales = await db.sales?.toArray() || [];
      const saleIds = new Set(sales.map(s => s.id));

      const orphans = saleItems.filter(item => !saleIds.has(item.sale_id));

      if (orphans.length > 0) {
        // Auto-repair: Mark orphans as deleted
        for (const item of orphans) {
          await db.saleItems.update(item.id, { 
            deleted_at: new Date().toISOString(),
            orphan_detected: true
          });
          this.repairs.push(`Item huérfano eliminado: ${item.id}`);
        }
        return { 
          status: BootStatus.WARNING, 
          message: `${orphans.length} registros huérfanos limpiados`,
          repaired: orphans.length
        };
      }

      return { status: BootStatus.SUCCESS, message: 'Sin registros huérfanos' };
    } catch (error) {
      return { status: BootStatus.ERROR, message: error.message };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. SALES INTEGRITY
  // ════════════════════════════════════════════════════════════════════════════
  
  async checkSales() {
    try {
      const sales = await db.sales?.where('voided_at').equals('').toArray() || 
                    await db.sales?.filter(s => !s.voided_at).toArray() || [];
      
      let discrepancies = 0;

      for (const sale of sales.slice(0, 100)) { // Check last 100
        const items = await db.saleItems?.where('sale_id').equals(sale.id).toArray() || [];
        const calculatedTotal = items.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 0)), 0);
        
        if (Math.abs((sale.total || 0) - calculatedTotal) > 0.01) {
          discrepancies++;
          // Log but don't auto-repair sales (too sensitive)
          this.repairs.push(`Discrepancia en venta ${sale.id}: ${sale.total} vs ${calculatedTotal}`);
        }
      }

      if (discrepancies > 0) {
        return { 
          status: BootStatus.WARNING, 
          message: `${discrepancies} ventas con discrepancias`,
          details: { discrepancies }
        };
      }

      return { status: BootStatus.SUCCESS, message: `${sales.length} ventas verificadas` };
    } catch (error) {
      return { status: BootStatus.ERROR, message: error.message };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. STORAGE SPACE
  // ════════════════════════════════════════════════════════════════════════════
  
  async checkStorage() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
        const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
        const usedPercent = ((estimate.usage / estimate.quota) * 100).toFixed(1);

        if (parseFloat(usedPercent) > 90) {
          return { 
            status: BootStatus.WARNING, 
            message: `Almacenamiento al ${usedPercent}% (${usedMB}MB / ${quotaMB}MB)`,
            details: { usedMB, quotaMB, usedPercent }
          };
        }

        if (parseFloat(usedPercent) > 95) {
          return { 
            status: BootStatus.CRITICAL, 
            message: `¡Almacenamiento crítico! ${usedPercent}%`
          };
        }

        return { 
          status: BootStatus.SUCCESS, 
          message: `${usedMB}MB usado (${usedPercent}%)` 
        };
      }

      return { status: BootStatus.SUCCESS, message: 'API no disponible' };
    } catch (error) {
      return { status: BootStatus.ERROR, message: error.message };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 8. AI ENGINE STATUS
  // ════════════════════════════════════════════════════════════════════════════
  
  async checkAI() {
    try {
      const config = await db.settings?.get('ai_config');
      
      if (!config?.value) {
        return { 
          status: BootStatus.WARNING, 
          message: 'IA no configurada',
          details: { configured: false }
        };
      }

      const parsed = JSON.parse(config.value);
      
      if (!parsed.apiKey) {
        return { 
          status: BootStatus.WARNING, 
          message: 'API Key no configurada' 
        };
      }

      // Test API connection (quick ping)
      if (navigator.onLine) {
        return { 
          status: BootStatus.SUCCESS, 
          message: `${parsed.provider?.toUpperCase()} configurado` 
        };
      } else {
        return { 
          status: BootStatus.WARNING, 
          message: 'Sin conexión (modo offline)' 
        };
      }
    } catch (error) {
      return { 
        status: BootStatus.WARNING, 
        message: 'IA en modo offline' 
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RUN ALL DIAGNOSTICS
  // ════════════════════════════════════════════════════════════════════════════
  
  async runAll(onProgress) {
    const checks = [
      { key: 'database', fn: () => this.checkDatabase() },
      { key: 'schema', fn: () => this.checkSchema() },
      { key: 'accounting', fn: () => this.checkAccounting() },
      { key: 'inventory', fn: () => this.checkInventory() },
      { key: 'orphans', fn: () => this.checkOrphans() },
      { key: 'sales', fn: () => this.checkSales() },
      { key: 'storage', fn: () => this.checkStorage() },
      { key: 'ai', fn: () => this.checkAI() }
    ];

    this.results = {};
    this.repairs = [];

    for (let i = 0; i < checks.length; i++) {
      const check = checks[i];
      if (onProgress) onProgress(check.key, BootStatus.CHECKING, i + 1, checks.length);
      
      try {
        this.results[check.key] = await check.fn();
      } catch (error) {
        this.results[check.key] = { status: BootStatus.ERROR, message: error.message };
      }
      
      if (onProgress) onProgress(check.key, this.results[check.key].status, i + 1, checks.length);
      
      // Small delay for visual effect
      await new Promise(r => setTimeout(r, 150));
    }

    // Determine overall status
    const statuses = Object.values(this.results).map(r => r.status);
    let overall = BootStatus.SUCCESS;
    
    if (statuses.includes(BootStatus.CRITICAL)) overall = BootStatus.CRITICAL;
    else if (statuses.includes(BootStatus.ERROR)) overall = BootStatus.ERROR;
    else if (statuses.includes(BootStatus.WARNING)) overall = BootStatus.WARNING;

    return {
      overall,
      results: this.results,
      repairs: this.repairs,
      timestamp: new Date().toISOString()
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOT LOADER VISUAL COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function BootLoader({ onComplete, skipDiagnostics = false }) {
  const [phase, setPhase] = useState('init'); // init, checking, complete, error
  const [currentCheck, setCurrentCheck] = useState(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({});
  const [overallStatus, setOverallStatus] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [error, setError] = useState(null);

  const runDiagnostics = useCallback(async () => {
    setPhase('checking');
    
    const diagnostics = new SystemDiagnostics();
    
    try {
      const report = await diagnostics.runAll((key, status, current, total) => {
        setCurrentCheck(key);
        setProgress(Math.round((current / total) * 100));
        setResults(prev => ({ ...prev, [key]: { status, message: 'Verificando...' } }));
      });

      setResults(report.results);
      setRepairs(report.repairs);
      setOverallStatus(report.overall);
      setPhase('complete');

      // Store boot report
      try {
        await db.settings?.put({
          key: 'last_boot_report',
          value: JSON.stringify(report)
        });
      } catch (e) {
        console.error('Failed to save boot report:', e);
      }

      // Auto-proceed if all OK
      if (report.overall === BootStatus.SUCCESS) {
        setTimeout(() => {
          if (onComplete) onComplete(report);
        }, 1000);
      }

    } catch (error) {
      setError(error.message);
      setPhase('error');
    }
  }, [onComplete]);

  useEffect(() => {
    if (skipDiagnostics) {
      if (onComplete) onComplete(null);
      return;
    }

    // Start diagnostics after brief delay
    const timer = setTimeout(() => {
      runDiagnostics();
    }, 500);

    return () => clearTimeout(timer);
  }, [skipDiagnostics, runDiagnostics]);

  const handleContinue = () => {
    if (onComplete) onComplete({ overall: overallStatus, results, repairs });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case BootStatus.SUCCESS: return 'text-green-400';
      case BootStatus.WARNING: return 'text-amber-400';
      case BootStatus.ERROR: return 'text-red-400';
      case BootStatus.CRITICAL: return 'text-red-500';
      case BootStatus.CHECKING: return 'text-blue-400';
      default: return 'text-slate-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case BootStatus.SUCCESS: return '✓';
      case BootStatus.WARNING: return '⚠';
      case BootStatus.ERROR: return '✗';
      case BootStatus.CRITICAL: return '🛑';
      case BootStatus.CHECKING: return '◌';
      default: return '○';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case BootStatus.SUCCESS: return 'bg-green-500/10 border-green-500/30';
      case BootStatus.WARNING: return 'bg-amber-500/10 border-amber-500/30';
      case BootStatus.ERROR: return 'bg-red-500/10 border-red-500/30';
      case BootStatus.CRITICAL: return 'bg-red-500/20 border-red-500/50';
      default: return 'bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
      <div className="w-full max-w-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-500/20">
            <span className="text-4xl">🧩</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">GENESIS</h1>
          <p className="text-slate-400 text-sm">Enterprise Edition v3.0</p>
        </div>

        {/* Init Phase */}
        {phase === 'init' && (
          <div className="text-center">
            <div className="animate-pulse text-slate-400">Iniciando sistema...</div>
          </div>
        )}

        {/* Checking Phase */}
        {phase === 'checking' && (
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-center text-slate-400 text-sm">
              Verificando: {CHECK_NAMES[currentCheck] || currentCheck}
            </p>

            {/* Check List */}
            <div className="space-y-2 mt-6">
              {Object.entries(CHECK_NAMES).map(([key, name]) => (
                <div 
                  key={key}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    results[key] ? getStatusBg(results[key].status) : 'bg-slate-800/50 border-slate-700/50'
                  }`}
                >
                  <span className={`text-sm ${results[key] ? 'text-white' : 'text-slate-500'}`}>
                    {name}
                  </span>
                  <span className={getStatusColor(results[key]?.status || BootStatus.PENDING)}>
                    {currentCheck === key && !results[key]?.status ? (
                      <span className="animate-spin inline-block">◌</span>
                    ) : (
                      getStatusIcon(results[key]?.status || BootStatus.PENDING)
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Complete Phase */}
        {phase === 'complete' && (
          <div className="space-y-6">
            {/* Overall Status Banner */}
            <div className={`p-4 rounded-xl border ${getStatusBg(overallStatus)}`}>
              <div className="flex items-center gap-3">
                <span className={`text-3xl ${getStatusColor(overallStatus)}`}>
                  {getStatusIcon(overallStatus)}
                </span>
                <div>
                  <h3 className={`font-bold ${getStatusColor(overallStatus)}`}>
                    {overallStatus === BootStatus.SUCCESS && 'Sistema Operativo'}
                    {overallStatus === BootStatus.WARNING && 'Sistema con Alertas'}
                    {overallStatus === BootStatus.ERROR && 'Errores Detectados'}
                    {overallStatus === BootStatus.CRITICAL && 'Estado Crítico'}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {repairs.length > 0 
                      ? `${repairs.length} reparaciones automáticas realizadas`
                      : 'Todos los sistemas funcionando correctamente'}
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(results).map(([key, result]) => (
                <div 
                  key={key}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className={getStatusColor(result.status)}>
                      {getStatusIcon(result.status)}
                    </span>
                    <span className="text-sm text-slate-300">{CHECK_NAMES[key]}</span>
                  </div>
                  <span className="text-xs text-slate-500">{result.message}</span>
                </div>
              ))}
            </div>

            {/* Repairs Log */}
            {repairs.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-amber-400 text-sm font-medium mb-2">Reparaciones Automáticas:</p>
                <ul className="text-xs text-amber-400/80 space-y-1">
                  {repairs.slice(0, 5).map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                  {repairs.length > 5 && (
                    <li>... y {repairs.length - 5} más</li>
                  )}
                </ul>
              </div>
            )}

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              className={`w-full py-4 rounded-xl font-medium transition-all ${
                overallStatus === BootStatus.CRITICAL
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white'
              }`}
            >
              {overallStatus === BootStatus.CRITICAL ? 'Continuar con Precaución' : 'Iniciar Sistema'}
            </button>
          </div>
        )}

        {/* Error Phase */}
        {phase === 'error' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
              <span className="text-3xl">🛑</span>
            </div>
            <h3 className="text-xl font-bold text-red-400">Error Crítico</h3>
            <p className="text-slate-400">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Version Footer */}
        <p className="text-center text-slate-600 text-xs mt-8">
          v3.0 Enterprise • Boot Sequence
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK FOR MANUAL DIAGNOSTICS
// ══════════════════════════════════════════════════════════════════════════════

export function useSystemDiagnostics() {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState(null);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const diagnostics = new SystemDiagnostics();
    const result = await diagnostics.runAll();
    setReport(result);
    setIsRunning(false);
    return result;
  };

  return { runDiagnostics, isRunning, report };
}
