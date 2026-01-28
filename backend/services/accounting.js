/**
 * GENESIS - Accounting Service
 * Servicio para creación automática de asientos contables
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';

// Códigos de cuentas predeterminados
const ACCOUNT_CODES = {
  CAJA: '1101',
  BANCO: '1102',
  CUENTAS_POR_COBRAR: '1103',
  INVENTARIO: '1104',
  VENTAS: '4101',
  COSTO_VENTAS: '5101',
  IVA_POR_PAGAR: '2101',
  GASTOS_OPERATIVOS: '6101',
  COMISIONES: '6102'
};

/**
 * Obtener siguiente número de asiento
 */
function getNextEntryNumber() {
  const result = db.prepare('SELECT MAX(entry_number) as max FROM journal_entries').get();
  return (result.max || 0) + 1;
}

/**
 * Obtener cuenta por código
 */
function getAccountByCode(code) {
  return db.prepare('SELECT * FROM accounts WHERE code = ?').get(code);
}

function getFirstAccountByCodes(codes) {
  for (const code of codes) {
    const account = getAccountByCode(code);
    if (account) return account;
  }
  return null;
}

/**
 * Buscar cuenta por nombre (palabras clave)
 */
function findAccountByName(type, keywords) {
  if (!keywords || keywords.length === 0) return null;
  const clauses = keywords.map(() => "lower(name) LIKE ?").join(" OR ");
  const values = keywords.map((keyword) => `%${keyword}%`);
  return db.prepare(`
    SELECT * FROM accounts
    WHERE type = ? AND (${clauses})
    LIMIT 1
  `).get(type, ...values);
}

/**
 * Actualizar balance de cuenta
 */
function updateAccountBalance(accountId, debit, credit) {
  const account = db.prepare('SELECT type FROM accounts WHERE id = ?').get(accountId);
  let balanceChange = 0;
  
  if (['activo', 'gasto'].includes(account.type)) {
    balanceChange = debit - credit;
  } else {
    balanceChange = credit - debit;
  }
  
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(balanceChange, accountId);
}

let ledgerStructureReady = false;

