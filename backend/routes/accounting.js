/**
 * GENESIS - Accounting Routes
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';
import { createExpenseEntry } from '../services/accounting.js';
import { authMiddleware, requireRole } from './auth.js';

const router = Router();

const ensureExpensesTable = () => {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        vendor TEXT,
        category TEXT,
        description TEXT,
        amount REAL NOT NULL,
        payment_method TEXT,
        account_code TEXT,
        journal_entry_id TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `).run();
  } catch (err) {
    console.error('Error ensuring expenses table:', err);
  }
};

// ==================== CUENTAS CONTABLES ====================

// GET /api/accounting/accounts - Plan de cuentas
router.get('/accounts', authMiddleware, (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT a.*, p.name as parent_name, p.code as parent_code
      FROM accounts a
      LEFT JOIN accounts p ON a.parent_id = p.id
      WHERE a.active = 1
      ORDER BY a.code
    `).all();
    
    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar cuentas' });
  }
});

// POST /api/accounting/accounts
router.post('/accounts', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { code, name, type, parent_id } = req.body;
    
    if (!code || !name || !type) {
      return res.status(400).json({ error: true, message: 'Código, nombre y tipo son requeridos' });
    }
    
    const existing = db.prepare('SELECT id FROM accounts WHERE code = ?').get(code);
    if (existing) {
      return res.status(400).json({ error: true, message: 'Código de cuenta ya existe' });
    }
    
    const id = uuidv4();
    db.prepare(`
      INSERT INTO accounts (id, code, name, type, parent_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, code, name, type, parent_id);
    
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    res.status(201).json({ success: true, account });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al crear cuenta' });
  }
});

// ==================== ASIENTOS CONTABLES ====================

// GET /api/accounting/entries - Listar asientos
router.get('/entries', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date, status, limit = 50 } = req.query;
    
    let sql = `
      SELECT je.*, u.name as created_by_name
      FROM journal_entries je
      LEFT JOIN users u ON je.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (start_date) {
      sql += ' AND DATE(je.date) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND DATE(je.date) <= ?';
      params.push(end_date);
    }
    
    if (status) {
      sql += ' AND je.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY je.date DESC, je.entry_number DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const entries = db.prepare(sql).all(...params);
    
    // Obtener líneas de cada asiento
    const getLines = db.prepare(`
      SELECT jl.*, a.code as account_code, a.name as account_name
      FROM journal_lines jl
      JOIN accounts a ON jl.account_id = a.id
      WHERE jl.entry_id = ?
    `);
    
    for (const entry of entries) {
      entry.lines = getLines.all(entry.id);
    }
    
    res.json({ success: true, entries });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar asientos' });
  }
});

// GET /api/accounting/entries/:id
router.get('/entries/:id', authMiddleware, (req, res) => {
  try {
    const entry = db.prepare(`
      SELECT je.*, u.name as created_by_name
      FROM journal_entries je
      LEFT JOIN users u ON je.created_by = u.id
      WHERE je.id = ?
    `).get(req.params.id);
    
    if (!entry) {
      return res.status(404).json({ error: true, message: 'Asiento no encontrado' });
    }
    
    entry.lines = db.prepare(`
      SELECT jl.*, a.code as account_code, a.name as account_name
      FROM journal_lines jl
      JOIN accounts a ON jl.account_id = a.id
      WHERE jl.entry_id = ?
    `).all(entry.id);
    
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener asiento' });
  }
});

// POST /api/accounting/entries - Crear asiento manual
router.post('/entries', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { date, description, lines, reference_type, reference_id } = req.body;
    
    if (!date || !description || !lines || lines.length < 2) {
      return res.status(400).json({ error: true, message: 'Datos incompletos (mínimo 2 líneas)' });
    }
    
    // Verificar balance
    const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: true, message: 'El asiento no está balanceado' });
    }
    
    const id = uuidv4();
    
    // Obtener siguiente número de asiento
    const lastEntry = db.prepare('SELECT MAX(entry_number) as max FROM journal_entries').get();
    const entryNumber = (lastEntry.max || 0) + 1;
    
    const createEntry = db.transaction(() => {
      db.prepare(`
        INSERT INTO journal_entries (id, entry_number, date, description, reference_type, reference_id, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'posted', ?)
      `).run(id, entryNumber, date, description, reference_type, reference_id, req.user.id);
      
      const insertLine = db.prepare(`
        INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const updateBalance = db.prepare(`
        UPDATE accounts SET balance = balance + ? WHERE id = ?
      `);
      
      for (const line of lines) {
        insertLine.run(uuidv4(), id, line.account_id, line.debit || 0, line.credit || 0, line.description);
        
        // Actualizar balance de cuenta
        const account = db.prepare('SELECT type FROM accounts WHERE id = ?').get(line.account_id);
        let balanceChange = 0;
        
        if (['activo', 'gasto'].includes(account.type)) {
          balanceChange = (line.debit || 0) - (line.credit || 0);
        } else {
          balanceChange = (line.credit || 0) - (line.debit || 0);
        }
        
        updateBalance.run(balanceChange, line.account_id);
      }
    });
    
    createEntry();
    
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id);
    entry.lines = db.prepare('SELECT * FROM journal_lines WHERE entry_id = ?').all(id);
    
    res.status(201).json({ success: true, entry });
  } catch (err) {
    console.error('Error creating journal entry:', err);
    res.status(500).json({ error: true, message: 'Error al crear asiento' });
  }
});

// POST /api/accounting/expenses - Registrar gasto / salida de caja
router.post('/expenses', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    ensureExpensesTable();
    const { date, vendor, category, description, amount, payment_method, account_code } = req.body;

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: true, message: 'Monto inválido' });
    }
    if (!description && !category) {
      return res.status(400).json({ error: true, message: 'Descripción o categoría requerida' });
    }

    const id = uuidv4();
    const expenseDate = date || new Date().toISOString().split('T')[0];

    const createExpense = db.transaction(() => {
      const entryId = createExpenseEntry({
        id,
        date: expenseDate,
        vendor,
        category,
        description,
        amount: numericAmount,
        payment_method,
        account_code
      }, { createdBy: req.user.id, useTransaction: false });

      if (!entryId) {
        throw new Error('No se pudo crear asiento de gasto');
      }

      db.prepare(`
        INSERT INTO expenses (id, date, vendor, category, description, amount, payment_method, account_code, journal_entry_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        expenseDate,
        vendor,
        category,
        description,
        numericAmount,
        payment_method || 'efectivo',
        account_code || null,
        entryId,
        req.user.id
      );

      return entryId;
    });

    const entryId = createExpense();
    res.status(201).json({ success: true, expense_id: id, journal_entry_id: entryId });
  } catch (err) {
    console.error('Error creating expense:', err);
    res.status(500).json({ error: true, message: 'Error al registrar gasto' });
  }
});

// ==================== CONCILIACIÓN BANCARIA ====================

// GET /api/accounting/bank-accounts
router.get('/bank-accounts', authMiddleware, (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT ba.*,
        (SELECT COUNT(*) FROM bank_transactions WHERE bank_account_id = ba.id AND reconciled = 0) as pending_count
      FROM bank_accounts ba
      WHERE ba.active = 1
    `).all();
    
    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar cuentas bancarias' });
  }
});

// GET /api/accounting/bank-transactions
router.get('/bank-transactions', authMiddleware, (req, res) => {
  try {
    const { bank_account_id, reconciled, start_date, end_date, limit = 100 } = req.query;
    
    let sql = `
      SELECT bt.*, ba.name as account_name
      FROM bank_transactions bt
      JOIN bank_accounts ba ON bt.bank_account_id = ba.id
      WHERE 1=1
    `;
    const params = [];
    
    if (bank_account_id) {
      sql += ' AND bt.bank_account_id = ?';
      params.push(bank_account_id);
    }
    
    if (reconciled !== undefined) {
      sql += ' AND bt.reconciled = ?';
      params.push(reconciled === 'true' ? 1 : 0);
    }
    
    if (start_date) {
      sql += ' AND DATE(bt.date) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND DATE(bt.date) <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY bt.date DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const transactions = db.prepare(sql).all(...params);
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar transacciones' });
  }
});

// POST /api/accounting/bank-transactions
router.post('/bank-transactions', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { bank_account_id, date, description, amount, type, reference } = req.body;
    
    if (!bank_account_id || !date || !amount) {
      return res.status(400).json({ error: true, message: 'Datos incompletos' });
    }
    
    const id = uuidv4();
    db.prepare(`
      INSERT INTO bank_transactions (id, bank_account_id, date, description, amount, type, reference)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, bank_account_id, date, description, amount, type, reference);
    
    // Actualizar balance de cuenta bancaria
    db.prepare('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?')
      .run(amount, bank_account_id);
    
    const transaction = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id);
    res.status(201).json({ success: true, transaction });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al crear transacción' });
  }
});

// POST /api/accounting/reconcile - Conciliar transacción
router.post('/reconcile', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { transaction_id, journal_entry_id } = req.body;
    
    db.prepare(`
      UPDATE bank_transactions SET
        reconciled = 1,
        reconciled_with = ?,
        reconciled_at = datetime('now')
      WHERE id = ?
    `).run(journal_entry_id, transaction_id);
    
    res.json({ success: true, message: 'Transacción conciliada' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al conciliar' });
  }
});

// ==================== REPORTES FISCALES ====================

// GET /api/accounting/reports/balance - Balance General
router.get('/reports/balance', authMiddleware, (req, res) => {
  try {
    const { date } = req.query;
    const asOfDate = date || new Date().toISOString().split('T')[0];
    
    const accounts = db.prepare(`
      SELECT 
        a.code,
        a.name,
        a.type,
        a.balance,
        p.code as parent_code,
        p.name as parent_name
      FROM accounts a
      LEFT JOIN accounts p ON a.parent_id = p.id
      WHERE a.active = 1
      ORDER BY a.code
    `).all();
    
    // Agrupar por tipo
    const balance = {
      activos: accounts.filter(a => a.type === 'activo'),
      pasivos: accounts.filter(a => a.type === 'pasivo'),
      patrimonio: accounts.filter(a => a.type === 'patrimonio'),
      totals: {
        activos: accounts.filter(a => a.type === 'activo').reduce((sum, a) => sum + a.balance, 0),
        pasivos: accounts.filter(a => a.type === 'pasivo').reduce((sum, a) => sum + a.balance, 0),
        patrimonio: accounts.filter(a => a.type === 'patrimonio').reduce((sum, a) => sum + a.balance, 0)
      }
    };
    
    res.json({ success: true, balance, as_of_date: asOfDate });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar balance' });
  }
});

// GET /api/accounting/reports/income-statement - Estado de Resultados
router.get('/reports/income-statement', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    // Ingresos
    const ingresos = db.prepare(`
      SELECT a.code, a.name, 
        COALESCE(SUM(jl.credit - jl.debit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_lines jl ON a.id = jl.account_id
      LEFT JOIN journal_entries je ON jl.entry_id = je.id AND je.date BETWEEN ? AND ?
      WHERE a.type = 'ingreso' AND a.active = 1
      GROUP BY a.id
      ORDER BY a.code
    `).all(startDate, endDate);
    
    // Gastos
    const gastos = db.prepare(`
      SELECT a.code, a.name,
        COALESCE(SUM(jl.debit - jl.credit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_lines jl ON a.id = jl.account_id
      LEFT JOIN journal_entries je ON jl.entry_id = je.id AND je.date BETWEEN ? AND ?
      WHERE a.type = 'gasto' AND a.active = 1
      GROUP BY a.id
      ORDER BY a.code
    `).all(startDate, endDate);
    
    const totalIngresos = ingresos.reduce((sum, i) => sum + i.amount, 0);
    const totalGastos = gastos.reduce((sum, g) => sum + g.amount, 0);
    const utilidad = totalIngresos - totalGastos;
    
    res.json({
      success: true,
      income_statement: {
        ingresos,
        gastos,
        totals: {
          ingresos: totalIngresos,
          gastos: totalGastos,
          utilidad
        }
      },
      period: { start_date: startDate, end_date: endDate }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar estado de resultados' });
  }
});

// GET /api/accounting/reports/tax-summary - Resumen fiscal
router.get('/reports/tax-summary', authMiddleware, (req, res) => {
  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
    const targetYear = parseInt(year) || currentDate.getFullYear();
    
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];
    
    // Ventas del período
    const salesSummary = db.prepare(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total), 0) as gross_sales,
        COALESCE(SUM(tax), 0) as total_tax,
        COALESCE(SUM(total - tax), 0) as net_sales
      FROM sales
      WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
    `).get(startDate, endDate);
    
    // Ventas por método de pago
    const byPaymentMethod = db.prepare(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(total) as total
      FROM sales
      WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
      GROUP BY payment_method
    `).all(startDate, endDate);
    
    res.json({
      success: true,
      tax_summary: {
        period: { month: targetMonth, year: targetYear, start_date: startDate, end_date: endDate },
        sales: salesSummary,
        by_payment_method: byPaymentMethod
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al generar resumen fiscal' });
  }
});

// GET /api/accounting/dashboard - Dashboard contable
router.get('/dashboard', authMiddleware, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    // Ventas del mes
    const monthlySales = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM sales
      WHERE DATE(created_at) >= ? AND status = 'completed'
    `).get(monthStart);
    
    // Cuentas por tipo
    const accountBalances = db.prepare(`
      SELECT type, SUM(balance) as total
      FROM accounts
      WHERE active = 1
      GROUP BY type
    `).all();
    
    // Últimos asientos
    const recentEntries = db.prepare(`
      SELECT je.*, 
        (SELECT SUM(debit) FROM journal_lines WHERE entry_id = je.id) as total_amount
      FROM journal_entries je
      ORDER BY je.date DESC, je.created_at DESC
      LIMIT 5
    `).all();
    
    // Transacciones bancarias pendientes
    const pendingReconciliation = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(ABS(amount)), 0) as total
      FROM bank_transactions
      WHERE reconciled = 0
    `).get();
    
    res.json({
      success: true,
      dashboard: {
        monthly_sales: monthlySales.total,
        account_balances: accountBalances,
        recent_entries: recentEntries,
        pending_reconciliation: pendingReconciliation
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener dashboard' });
  }
});

// ==================== VERIFICACIÓN DE ECUACIÓN CONTABLE ====================

// GET /api/accounting/balance-check - Verificar A = P + C
router.get('/balance-check', authMiddleware, (req, res) => {
  try {
    const activos = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total 
      FROM accounts 
      WHERE type IN ('activo', 'activo_circulante', 'activo_fijo') AND active = 1
    `).get();
    
    const pasivos = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total 
      FROM accounts 
      WHERE type IN ('pasivo', 'pasivo_corto', 'pasivo_largo') AND active = 1
    `).get();
    
    const capital = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total 
      FROM accounts 
      WHERE type IN ('capital', 'patrimonio') AND active = 1
    `).get();
    
    const totalActivos = activos.total || 0;
    const totalPasivos = pasivos.total || 0;
    const totalCapital = capital.total || 0;
    const diferencia = totalActivos - (totalPasivos + totalCapital);
    
    res.json({
      success: true,
      activos: totalActivos,
      pasivos: totalPasivos,
      capital: totalCapital,
      diferencia: diferencia,
      balanced: Math.abs(diferencia) < 0.01
    });
  } catch (err) {
    console.error('Error verificando balance:', err);
    res.status(500).json({ error: true, message: 'Error al verificar ecuación contable' });
  }
});

// GET /api/accounting/balance-sheet - Balance General
router.get('/balance-sheet', authMiddleware, (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT code, name, type, balance
      FROM accounts
      WHERE active = 1
      ORDER BY code
    `).all();
    
    const activos = accounts.filter(a => 
      ['activo', 'activo_circulante', 'activo_fijo'].includes(a.type)
    );
    const pasivos = accounts.filter(a => 
      ['pasivo', 'pasivo_corto', 'pasivo_largo'].includes(a.type)
    );
    const patrimonio = accounts.filter(a => 
      ['capital', 'patrimonio'].includes(a.type)
    );
    
    res.json({
      success: true,
      activos,
      pasivos,
      patrimonio,
      totals: {
        activos: activos.reduce((sum, a) => sum + (a.balance || 0), 0),
        pasivos: pasivos.reduce((sum, a) => sum + (a.balance || 0), 0),
        patrimonio: patrimonio.reduce((sum, a) => sum + (a.balance || 0), 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener balance general' });
  }
});

// GET /api/accounting/income-statement - Estado de Resultados
router.get('/income-statement', authMiddleware, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    const ingresos = db.prepare(`
      SELECT a.code, a.name, a.balance as amount
      FROM accounts a
      WHERE a.type IN ('ingreso', 'ingresos') AND a.active = 1
      ORDER BY a.code
    `).all();
    
    const gastos = db.prepare(`
      SELECT a.code, a.name, a.balance as amount
      FROM accounts a
      WHERE a.type IN ('gasto', 'gastos', 'costos') AND a.active = 1
      ORDER BY a.code
    `).all();
    
    const totalIngresos = ingresos.reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalGastos = gastos.reduce((sum, g) => sum + (g.amount || 0), 0);
    
    res.json({
      success: true,
      ingresos,
      gastos,
      totals: {
        ingresos: totalIngresos,
        gastos: totalGastos,
        utilidad: totalIngresos - totalGastos
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener estado de resultados' });
  }
});

// ==================== CRUD COMPLETO DE CUENTAS ====================

// PUT /api/accounting/accounts/:id - Actualizar cuenta
router.put('/accounts/:id', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, type, parent_id } = req.body;
    
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (!account) {
      return res.status(404).json({ error: true, message: 'Cuenta no encontrada' });
    }
    
    // No permitir editar cuentas del sistema
    if (account.system) {
      return res.status(400).json({ error: true, message: 'No se pueden modificar cuentas del sistema' });
    }
    
    // Verificar código único si cambió
    if (code && code !== account.code) {
      const existing = db.prepare('SELECT id FROM accounts WHERE code = ? AND id != ?').get(code, id);
      if (existing) {
        return res.status(400).json({ error: true, message: 'Código de cuenta ya existe' });
      }
    }
    
    db.prepare(`
      UPDATE accounts SET
        code = COALESCE(?, code),
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        parent_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(code, name, type, parent_id, id);
    
    const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al actualizar cuenta' });
  }
});

// DELETE /api/accounting/accounts/:id - Eliminar cuenta
router.delete('/accounts/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (!account) {
      return res.status(404).json({ error: true, message: 'Cuenta no encontrada' });
    }
    
    if (account.system) {
      return res.status(400).json({ error: true, message: 'No se pueden eliminar cuentas del sistema' });
    }
    
    if (Math.abs(account.balance) > 0.01) {
      return res.status(400).json({ error: true, message: 'No se puede eliminar una cuenta con saldo' });
    }
    
    // Verificar si tiene movimientos
    const movements = db.prepare('SELECT COUNT(*) as count FROM journal_lines WHERE account_id = ?').get(id);
    if (movements.count > 0) {
      return res.status(400).json({ error: true, message: 'No se puede eliminar una cuenta con movimientos' });
    }
    
    db.prepare('UPDATE accounts SET active = 0 WHERE id = ?').run(id);
    res.json({ success: true, message: 'Cuenta eliminada' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al eliminar cuenta' });
  }
});

// ==================== SISTEMA DE INVERSIÓN Y AMORTIZACIÓN ====================

// GET /api/accounting/investment - Obtener configuración de inversión
router.get('/investment', authMiddleware, (req, res) => {
  try {
    const investment = db.prepare(`
      SELECT * FROM investment_config WHERE id = 1
    `).get();
    
    if (!investment) {
      return res.json({ 
        success: true, 
        investment: null,
        message: 'No hay inversión configurada'
      });
    }
    
    // Obtener historial de amortizaciones
    const amortizations = db.prepare(`
      SELECT * FROM investment_amortizations
      ORDER BY date DESC
      LIMIT 20
    `).all();
    
    res.json({ 
      success: true, 
      investment: {
        ...investment,
        amortizations
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener inversión' });
  }
});

// POST /api/accounting/investment - Crear/Configurar inversión
router.post('/investment', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { 
      total_amount, 
      description, 
      start_date, 
      target_date,
      return_percentage,
      profit_percentage 
    } = req.body;
    
    if (!total_amount || total_amount <= 0) {
      return res.status(400).json({ error: true, message: 'Monto de inversión inválido' });
    }
    
    // Crear tabla si no existe
    db.exec(`
      CREATE TABLE IF NOT EXISTS investment_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        total_amount REAL NOT NULL,
        recovered_amount REAL DEFAULT 0,
        description TEXT,
        start_date TEXT,
        target_date TEXT,
        return_percentage REAL DEFAULT 5,
        profit_percentage REAL DEFAULT 10,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS investment_amortizations (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        source TEXT,
        reference TEXT,
        date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    
    // Verificar si ya existe
    const existing = db.prepare('SELECT id FROM investment_config WHERE id = 1').get();
    
    if (existing) {
      return res.status(400).json({ 
        error: true, 
        message: 'Ya existe una inversión configurada. Use PUT para actualizar.' 
      });
    }
    
    db.prepare(`
      INSERT INTO investment_config (id, total_amount, description, start_date, target_date, return_percentage, profit_percentage)
      VALUES (1, ?, ?, ?, ?, ?, ?)
    `).run(total_amount, description, start_date, target_date, return_percentage || 5, profit_percentage || 10);
    
    const investment = db.prepare('SELECT * FROM investment_config WHERE id = 1').get();
    res.status(201).json({ success: true, investment });
  } catch (err) {
    console.error('Error creando inversión:', err);
    res.status(500).json({ error: true, message: 'Error al crear inversión' });
  }
});

// PUT /api/accounting/investment - Actualizar inversión
router.put('/investment', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { 
      total_amount, 
      description, 
      target_date,
      return_percentage,
      profit_percentage 
    } = req.body;
    
    db.prepare(`
      UPDATE investment_config SET
        total_amount = COALESCE(?, total_amount),
        description = COALESCE(?, description),
        target_date = COALESCE(?, target_date),
        return_percentage = COALESCE(?, return_percentage),
        profit_percentage = COALESCE(?, profit_percentage),
        updated_at = datetime('now')
      WHERE id = 1
    `).run(total_amount, description, target_date, return_percentage, profit_percentage);
    
    const investment = db.prepare('SELECT * FROM investment_config WHERE id = 1').get();
    res.json({ success: true, investment });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al actualizar inversión' });
  }
});

// POST /api/accounting/investment/amortization - Registrar amortización
router.post('/investment/amortization', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { amount, source, reference, date } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: true, message: 'Monto inválido' });
    }
    
    const investment = db.prepare('SELECT * FROM investment_config WHERE id = 1').get();
    if (!investment) {
      return res.status(400).json({ error: true, message: 'No hay inversión configurada' });
    }
    
    const remaining = investment.total_amount - investment.recovered_amount;
    const actualAmount = Math.min(amount, remaining);
    
    if (actualAmount <= 0) {
      return res.status(400).json({ error: true, message: 'La inversión ya está completamente recuperada' });
    }
    
    const id = uuidv4();
    const amortDate = date || new Date().toISOString().split('T')[0];
    
    const recordAmortization = db.transaction(() => {
      // Registrar amortización
      db.prepare(`
        INSERT INTO investment_amortizations (id, amount, source, reference, date)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, actualAmount, source || 'manual', reference, amortDate);
      
      // Actualizar total recuperado
      db.prepare(`
        UPDATE investment_config 
        SET recovered_amount = recovered_amount + ?,
            updated_at = datetime('now')
        WHERE id = 1
      `).run(actualAmount);
    });
    
    recordAmortization();
    
    const updatedInvestment = db.prepare('SELECT * FROM investment_config WHERE id = 1').get();
    const amortization = db.prepare('SELECT * FROM investment_amortizations WHERE id = ?').get(id);
    
    res.status(201).json({ 
      success: true, 
      amortization,
      investment: updatedInvestment
    });
  } catch (err) {
    console.error('Error registrando amortización:', err);
    res.status(500).json({ error: true, message: 'Error al registrar amortización' });
  }
});

// ==================== DATOS PARA GRÁFICOS ====================

// GET /api/accounting/cash-balance - Balance real en caja/bancos
router.get('/cash-balance', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const cashCodes = ['1100', '1101', '1102', '1200', '1120'];
    const placeholders = cashCodes.map(() => '?').join(',');

    const rows = db.prepare(`
      SELECT a.code, a.name,
             COALESCE(SUM(jl.debit - jl.credit), 0) as balance
      FROM journal_lines jl
      JOIN journal_entries je ON jl.entry_id = je.id
      JOIN accounts a ON jl.account_id = a.id
      WHERE a.code IN (${placeholders})
        AND je.status != 'draft'
      GROUP BY a.code, a.name
      ORDER BY a.code
    `).all(...cashCodes);

    const total = rows.reduce((sum, row) => sum + (row.balance || 0), 0);
    res.json({ success: true, total, accounts: rows });
  } catch (err) {
    console.error('Error getting cash balance:', err);
    res.status(500).json({ error: true, message: 'Error al obtener balance de caja' });
  }
});

// GET /api/accounting/charts/income-expense - Datos para gráfico ingresos vs gastos
router.get('/charts/income-expense', authMiddleware, (req, res) => {
  try {
    const { months = 6 } = req.query;
    
    const data = [];
    const now = new Date();
    
    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = date.toISOString().split('T')[0];
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const sales = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as total
        FROM sales
        WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
      `).get(startDate, endDate);
      
      // Simular gastos (en producción vendría de asientos contables)
      const expenses = db.prepare(`
        SELECT COALESCE(SUM(jl.debit), 0) as total
        FROM journal_lines jl
        JOIN accounts a ON jl.account_id = a.id
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE a.type IN ('gasto', 'gastos', 'costos')
          AND DATE(je.date) BETWEEN ? AND ?
      `).get(startDate, endDate);
      
      const monthName = date.toLocaleDateString('es-MX', { month: 'short' });
      
      data.push({
        month: monthName,
        ingresos: sales.total || 0,
        gastos: expenses.total || 0,
        utilidad: (sales.total || 0) - (expenses.total || 0)
      });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener datos de gráfico' });
  }
});

// GET /api/accounting/charts/expense-distribution - Distribución de gastos
router.get('/charts/expense-distribution', authMiddleware, (req, res) => {
  try {
    const expenses = db.prepare(`
      SELECT a.name, ABS(a.balance) as value
      FROM accounts a
      WHERE a.type IN ('gasto', 'gastos') AND a.active = 1 AND a.balance != 0
      ORDER BY ABS(a.balance) DESC
      LIMIT 10
    `).all();
    
    res.json({ success: true, data: expenses });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener distribución de gastos' });
  }
});

export default router;
