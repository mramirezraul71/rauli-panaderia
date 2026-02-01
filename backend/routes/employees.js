/**
 * GENESIS - Employees Routes (RRHH)
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';
import { authMiddleware, requireRole, optionalAuth } from './auth.js';
import { createPayrollEntry } from '../services/accounting.js';
import { sendInvitationEmails, testSmtpConnection } from '../services/email.js';

const ensurePayrollColumns = () => {
  try {
    const columns = db.prepare("PRAGMA table_info(payroll)").all();
    const hasEmployerContribution = columns.some((col) => col.name === 'employer_contribution');
    if (!hasEmployerContribution) {
      db.prepare("ALTER TABLE payroll ADD COLUMN employer_contribution REAL DEFAULT 0").run();
    }
  } catch (err) {
    console.error('Error ensuring payroll columns:', err);
  }
};

const ensureEmployeeColumns = () => {
  try {
    const columns = db.prepare("PRAGMA table_info(employees)").all();
    const hasPayrollCycle = columns.some((col) => col.name === 'payroll_cycle');
    const hasPayrollSystem = columns.some((col) => col.name === 'payroll_system');
    const hasPayrollSystemCustom = columns.some((col) => col.name === 'payroll_system_custom');
    const hasPayrollRules = columns.some((col) => col.name === 'payroll_rules');
    if (!hasPayrollCycle) {
      db.prepare("ALTER TABLE employees ADD COLUMN payroll_cycle TEXT").run();
    }
    if (!hasPayrollSystem) {
      db.prepare("ALTER TABLE employees ADD COLUMN payroll_system TEXT").run();
    }
    if (!hasPayrollSystemCustom) {
      db.prepare("ALTER TABLE employees ADD COLUMN payroll_system_custom TEXT").run();
    }
    if (!hasPayrollRules) {
      db.prepare("ALTER TABLE employees ADD COLUMN payroll_rules TEXT").run();
    }
  } catch (err) {
    console.error('Error ensuring employee columns:', err);
  }
};

const ensureInviteLogsTable = () => {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS invite_logs (
        id TEXT PRIMARY KEY,
        invite_code TEXT,
        invite_email TEXT NOT NULL,
        invite_name TEXT,
        invite_role TEXT,
        owner_email TEXT,
        status TEXT NOT NULL CHECK(status IN ('sent', 'failed')),
        error TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
  } catch (err) {
    console.error('Error ensuring invite logs table:', err);
  }
};

const router = Router();

// ==================== EMPLEADOS ====================

// GET /api/employees - Listar empleados
router.get('/', authMiddleware, (req, res) => {
  try {
    ensureEmployeeColumns();
    const { active = '1', department, position } = req.query;
    
    let sql = `
      SELECT e.*, u.username
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (active !== 'all') {
      sql += ' AND e.active = ?';
      params.push(parseInt(active));
    }
    
    if (department) {
      sql += ' AND e.department = ?';
      params.push(department);
    }
    
    if (position) {
      sql += ' AND e.position = ?';
      params.push(position);
    }
    
    sql += ' ORDER BY e.name';
    
    const employees = db.prepare(sql).all(...params);
    res.json({ success: true, employees });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar empleados' });
  }
});

// POST /api/employees/invitations/send - Enviar invitaciones por email
router.post('/invitations/send', optionalAuth, async (req, res) => {
  try {
    if (req.user && !['admin', 'gerente'].includes(req.user.role)) {
      return res.status(403).json({ error: true, message: 'Acceso denegado' });
    }
    const { ownerEmail, invites = [], appUrl, businessName, language } = req.body;
    if (!ownerEmail) {
      return res.status(400).json({ error: true, message: 'Email del dueño es requerido' });
    }
    const sanitizedInvites = (invites || [])
      .filter((invite) => invite?.email && invite?.code)
      .map((invite) => ({
        code: String(invite.code).trim(),
        email: String(invite.email).trim(),
        name: invite.name ? String(invite.name).trim() : '',
        role: invite.role ? String(invite.role).trim() : 'cajero'
      }));

    if (sanitizedInvites.length === 0) {
      return res.status(400).json({ error: true, message: 'Agrega al menos un email válido' });
    }

    ensureInviteLogsTable();
    const result = await sendInvitationEmails({
      ownerEmail,
      invites: sanitizedInvites,
      appUrl,
      businessName,
      language
    });

    const insertLog = db.prepare(`
      INSERT INTO invite_logs (id, invite_code, invite_email, invite_name, invite_role, owner_email, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const logTx = db.transaction(() => {
      const nowId = () => uuidv4();
      result.sent.forEach((email) => {
        const invite = sanitizedInvites.find((i) => i.email === email);
        insertLog.run(
          nowId(),
          invite?.code || null,
          email,
          invite?.name || null,
          invite?.role || null,
          ownerEmail,
          'sent',
          null
        );
      });
      result.failed.forEach((item) => {
        const invite = sanitizedInvites.find((i) => i.email === item.email);
        insertLog.run(
          nowId(),
          invite?.code || null,
          item.email,
          invite?.name || null,
          invite?.role || null,
          ownerEmail,
          'failed',
          item.error || null
        );
      });
    });
    logTx();

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error enviando invitaciones:', err);
    res.status(500).json({ error: true, message: err.message || 'Error al enviar invitaciones' });
  }
});

// POST /api/employees/invitations/test-smtp - Probar SMTP
router.post('/invitations/test-smtp', optionalAuth, async (req, res) => {
  try {
    if (req.user && !['admin', 'gerente'].includes(req.user.role)) {
      return res.status(403).json({ error: true, message: 'Acceso denegado' });
    }
    const info = await testSmtpConnection();
    res.json({ success: true, message: 'SMTP verificado correctamente.', info });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message || 'Error al verificar SMTP' });
  }
});

// GET /api/employees/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    ensureEmployeeColumns();
    const employee = db.prepare(`
      SELECT e.*, u.username
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = ?
    `).get(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ error: true, message: 'Empleado no encontrado' });
    }
    
    // Estadísticas del empleado
    const stats = db.prepare(`
      SELECT 
        COUNT(s.id) as total_sales,
        COALESCE(SUM(s.total), 0) as total_amount,
        COALESCE(SUM(c.amount), 0) as total_commissions
      FROM employees e
      LEFT JOIN sales s ON e.id = s.employee_id AND s.status = 'completed'
      LEFT JOIN commissions c ON e.id = c.employee_id AND c.status != 'cancelled'
      WHERE e.id = ?
    `).get(req.params.id);
    
    employee.stats = stats;
    res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener empleado' });
  }
});

// POST /api/employees
router.post('/', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    ensureEmployeeColumns();
    const { name, email, phone, position, department, hire_date, salary, commission_rate, schedule_type, user_id, payroll_cycle, payroll_system, payroll_system_custom, payroll_rules } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: true, message: 'Nombre es requerido' });
    }
    
    const id = uuidv4();
    
    // Generar código de empleado
    const lastCode = db.prepare("SELECT code FROM employees WHERE code LIKE 'EMP%' ORDER BY code DESC LIMIT 1").get();
    const nextNum = lastCode ? parseInt(lastCode.code.replace('EMP', '')) + 1 : 1;
    const code = `EMP${String(nextNum).padStart(3, '0')}`;
    
    const normalizedRules = payroll_rules
      ? (typeof payroll_rules === 'string' ? payroll_rules : JSON.stringify(payroll_rules))
      : null;
    db.prepare(`
      INSERT INTO employees (id, code, name, email, phone, position, department, hire_date, salary, commission_rate, schedule_type, payroll_cycle, payroll_system, payroll_system_custom, payroll_rules, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      code,
      name,
      email,
      phone,
      position,
      department,
      hire_date,
      salary || 0,
      commission_rate || 0,
      schedule_type || 'fixed',
      payroll_cycle || null,
      payroll_system || null,
      payroll_system_custom || null,
      normalizedRules,
      user_id
    );
    
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    res.status(201).json({ success: true, employee });
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(500).json({ error: true, message: 'Error al crear empleado' });
  }
});

// PUT /api/employees/:id
router.put('/:id', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    ensureEmployeeColumns();
    const { name, email, phone, position, department, hire_date, salary, commission_rate, schedule_type, active, payroll_cycle, payroll_system, payroll_system_custom, payroll_rules } = req.body;
    const existing = db.prepare('SELECT payroll_cycle, payroll_system, payroll_system_custom, payroll_rules FROM employees WHERE id = ?').get(req.params.id);
    const normalizedRules = payroll_rules === undefined
      ? existing?.payroll_rules
      : (payroll_rules ? (typeof payroll_rules === 'string' ? payroll_rules : JSON.stringify(payroll_rules)) : null);
    const payrollCycleValue = payroll_cycle === undefined ? existing?.payroll_cycle : (payroll_cycle || null);
    const payrollSystemValue = payroll_system === undefined ? existing?.payroll_system : (payroll_system || null);
    const payrollSystemCustomValue = payroll_system_custom === undefined
      ? existing?.payroll_system_custom
      : (payroll_system_custom || null);

    db.prepare(`
      UPDATE employees SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        position = COALESCE(?, position),
        department = COALESCE(?, department),
        hire_date = COALESCE(?, hire_date),
        salary = COALESCE(?, salary),
        commission_rate = COALESCE(?, commission_rate),
        schedule_type = COALESCE(?, schedule_type),
        active = COALESCE(?, active),
        payroll_cycle = ?,
        payroll_system = ?,
        payroll_system_custom = ?,
        payroll_rules = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name,
      email,
      phone,
      position,
      department,
      hire_date,
      salary,
      commission_rate,
      schedule_type,
      active,
      payrollCycleValue,
      payrollSystemValue,
      payrollSystemCustomValue,
      normalizedRules,
      req.params.id
    );
    
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al actualizar empleado' });
  }
});

// ==================== TURNOS ====================

// GET /api/employees/shifts/list - Listar turnos disponibles
router.get('/shifts/list', authMiddleware, (req, res) => {
  try {
    const shifts = db.prepare('SELECT * FROM shifts WHERE active = 1 ORDER BY start_time').all();
    res.json({ success: true, shifts });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar turnos' });
  }
});

// POST /api/employees/shifts - Crear turno
router.post('/shifts', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { name, start_time, end_time, break_minutes, days_of_week, color } = req.body;
    
    if (!name || !start_time || !end_time) {
      return res.status(400).json({ error: true, message: 'Datos incompletos' });
    }
    
    const id = uuidv4();
    db.prepare(`
      INSERT INTO shifts (id, name, start_time, end_time, break_minutes, days_of_week, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, start_time, end_time, break_minutes || 0, days_of_week, color || '#6366f1');
    
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
    res.status(201).json({ success: true, shift });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al crear turno' });
  }
});

// ==================== HORARIOS ====================

// GET /api/employees/schedules - Horarios programados
router.get('/schedules', authMiddleware, (req, res) => {
  try {
    const { employee_id, start_date, end_date } = req.query;
    
    let sql = `
      SELECT es.*, e.name as employee_name, e.code as employee_code, s.name as shift_name, s.start_time, s.end_time, s.color
      FROM employee_schedules es
      JOIN employees e ON es.employee_id = e.id
      JOIN shifts s ON es.shift_id = s.id
      WHERE 1=1
    `;
    const params = [];
    
    if (employee_id) {
      sql += ' AND es.employee_id = ?';
      params.push(employee_id);
    }
    
    if (start_date) {
      sql += ' AND es.date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND es.date <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY es.date, s.start_time';
    
    const schedules = db.prepare(sql).all(...params);
    res.json({ success: true, schedules });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener horarios' });
  }
});

// POST /api/employees/schedules - Asignar turno
router.post('/schedules', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { employee_id, shift_id, date, notes } = req.body;
    
    if (!employee_id || !shift_id || !date) {
      return res.status(400).json({ error: true, message: 'Datos incompletos' });
    }
    
    // Verificar que no existe asignación para ese día
    const existing = db.prepare(`
      SELECT id FROM employee_schedules WHERE employee_id = ? AND date = ?
    `).get(employee_id, date);
    
    if (existing) {
      return res.status(400).json({ error: true, message: 'Ya existe una asignación para ese día' });
    }
    
    const id = uuidv4();
    db.prepare(`
      INSERT INTO employee_schedules (id, employee_id, shift_id, date, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, employee_id, shift_id, date, notes);
    
    const schedule = db.prepare(`
      SELECT es.*, e.name as employee_name, s.name as shift_name
      FROM employee_schedules es
      JOIN employees e ON es.employee_id = e.id
      JOIN shifts s ON es.shift_id = s.id
      WHERE es.id = ?
    `).get(id);
    
    res.status(201).json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al asignar turno' });
  }
});

// POST /api/employees/schedules/bulk - Asignación masiva de turnos rotativos
router.post('/schedules/bulk', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { assignments } = req.body;
    // assignments: [{ employee_id, shift_id, dates: ['2024-01-15', '2024-01-16', ...] }]
    
    const results = { created: 0, skipped: 0 };
    
    const checkExisting = db.prepare('SELECT id FROM employee_schedules WHERE employee_id = ? AND date = ?');
    const insertSchedule = db.prepare(`
      INSERT INTO employee_schedules (id, employee_id, shift_id, date)
      VALUES (?, ?, ?, ?)
    `);
    
    const transaction = db.transaction(() => {
      for (const assignment of assignments) {
        for (const date of assignment.dates) {
          const existing = checkExisting.get(assignment.employee_id, date);
          if (!existing) {
            insertSchedule.run(uuidv4(), assignment.employee_id, assignment.shift_id, date);
            results.created++;
          } else {
            results.skipped++;
          }
        }
      }
    });
    
    transaction();
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error en asignación masiva' });
  }
});

// PUT /api/employees/schedules/:id/check-in - Marcar entrada
router.put('/schedules/:id/check-in', authMiddleware, (req, res) => {
  try {
    const now = new Date().toTimeString().split(' ')[0];
    
    db.prepare(`
      UPDATE employee_schedules SET
        actual_start = ?,
        status = 'working'
      WHERE id = ?
    `).run(now, req.params.id);
    
    const schedule = db.prepare('SELECT * FROM employee_schedules WHERE id = ?').get(req.params.id);
    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al registrar entrada' });
  }
});

// PUT /api/employees/schedules/:id/check-out - Marcar salida
router.put('/schedules/:id/check-out', authMiddleware, (req, res) => {
  try {
    const now = new Date().toTimeString().split(' ')[0];
    
    db.prepare(`
      UPDATE employee_schedules SET
        actual_end = ?,
        status = 'completed'
      WHERE id = ?
    `).run(now, req.params.id);
    
    const schedule = db.prepare('SELECT * FROM employee_schedules WHERE id = ?').get(req.params.id);
    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al registrar salida' });
  }
});

// ==================== COMISIONES ====================

// GET /api/employees/commissions - Listar comisiones
router.get('/commissions', authMiddleware, (req, res) => {
  try {
    const { employee_id, status, start_date, end_date } = req.query;
    
    let sql = `
      SELECT c.*, e.name as employee_name, e.code as employee_code, s.total as sale_total
      FROM commissions c
      JOIN employees e ON c.employee_id = e.id
      JOIN sales s ON c.sale_id = s.id
      WHERE 1=1
    `;
    const params = [];
    
    if (employee_id) {
      sql += ' AND c.employee_id = ?';
      params.push(employee_id);
    }
    
    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    
    if (start_date) {
      sql += ' AND DATE(c.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND DATE(c.created_at) <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY c.created_at DESC';
    
    const commissions = db.prepare(sql).all(...params);
    
    // Totales
    const totals = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount) as total
      FROM commissions
      WHERE 1=1 ${employee_id ? 'AND employee_id = ?' : ''}
      GROUP BY status
    `).all(employee_id ? [employee_id] : []);
    
    res.json({ success: true, commissions, totals });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al listar comisiones' });
  }
});

// POST /api/employees/commissions/approve - Aprobar comisiones
router.post('/commissions/approve', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    const { commission_ids } = req.body;
    
    db.prepare(`
      UPDATE commissions SET status = 'approved' WHERE id IN (${commission_ids.map(() => '?').join(',')}) AND status = 'pending'
    `).run(...commission_ids);
    
    res.json({ success: true, message: 'Comisiones aprobadas' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al aprobar comisiones' });
  }
});

// POST /api/employees/commissions/pay - Pagar comisiones
router.post('/commissions/pay', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { commission_ids } = req.body;
    
    db.prepare(`
      UPDATE commissions SET status = 'paid', paid_at = datetime('now') 
      WHERE id IN (${commission_ids.map(() => '?').join(',')}) AND status = 'approved'
    `).run(...commission_ids);
    
    res.json({ success: true, message: 'Comisiones pagadas' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al pagar comisiones' });
  }
});

// ==================== NÓMINA ====================

// GET /api/employees/payroll - Historial de nómina
router.get('/payroll', authMiddleware, requireRole('admin', 'gerente'), (req, res) => {
  try {
    ensurePayrollColumns();
    const { employee_id, status, limit = 50 } = req.query;
    
    let sql = `
      SELECT p.*, e.name as employee_name, e.code as employee_code
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    
    if (employee_id) {
      sql += ' AND p.employee_id = ?';
      params.push(employee_id);
    }
    
    if (status) {
      sql += ' AND p.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY p.period_end DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const payrolls = db.prepare(sql).all(...params);
    res.json({ success: true, payrolls });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener nómina' });
  }
});

// POST /api/employees/payroll/generate - Generar nómina
router.post('/payroll/generate', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    ensurePayrollColumns();
    ensureEmployeeColumns();
    const { period_start, period_end, employee_ids } = req.body;
    
    if (!period_start || !period_end) {
      return res.status(400).json({ error: true, message: 'Período requerido' });
    }
    
    const employees = employee_ids 
      ? db.prepare(`SELECT * FROM employees WHERE id IN (${employee_ids.map(() => '?').join(',')}) AND active = 1`).all(...employee_ids)
      : db.prepare('SELECT * FROM employees WHERE active = 1').all();
    
    const getSetting = (key, fallback = null) => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return row?.value ?? fallback;
    };

    const payrollSystem = getSetting('payroll_system', 'mensual');
    const payrollSystemCustom = getSetting('payroll_system_custom', '');
    const payrollRules = (() => {
      try {
        const raw = getSetting('payroll_rules', '{}');
        return JSON.parse(raw || '{}');
      } catch {
        return {};
      }
    })();

    const parseTimeToHours = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return (h || 0) + ((m || 0) / 60);
    };

    const diffHours = (start, end) => {
      if (!start || !end) return 0;
      const s = parseTimeToHours(start);
      const e = parseTimeToHours(end);
      if (e >= s) return e - s;
      return (24 - s) + e;
    };

    const isNightShift = (start, end) => {
      const s = parseTimeToHours(start);
      const e = parseTimeToHours(end);
      return s >= 22 || e <= 6;
    };

    const isWeekend = (dateStr) => {
      const d = new Date(dateStr);
      const day = d.getDay();
      return day === 0 || day === 6;
    };

    const results = [];
    
    for (const emp of employees) {
      const employeePayrollSystem = emp.payroll_system || payrollSystem;
      const employeePayrollSystemCustom = emp.payroll_system_custom || payrollSystemCustom;
      const employeePayrollRules = (() => {
        if (!emp.payroll_rules) return payrollRules;
        try {
          return { ...payrollRules, ...JSON.parse(emp.payroll_rules) };
        } catch {
          return payrollRules;
        }
      })();
      // Calcular comisiones del período
      const commissions = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM commissions
        WHERE employee_id = ? AND status IN ('pending', 'approved') AND DATE(created_at) BETWEEN ? AND ?
      `).get(emp.id, period_start, period_end);
      
      const id = uuidv4();
      let baseSalary = emp.salary || 0;

      if (employeePayrollSystem === 'hora' || employeePayrollRules.hourly) {
        const schedules = db.prepare(`
          SELECT es.*, s.start_time, s.end_time
          FROM employee_schedules es
          JOIN shifts s ON es.shift_id = s.id
          WHERE es.employee_id = ? AND es.date BETWEEN ? AND ?
        `).all(emp.id, period_start, period_end);

        const hourlyRate = (emp.salary || 0) / 160;
        let totalHours = 0;
        let totalAmount = 0;

        schedules.forEach((sch) => {
          const scheduledHours = diffHours(sch.start_time, sch.end_time);
          const actualHours = sch.actual_start && sch.actual_end
            ? diffHours(sch.actual_start, sch.actual_end)
            : scheduledHours;
          const extraHours = Math.max(actualHours - scheduledHours, 0);
          const baseHours = actualHours - extraHours;
          let multiplier = 1;
          if (isNightShift(sch.start_time, sch.end_time)) {
            multiplier *= Number(employeePayrollRules.nightMultiplier || 1);
          }
          if (isWeekend(sch.date)) {
            multiplier *= Number(employeePayrollRules.weekendMultiplier || 1);
          }
          totalHours += actualHours;
          totalAmount += (baseHours * hourlyRate * multiplier);
          if (extraHours > 0) {
            totalAmount += (extraHours * hourlyRate * Number(employeePayrollRules.overtimeMultiplier || 1));
          }
        });

        baseSalary = totalAmount || (emp.salary || 0);
      }

      let bonus = 0;
      const deductionsPercent = Number(employeePayrollRules.deductionsPercent || 0) / 100;
      const employerContributionPercent = Number(employeePayrollRules.employerContributionPercent || 0) / 100;
      const bonusType = employeePayrollRules.performanceBonus || 'none';
      const bonusPercent = Number(employeePayrollRules.profitSharePercent || 0) / 100;

      if (bonusType === 'sales' && bonusPercent > 0) {
        const salesTotal = db.prepare(`
          SELECT COALESCE(SUM(total), 0) as total
          FROM sales
          WHERE employee_id = ? AND status = 'completed'
            AND DATE(created_at) BETWEEN ? AND ?
        `).get(emp.id, period_start, period_end);
        bonus = (salesTotal.total || 0) * bonusPercent;
      }

      if (bonusType === 'production' && bonusPercent > 0) {
        const production = db.prepare(`
          SELECT COALESCE(SUM(quantity_produced), 0) as qty
          FROM production_orders
          WHERE employee_id = ? AND status = 'completed'
            AND DATE(completed_at) BETWEEN ? AND ?
        `).get(emp.id, period_start, period_end);
        bonus = (production.qty || 0) * bonusPercent;
      }

      if (bonusType === 'profit' && bonusPercent > 0) {
        const salesTotal = db.prepare(`
          SELECT COALESCE(SUM(total), 0) as total
          FROM sales
          WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?
        `).get(period_start, period_end);

        const expensesTotal = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM expenses
          WHERE deleted_at IS NULL AND DATE(date) BETWEEN ? AND ?
        `).get(period_start, period_end);

        const cogsTotal = db.prepare(`
          SELECT COALESCE(SUM(si.quantity * p.cost), 0) as total
          FROM sale_items si
          JOIN products p ON si.product_id = p.id
          JOIN sales s ON si.sale_id = s.id
          WHERE s.status = 'completed' AND DATE(s.created_at) BETWEEN ? AND ?
        `).get(period_start, period_end);

        const profit = (salesTotal.total || 0) - (expensesTotal.total || 0) - (cogsTotal.total || 0);
        bonus = profit > 0 ? profit * bonusPercent : 0;
      }

      const grossTotal = baseSalary + commissions.total + bonus;
      const deductions = grossTotal * deductionsPercent;
      const employerContribution = grossTotal * employerContributionPercent;
      const total = grossTotal - deductions;
      
      db.prepare(`
        INSERT INTO payroll (id, employee_id, period_start, period_end, base_salary, commissions, bonuses, deductions, employer_contribution, total, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
      `).run(id, emp.id, period_start, period_end, baseSalary, commissions.total, bonus, deductions, employerContribution, total);
      
      results.push({
        id,
        employee_name: emp.name,
        base_salary: baseSalary,
        commissions: commissions.total,
        bonuses: bonus,
        deductions,
        employer_contribution: employerContribution,
        total
      });
    }
    
    res.json({ success: true, payrolls: results });
  } catch (err) {
    console.error('Error generating payroll:', err);
    res.status(500).json({ error: true, message: 'Error al generar nómina' });
  }
});

// PUT /api/employees/payroll/:id/approve
router.put('/payroll/:id/approve', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    db.prepare('UPDATE payroll SET status = "approved" WHERE id = ? AND status = "draft"')
      .run(req.params.id);
    
    res.json({ success: true, message: 'Nómina aprobada' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al aprobar nómina' });
  }
});

// PUT /api/employees/payroll/:id/pay
router.put('/payroll/:id/pay', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    ensurePayrollColumns();
    const payroll = db.prepare('SELECT * FROM payroll WHERE id = ?').get(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({ error: true, message: 'Nómina no encontrada' });
    }

    if (payroll.status === 'paid') {
      return res.status(400).json({ error: true, message: 'Nómina ya pagada' });
    }
    
    const pay = db.transaction(() => {
      // Marcar nómina como pagada
      db.prepare('UPDATE payroll SET status = "paid", paid_at = datetime("now") WHERE id = ?')
        .run(req.params.id);
      
      // Marcar comisiones incluidas como pagadas
      db.prepare(`
        UPDATE commissions SET status = 'paid', paid_at = datetime('now')
        WHERE employee_id = ? AND status IN ('pending', 'approved')
          AND DATE(created_at) BETWEEN ? AND ?
      `).run(payroll.employee_id, payroll.period_start, payroll.period_end);
    });
    
    pay();

    try {
      const existingEntry = db.prepare(
        "SELECT id FROM journal_entries WHERE reference_type = 'payroll' AND reference_id = ?"
      ).get(payroll.id);
      if (!existingEntry) {
        createPayrollEntry(payroll, { createdBy: req.user?.id });
      }
    } catch (entryErr) {
      console.error('Error creating payroll journal entry:', entryErr);
    }
    
    res.json({ success: true, message: 'Nómina pagada' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al pagar nómina' });
  }
});

// GET /api/employees/dashboard - Dashboard RRHH
router.get('/dashboard', authMiddleware, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Empleados activos
    const activeEmployees = db.prepare('SELECT COUNT(*) as count FROM employees WHERE active = 1').get();
    
    // Turnos de hoy
    const todaySchedules = db.prepare(`
      SELECT es.*, e.name as employee_name, s.name as shift_name, s.start_time, s.end_time
      FROM employee_schedules es
      JOIN employees e ON es.employee_id = e.id
      JOIN shifts s ON es.shift_id = s.id
      WHERE es.date = ?
      ORDER BY s.start_time
    `).all(today);
    
    // Comisiones pendientes
    const pendingCommissions = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM commissions WHERE status = 'pending'
    `).get();
    
    // Top vendedores del mes
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const topSellers = db.prepare(`
      SELECT e.name, e.code, COUNT(s.id) as sales_count, SUM(s.total) as total_sales
      FROM employees e
      JOIN sales s ON e.id = s.employee_id
      WHERE DATE(s.created_at) >= ? AND s.status = 'completed'
      GROUP BY e.id
      ORDER BY total_sales DESC
      LIMIT 5
    `).all(monthStart);
    
    res.json({
      success: true,
      dashboard: {
        active_employees: activeEmployees.count,
        today_schedules: todaySchedules,
        pending_commissions: pendingCommissions,
        top_sellers: topSellers
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener dashboard' });
  }
});

export default router;