function ensureLedgerStructure() {
  if (ledgerStructureReady) return;
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS general_ledger (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (entry_id) REFERENCES journal_entries(id),
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )
    `).run();

    db.prepare(`
      CREATE VIEW IF NOT EXISTS general_ledger_view AS
      SELECT
        jl.id as line_id,
        jl.entry_id,
        je.date,
        je.description,
        jl.account_id,
        a.code as account_code,
        a.name as account_name,
        jl.debit,
        jl.credit
      FROM journal_lines jl
      JOIN journal_entries je ON jl.entry_id = je.id
      JOIN accounts a ON jl.account_id = a.id
    `).run();

    ledgerStructureReady = true;
  } catch (err) {
    console.error('Error ensuring general ledger structure:', err);
  }
}

const runOptionalTransaction = (fn, useTransaction = true) => {
  if (!useTransaction) return fn();
  const tx = db.transaction(fn);
  return tx();
};

/**
 * Crear asiento contable por venta
 * Débito: Caja/Banco
 * Crédito: Ventas + IVA por pagar
 */
export function createSaleEntry(sale, paymentMethod = 'efectivo') {
  try {
    ensureLedgerStructure();
    const entryId = uuidv4();
    const entryNumber = getNextEntryNumber();
    
    // Determinar cuenta de destino según método de pago
    let cashAccount;
    if (paymentMethod === 'tarjeta') {
      cashAccount = getAccountByCode(ACCOUNT_CODES.BANCO);
    } else if (paymentMethod === 'transferencia') {
      cashAccount = getAccountByCode(ACCOUNT_CODES.BANCO);
    } else {
      cashAccount = getAccountByCode(ACCOUNT_CODES.CAJA);
    }
    
    const salesAccount = getAccountByCode(ACCOUNT_CODES.VENTAS);
    const taxAccount = getAccountByCode(ACCOUNT_CODES.IVA_POR_PAGAR);
    
    if (!cashAccount || !salesAccount) {
      console.error('Cuentas contables no encontradas');
      return null;
    }
    
    const subtotal = sale.subtotal || (sale.total - (sale.tax || 0));
    const tax = sale.tax || 0;
    
    const createEntry = db.transaction(() => {
      // Crear asiento
      db.prepare(`
        INSERT INTO journal_entries (id, entry_number, date, description, reference_type, reference_id, status, created_by)
        VALUES (?, ?, date('now'), ?, 'sale', ?, 'posted', ?)
      `).run(entryId, entryNumber, `Venta #${sale.sale_number || sale.id}`, sale.id, sale.employee_id);
      
      // Débito a Caja/Banco
      const lineId1 = uuidv4();
      db.prepare(`
        INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(lineId1, entryId, cashAccount.id, sale.total, 'Ingreso por venta');
      updateAccountBalance(cashAccount.id, sale.total, 0);
      
      // Crédito a Ventas
      const lineId2 = uuidv4();
      db.prepare(`
        INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, 0, ?, ?)
      `).run(lineId2, entryId, salesAccount.id, subtotal, 'Ingreso por venta');
      updateAccountBalance(salesAccount.id, 0, subtotal);
      
      // Crédito a IVA si aplica
      if (tax > 0 && taxAccount) {
        const lineId3 = uuidv4();
        db.prepare(`
          INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
          VALUES (?, ?, ?, 0, ?, ?)
        `).run(lineId3, entryId, taxAccount.id, tax, 'IVA por pagar');
        updateAccountBalance(taxAccount.id, 0, tax);
      }
    });
    
    createEntry();
    return entryId;
  } catch (err) {
    console.error('Error creating sale entry:', err);
    return null;
  }
}

/**
 * Crear asiento por costo de ventas
 * Débito: Costo de Ventas
 * Crédito: Inventario
 */
export function createCostOfSaleEntry(sale, costTotal) {
  try {
    ensureLedgerStructure();
    if (!costTotal || costTotal <= 0) return null;
    
    const entryId = uuidv4();
    const entryNumber = getNextEntryNumber();
    
    const costAccount = getAccountByCode(ACCOUNT_CODES.COSTO_VENTAS);
    const inventoryAccount = getAccountByCode(ACCOUNT_CODES.INVENTARIO);
    
    if (!costAccount || !inventoryAccount) {
      console.error('Cuentas de costo/inventario no encontradas');
      return null;
    }
    
    const createEntry = db.transaction(() => {
      db.prepare(`
        INSERT INTO journal_entries (id, entry_number, date, description, reference_type, reference_id, status, created_by)
        VALUES (?, ?, date('now'), ?, 'sale_cost', ?, 'posted', ?)
      `).run(entryId, entryNumber, `Costo Venta #${sale.sale_number || sale.id}`, sale.id, sale.employee_id);
      
      // Débito a Costo de Ventas
      const lineId1 = uuidv4();
      db.prepare(`
        INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(lineId1, entryId, costAccount.id, costTotal, 'Costo de productos vendidos');
      updateAccountBalance(costAccount.id, costTotal, 0);
      
      // Crédito a Inventario
      const lineId2 = uuidv4();
      db.prepare(`
        INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, 0, ?, ?)
      `).run(lineId2, entryId, inventoryAccount.id, costTotal, 'Salida de inventario');
      updateAccountBalance(inventoryAccount.id, 0, costTotal);
    });
    
    createEntry();
    return entryId;
  } catch (err) {
    console.error('Error creating cost entry:', err);
    return null;
  }
}

/**
 * Crear asiento por comisiones
 * Débito: Gastos por Comisiones
 * Crédito: Comisiones por Pagar (Pasivo)
 */
export function createCommissionEntry(commissions) {
  try {
    ensureLedgerStructure();
    if (!commissions || commissions.length === 0) return null;
    
    const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);
    if (totalCommission <= 0) return null;
    
    const entryId = uuidv4();
    const entryNumber = getNextEntryNumber();
    
    const expenseAccount = getAccountByCode(ACCOUNT_CODES.COMISIONES);
    // Usamos una cuenta de pasivo para comisiones por pagar
    const payableAccount = db.prepare("SELECT * FROM accounts WHERE code LIKE '2%' AND name LIKE '%comision%'").get();
    
    if (!expenseAccount) {
      console.error('Cuenta de comisiones no encontrada');
      return null;
    }
    
    const createEntry = db.transaction(() => {
      db.prepare(`
        INSERT INTO journal_entries (id, entry_number, date, description, reference_type, reference_id, status)
        VALUES (?, ?, date('now'), ?, 'commission', ?, 'posted')
      `).run(entryId, entryNumber, 'Comisiones por ventas', commissions[0].sale_id);
      
      // Débito a Gastos por Comisiones
      const lineId1 = uuidv4();
      db.prepare(`
        INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(lineId1, entryId, expenseAccount.id, totalCommission, 'Comisiones del período');
      updateAccountBalance(expenseAccount.id, totalCommission, 0);
      
      // Si hay cuenta de pasivo, creditamos ahí
      if (payableAccount) {
        const lineId2 = uuidv4();
        db.prepare(`
          INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
          VALUES (?, ?, ?, 0, ?, ?)
        `).run(lineId2, entryId, payableAccount.id, totalCommission, 'Comisiones por pagar');
        updateAccountBalance(payableAccount.id, 0, totalCommission);
      }
    });
    
    createEntry();
    return entryId;
  } catch (err) {
    console.error('Error creating commission entry:', err);
    return null;
  }
}

