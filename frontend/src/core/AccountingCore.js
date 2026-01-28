/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GENESIS v3.0 - ACCOUNTING CORE
 * Enterprise-Grade Double-Entry Accounting Engine
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Inspirado en: QuickBooks, Xero, SAP FI/CO
 * Estándares: GAAP, IFRS, NIIF para PYMES
 * 
 * Características:
 * - Partida doble automática
 * - Soft delete (nunca borrar físicamente)
 * - Auditoría completa
 * - Plan de cuentas GAAP estándar
 * - Cierre de períodos
 */

import { db } from '../services/dataService';

// ═══════════════════════════════════════════════════════════════════════════
// PLAN DE CUENTAS GAAP ESTÁNDAR PARA PYMES
// ═══════════════════════════════════════════════════════════════════════════

export const CHART_OF_ACCOUNTS = {
  // ACTIVOS (1000-1999)
  ASSETS: {
    CASH: { code: '1100', name: 'Caja General', type: 'asset', nature: 'debit' },
    PETTY_CASH: { code: '1110', name: 'Caja Chica', type: 'asset', nature: 'debit' },
    BANK: { code: '1120', name: 'Bancos', type: 'asset', nature: 'debit' },
    ACCOUNTS_RECEIVABLE: { code: '1200', name: 'Cuentas por Cobrar', type: 'asset', nature: 'debit' },
    INVENTORY: { code: '1300', name: 'Inventario de Mercancías', type: 'asset', nature: 'debit' },
    SUPPLIES: { code: '1310', name: 'Suministros', type: 'asset', nature: 'debit' },
    PREPAID_EXPENSES: { code: '1400', name: 'Gastos Pagados por Anticipado', type: 'asset', nature: 'debit' },
    EQUIPMENT: { code: '1500', name: 'Equipo y Mobiliario', type: 'asset', nature: 'debit' },
    ACCUM_DEPRECIATION: { code: '1590', name: 'Depreciación Acumulada', type: 'asset', nature: 'credit' },
  },
  
  // PASIVOS (2000-2999)
  LIABILITIES: {
    ACCOUNTS_PAYABLE: { code: '2100', name: 'Cuentas por Pagar', type: 'liability', nature: 'credit' },
    TAXES_PAYABLE: { code: '2200', name: 'Impuestos por Pagar', type: 'liability', nature: 'credit' },
    ITBIS_PAYABLE: { code: '2210', name: 'ITBIS por Pagar', type: 'liability', nature: 'credit' },
    SALARIES_PAYABLE: { code: '2300', name: 'Sueldos por Pagar', type: 'liability', nature: 'credit' },
    LOANS_PAYABLE: { code: '2400', name: 'Préstamos por Pagar', type: 'liability', nature: 'credit' },
    UNEARNED_REVENUE: { code: '2500', name: 'Ingresos Diferidos', type: 'liability', nature: 'credit' },
  },
  
  // PATRIMONIO (3000-3999)
  EQUITY: {
    CAPITAL: { code: '3100', name: 'Capital Social', type: 'equity', nature: 'credit' },
    RETAINED_EARNINGS: { code: '3200', name: 'Utilidades Retenidas', type: 'equity', nature: 'credit' },
    CURRENT_EARNINGS: { code: '3300', name: 'Utilidad del Ejercicio', type: 'equity', nature: 'credit' },
    OWNER_DRAWINGS: { code: '3400', name: 'Retiros del Propietario', type: 'equity', nature: 'debit' },
    ADJUSTMENTS: { code: '3999', name: 'Ajustes por Diferencias', type: 'equity', nature: 'credit' },
  },
  
  // INGRESOS (4000-4999)
  REVENUE: {
    SALES: { code: '4100', name: 'Ventas de Mercancías', type: 'revenue', nature: 'credit' },
    SERVICE_REVENUE: { code: '4200', name: 'Ingresos por Servicios', type: 'revenue', nature: 'credit' },
    SALES_RETURNS: { code: '4110', name: 'Devoluciones sobre Ventas', type: 'revenue', nature: 'debit' },
    SALES_DISCOUNTS: { code: '4120', name: 'Descuentos sobre Ventas', type: 'revenue', nature: 'debit' },
    OTHER_INCOME: { code: '4900', name: 'Otros Ingresos', type: 'revenue', nature: 'credit' },
  },
  
  // COSTOS (5000-5999)
  COSTS: {
    COST_OF_GOODS_SOLD: { code: '5100', name: 'Costo de Ventas', type: 'cost', nature: 'debit' },
    PURCHASES: { code: '5110', name: 'Compras', type: 'cost', nature: 'debit' },
    PURCHASE_RETURNS: { code: '5120', name: 'Devoluciones sobre Compras', type: 'cost', nature: 'credit' },
    FREIGHT_IN: { code: '5130', name: 'Fletes sobre Compras', type: 'cost', nature: 'debit' },
  },
  
  // GASTOS (6000-6999)
  EXPENSES: {
    SALARIES: { code: '6100', name: 'Sueldos y Salarios', type: 'expense', nature: 'debit' },
    RENT: { code: '6200', name: 'Alquiler', type: 'expense', nature: 'debit' },
    UTILITIES: { code: '6300', name: 'Servicios Públicos', type: 'expense', nature: 'debit' },
    SUPPLIES_EXPENSE: { code: '6400', name: 'Gastos de Suministros', type: 'expense', nature: 'debit' },
    DEPRECIATION: { code: '6500', name: 'Gasto de Depreciación', type: 'expense', nature: 'debit' },
    INSURANCE: { code: '6600', name: 'Seguros', type: 'expense', nature: 'debit' },
    ADVERTISING: { code: '6700', name: 'Publicidad', type: 'expense', nature: 'debit' },
    BANK_FEES: { code: '6800', name: 'Gastos Bancarios', type: 'expense', nature: 'debit' },
    OTHER_EXPENSES: { code: '6900', name: 'Otros Gastos', type: 'expense', nature: 'debit' },
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CLASE PRINCIPAL: ACCOUNTING CORE
// ═══════════════════════════════════════════════════════════════════════════

export class AccountingCore {
  constructor() {
    this.initialized = false;
  }

  /**
   * Inicializar el módulo contable
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const accountCount = await db.accounts?.count() || 0;
      
      if (accountCount === 0) {
        console.log('📊 [Accounting] Inicializando plan de cuentas GAAP...');
        await this.seedChartOfAccounts();
      }

      this.initialized = true;
      console.log('✅ [Accounting] Motor contable inicializado');
    } catch (error) {
      console.error('❌ [Accounting] Error inicializando:', error);
    }
  }

  /**
   * Sembrar el plan de cuentas inicial
   */
  async seedChartOfAccounts() {
    const accounts = [];
    const timestamp = new Date().toISOString();

    for (const [category, categoryAccounts] of Object.entries(CHART_OF_ACCOUNTS)) {
      for (const [key, account] of Object.entries(categoryAccounts)) {
        accounts.push({
          id: account.code,
          code: account.code,
          name: account.name,
          type: account.type,
          nature: account.nature,
          category: category.toLowerCase(),
          balance: 0,
          active: 1,
          system: 1,
          created_at: timestamp,
          updated_at: timestamp
        });
      }
    }

    try {
      await db.accounts.bulkPut(accounts);
      console.log(`✅ [Accounting] ${accounts.length} cuentas creadas`);
    } catch (error) {
      console.error('Error creando cuentas:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ASIENTOS CONTABLES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Crear asiento contable de partida doble
   */
  async createJournalEntry({ description, reference, type, lines, date = null }) {
    const periodStart = await db.settings?.get("accounting_period_start");
    const periodEnd = await db.settings?.get("accounting_period_end");
    const periodClosed = await db.settings?.get("accounting_period_closed");
    const entryDate = date || new Date().toISOString();
    const entryDay = entryDate.split("T")[0];

    if (periodClosed?.value === "true" || periodClosed?.value === true) {
      if (periodStart?.value && periodEnd?.value) {
        if (entryDay >= periodStart.value && entryDay <= periodEnd.value) {
          throw new Error("Periodo contable cerrado. No se pueden registrar asientos.");
        }
      }
    }
    const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Asiento descuadrado: Débito ($${totalDebit}) ≠ Crédito ($${totalCredit})`);
    }

    const entryId = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const timestamp = entryDate;

    const journalEntry = {
      id: entryId,
      description,
      reference,
      type,
      date: timestamp.split('T')[0],
      total_debit: totalDebit,
      total_credit: totalCredit,
      status: 'posted',
      voided: 0,
      created_at: timestamp
    };

    const journalLines = lines.map((line, index) => ({
      id: `${entryId}-L${index + 1}`,
      entry_id: entryId,
      account_code: line.accountCode,
      description: line.description || description,
      debit: line.debit || 0,
      credit: line.credit || 0,
      created_at: timestamp
    }));

    try {
      await db.journalEntries?.put(journalEntry);
      await db.journalLines?.bulkPut(journalLines);

      for (const line of journalLines) {
        await this.updateAccountBalance(line.account_code, line.debit, line.credit);
      }

      console.log(`📝 [Accounting] Asiento ${entryId}: ${description}`);
      return journalEntry;
    } catch (error) {
      console.error('Error creando asiento:', error);
      throw error;
    }
  }

  /**
   * Actualizar saldo de cuenta
   */
  async updateAccountBalance(accountCode, debit, credit) {
    try {
      const account = await db.accounts?.where('code').equals(accountCode).first();
      if (!account) return;

      let balanceChange = account.nature === 'debit' 
        ? (debit || 0) - (credit || 0)
        : (credit || 0) - (debit || 0);

      await db.accounts.update(account.id, {
        balance: (account.balance || 0) + balanceChange,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error actualizando balance:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // OPERACIONES AUTOMÁTICAS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Registrar venta
   */
  async recordSale({ saleId, subtotal, tax, total, paymentMethod, isCredit = false }) {
    const COA = CHART_OF_ACCOUNTS;
    const lines = [];

    // Activo (caja o CxC)
    const cashAccount = isCredit ? COA.ASSETS.ACCOUNTS_RECEIVABLE : COA.ASSETS.CASH;
    lines.push({ 
      accountCode: cashAccount.code, 
      debit: total, 
      description: isCredit ? 'Venta a crédito' : `Venta ${paymentMethod}` 
    });

    // Ingreso
    lines.push({ 
      accountCode: COA.REVENUE.SALES.code, 
      credit: subtotal, 
      description: 'Ventas' 
    });

    // ITBIS
    if (tax > 0) {
      lines.push({ 
        accountCode: COA.LIABILITIES.ITBIS_PAYABLE.code, 
        credit: tax, 
        description: 'ITBIS' 
      });
    }

    return await this.createJournalEntry({
      description: `Venta #${saleId}`,
      reference: saleId,
      type: 'sale',
      lines
    });
  }

  /**
   * Registrar pago recibido
   */
  async recordPaymentReceived({ customerId, amount, reference }) {
    const COA = CHART_OF_ACCOUNTS;
    
    return await this.createJournalEntry({
      description: `Abono cliente ${customerId}`,
      reference,
      type: 'payment',
      lines: [
        { accountCode: COA.ASSETS.CASH.code, debit: amount },
        { accountCode: COA.ASSETS.ACCOUNTS_RECEIVABLE.code, credit: amount }
      ]
    });
  }

  /**
   * Registrar gasto
   */
  async recordExpense({ description, amount, expenseType = 'OTHER_EXPENSES', paymentMethod = 'cash' }) {
    const COA = CHART_OF_ACCOUNTS;
    const expenseAccount = COA.EXPENSES[expenseType]?.code || COA.EXPENSES.OTHER_EXPENSES.code;
    const paymentAccount = paymentMethod === 'bank' ? COA.ASSETS.BANK.code : COA.ASSETS.CASH.code;

    return await this.createJournalEntry({
      description,
      reference: `EXP-${Date.now()}`,
      type: 'expense',
      lines: [
        { accountCode: expenseAccount, debit: amount },
        { accountCode: paymentAccount, credit: amount }
      ]
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ANULACIÓN (SOFT DELETE)
  // ═══════════════════════════════════════════════════════════════════════

  async voidJournalEntry(entryId, reason) {
    const entry = await db.journalEntries?.get(entryId);
    if (!entry || entry.voided) return null;

    const periodStart = await db.settings?.get("accounting_period_start");
    const periodEnd = await db.settings?.get("accounting_period_end");
    const periodClosed = await db.settings?.get("accounting_period_closed");
    const entryDay = entry.date || entry.created_at?.split("T")[0];
    if (periodClosed?.value === "true" || periodClosed?.value === true) {
      if (periodStart?.value && periodEnd?.value) {
        if (entryDay >= periodStart.value && entryDay <= periodEnd.value) {
          throw new Error("Periodo contable cerrado. No se pueden anular asientos.");
        }
      }
    }

    const lines = await db.journalLines?.where('entry_id').equals(entryId).toArray() || [];

    // Asiento inverso
    const reversalLines = lines.map(line => ({
      accountCode: line.account_code,
      debit: line.credit,
      credit: line.debit,
      description: `Anulación: ${line.description}`
    }));

    await db.journalEntries.update(entryId, {
      voided: 1,
      void_reason: reason,
      voided_at: new Date().toISOString()
    });

    return await this.createJournalEntry({
      description: `ANULACIÓN: ${entry.description}`,
      reference: `VOID-${entryId}`,
      type: 'reversal',
      lines: reversalLines
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REPORTES
  // ═══════════════════════════════════════════════════════════════════════

  async getTrialBalance() {
    const accounts = await db.accounts?.where('active').equals(1).toArray() || [];
    let totalDebit = 0, totalCredit = 0;

    const balances = accounts
      .filter(a => a.balance !== 0)
      .map(account => {
        const isDebit = account.nature === 'debit' ? account.balance >= 0 : account.balance < 0;
        const debit = isDebit ? Math.abs(account.balance) : 0;
        const credit = !isDebit ? Math.abs(account.balance) : 0;
        totalDebit += debit;
        totalCredit += credit;
        return { code: account.code, name: account.name, type: account.type, debit, credit };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    return { accounts: balances, totals: { debit: totalDebit, credit: totalCredit }, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }

  async getBalanceSheet() {
    const accounts = await db.accounts?.where('active').equals(1).toArray() || [];
    const assets = accounts.filter(a => a.type === 'asset');
    const liabilities = accounts.filter(a => a.type === 'liability');
    const equity = accounts.filter(a => a.type === 'equity');

    const totalAssets = assets.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalEquity = equity.reduce((sum, a) => sum + (a.balance || 0), 0);

    const revenue = accounts.filter(a => a.type === 'revenue').reduce((sum, a) => sum + (a.balance || 0), 0);
    const costs = accounts.filter(a => a.type === 'cost').reduce((sum, a) => sum + (a.balance || 0), 0);
    const expenses = accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + (a.balance || 0), 0);
    const netIncome = revenue - costs - expenses;

    return {
      assets: { accounts: assets, total: totalAssets },
      liabilities: { accounts: liabilities, total: totalLiabilities },
      equity: { accounts: equity, total: totalEquity, netIncome },
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 0.01
    };
  }

  async getIncomeStatement() {
    const accounts = await db.accounts?.where('active').equals(1).toArray() || [];
    const revenue = accounts.filter(a => a.type === 'revenue');
    const costs = accounts.filter(a => a.type === 'cost');
    const expenses = accounts.filter(a => a.type === 'expense');

    const totalRevenue = revenue.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalCosts = costs.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + (a.balance || 0), 0);

    return {
      revenue: { accounts: revenue, total: totalRevenue },
      costs: { accounts: costs, total: totalCosts },
      expenses: { accounts: expenses, total: totalExpenses },
      grossProfit: totalRevenue - totalCosts,
      netIncome: totalRevenue - totalCosts - totalExpenses
    };
  }
}

// Singleton
export const accountingCore = new AccountingCore();
export default accountingCore;