/**
 * Crear asiento por pago de nómina (base + variables + aportes patronales)
 * Débito: Gastos de nómina
 * Crédito: Caja/Banco
 */
export function createPayrollEntry(payroll, options = {}) {
  try {
    ensureLedgerStructure();
    if (!payroll) return null;
    const payrollTotal = Number(payroll.total || 0);
    const employerContribution = Number(payroll.employer_contribution || 0);
    const amount = payrollTotal + employerContribution;
    if (amount <= 0) return null;

    const expenseAccount = (
      getFirstAccountByCodes(['5300', '6100', '6101']) ||
      findAccountByName('gasto', ['personal', 'sueld', 'nomina', 'salario']) ||
      getAccountByCode(ACCOUNT_CODES.GASTOS_OPERATIVOS)
    );
    const employerAccount = (
      getFirstAccountByCodes(['5310', '6110']) ||
      findAccountByName('gasto', ['aporte', 'patronal', 'seguridad', 'social']) ||
      expenseAccount
    );
    const cashAccount = (
      getFirstAccountByCodes(['1100', '1200', '1101', '1102']) ||
      getAccountByCode(ACCOUNT_CODES.CAJA) ||
      getAccountByCode(ACCOUNT_CODES.BANCO)
    );

    if (!expenseAccount || !cashAccount) {
      console.error('Cuentas contables para nómina no encontradas');
      return null;
    }

    const entryId = uuidv4();
    const entryNumber = getNextEntryNumber();
    const periodLabel = payroll.period_start && payroll.period_end
      ? `${payroll.period_start} - ${payroll.period_end}`
      : '';
    const description = options.description || `Pago de nómina ${periodLabel}`.trim();
    const createdBy = options.createdBy || null;

    const createEntry = db.transaction(() => {
      db.prepare(`
        INSERT INTO journal_entries (id, entry_number, date, description, reference_type, reference_id, status, created_by)
        VALUES (?, ?, date('now'), ?, 'payroll', ?, 'posted', ?)
      `).run(entryId, entryNumber, description, payroll.id, createdBy);

      const lineId1 = uuidv4();
      db.prepare(`
        INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(lineId1, entryId, expenseAccount.id, payrollTotal, 'Gasto de nómina');
      updateAccountBalance(expenseAccount.id, payrollTotal, 0);

      if (employerContribution > 0) {
        const lineId2 = uuidv4();
        db.prepare(`
          INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
          VALUES (?, ?, ?, ?, 0, ?)
        `).run(lineId2, entryId, employerAccount.id, employerContribution, 'Aporte patronal');
        updateAccountBalance(employerAccount.id, employerContribution, 0);
      }

      const lineId3 = uuidv4();
      db.prepare(`
        INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, 0, ?, ?)
      `).run(lineId3, entryId, cashAccount.id, amount, 'Pago de nómina');
      updateAccountBalance(cashAccount.id, 0, amount);
    });

    createEntry();
    return entryId;
  } catch (err) {
    console.error('Error creating payroll entry:', err);
    return null;
  }
}

/**
 * Reversar un asiento contable (para cancelaciones)
 */
export function reverseEntry(originalEntryId, reason = 'Anulación', options = {}) {
  try {
    ensureLedgerStructure();
    const originalEntry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(originalEntryId);
    if (!originalEntry) return null;
    
    const originalLines = db.prepare('SELECT * FROM journal_lines WHERE entry_id = ?').all(originalEntryId);
    if (!originalLines.length) return null;
    
    const entryId = uuidv4();
    const entryNumber = getNextEntryNumber();
    
    const reverseEntryTx = () => {
      db.prepare(`
        INSERT INTO journal_entries (id, entry_number, date, description, reference_type, reference_id, status)
        VALUES (?, ?, date('now'), ?, 'reversal', ?, 'posted')
      `).run(entryId, entryNumber, `${reason} - Reverso de #${originalEntry.entry_number}`, originalEntryId);
      
      // Invertir débitos y créditos
      for (const line of originalLines) {
        const lineId = uuidv4();
        db.prepare(`
          INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(lineId, entryId, line.account_id, line.credit, line.debit, `Reverso: ${line.description}`);
        
        // Actualizar balance (invertido)
        updateAccountBalance(line.account_id, line.credit, line.debit);
      }
      
      // Marcar asiento original como cancelado
      db.prepare("UPDATE journal_entries SET status = 'cancelled' WHERE id = ?").run(originalEntryId);
    };
    
    runOptionalTransaction(reverseEntryTx, options.useTransaction !== false);
    return entryId;
  } catch (err) {
    console.error('Error reversing entry:', err);
    return null;
  }
}

/**
 * Crear asiento por gasto / salida de caja
 * Débito: Gasto
 * Crédito: Caja/Banco
 */
export function createExpenseEntry(expense, options = {}) {
  try {
    ensureLedgerStructure();
    if (!expense) return null;
    const amount = Number(expense.amount || 0);
    if (amount <= 0) return null;

    const expenseAccount = (
      (expense.account_code ? getAccountByCode(expense.account_code) : null) ||
      findAccountByName('gasto', [expense.category, 'gasto', 'servicio', 'proveedor'].filter(Boolean)) ||
      getFirstAccountByCodes(['5200', '5300', '6100', '6101']) ||
      getAccountByCode(ACCOUNT_CODES.GASTOS_OPERATIVOS)
    );
    const cashAccount = (
      getFirstAccountByCodes(['1100', '1200', '1101', '1102']) ||
      getAccountByCode(ACCOUNT_CODES.CAJA) ||
      getAccountByCode(ACCOUNT_CODES.BANCO)
    );

    if (!expenseAccount || !cashAccount) {
      console.error('Cuentas contables para gasto no encontradas');
      return null;
    }

    const entryId = uuidv4();
    const entryNumber = getNextEntryNumber();
    const description = options.description || expense.description || expense.category || 'Gasto';
    const createdBy = options.createdBy || null;
    const entryDate = expense.date || new Date().toISOString().split('T')[0];

    const createEntry = () => {
      db.prepare(`
        INSERT INTO journal_entries (id, entry_number, date, description, reference_type, reference_id, status, created_by)
        VALUES (?, ?, ?, ?, 'expense', ?, 'posted', ?)
      `).run(entryId, entryNumber, entryDate, description, expense.id, createdBy);

      const lineId1 = uuidv4();
      db.prepare(`
        INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(lineId1, entryId, expenseAccount.id, amount, description);
      updateAccountBalance(expenseAccount.id, amount, 0);

      const lineId2 = uuidv4();
      db.prepare(`
        INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, 0, ?, ?)
      `).run(lineId2, entryId, cashAccount.id, amount, 'Salida de caja');
      updateAccountBalance(cashAccount.id, 0, amount);
    };

    runOptionalTransaction(createEntry, options.useTransaction !== false);
    return entryId;
  } catch (err) {
    console.error('Error creating expense entry:', err);
    return null;
  }
}

// Alias para compatibilidad
export const createSaleJournalEntry = createSaleEntry;

export default {
  createSaleEntry,
  createSaleJournalEntry,
  createCostOfSaleEntry,
  createCommissionEntry,
  createPayrollEntry,
  createExpenseEntry,
  reverseEntry,
  ACCOUNT_CODES
};
