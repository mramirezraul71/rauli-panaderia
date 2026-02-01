/**
 * GENESIS - Database Initialization
 * Crea todas las tablas necesarias para el sistema
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crear directorio si no existe
const dbDir = join(__dirname);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const dbPath = join(__dirname, 'genesis.db');
const db = new Database(dbPath);

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

console.log('🔧 Inicializando base de datos GENESIS...\n');

// ==================== ESQUEMA DE TABLAS ====================

const schema = `
-- =====================================================
-- USUARIOS Y AUTENTICACIÓN
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'gerente', 'cajero', 'inventario')),
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =====================================================
-- PRODUCTOS Y CATEGORÍAS
-- =====================================================

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'package',
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT,
  price REAL NOT NULL DEFAULT 0,
  cost REAL DEFAULT 0,
  stock REAL DEFAULT 0,
  min_stock REAL DEFAULT 0,
  unit TEXT DEFAULT 'unidad',
  barcode TEXT UNIQUE,
  is_manufactured INTEGER DEFAULT 0,
  image_url TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- =====================================================
-- VENTAS Y PUNTO DE VENTA
-- =====================================================

CREATE TABLE IF NOT EXISTS cash_registers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY,
  register_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  opening_amount REAL NOT NULL DEFAULT 0,
  closing_amount REAL,
  expected_amount REAL,
  difference REAL,
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'reconciled')),
  opened_at TEXT DEFAULT (datetime('now')),
  closed_at TEXT,
  notes TEXT,
  FOREIGN KEY (register_id) REFERENCES cash_registers(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  local_id TEXT UNIQUE,
  cash_session_id TEXT,
  employee_id TEXT,
  customer_name TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'efectivo' CHECK(payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'mixto')),
  payment_received REAL DEFAULT 0,
  change_given REAL DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'cancelled', 'refunded')),
  notes TEXT,
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  discount REAL DEFAULT 0,
  total REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_employee ON sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales(synced);

-- =====================================================
-- INVENTARIO Y MANUFACTURA
-- =====================================================

CREATE TABLE IF NOT EXISTS inventory_lots (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  batch_number TEXT,
  quantity REAL NOT NULL,
  initial_quantity REAL NOT NULL,
  cost_per_unit REAL DEFAULT 0,
  expiration_date TEXT,
  received_date TEXT DEFAULT (datetime('now')),
  supplier TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'depleted', 'expired', 'damaged')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  yield_quantity REAL NOT NULL DEFAULT 1,
  instructions TEXT,
  prep_time_minutes INTEGER,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT,
  notes TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS production_orders (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  quantity_to_produce REAL NOT NULL,
  quantity_produced REAL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  scheduled_date TEXT,
  started_at TEXT,
  completed_at TEXT,
  employee_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  lot_id TEXT,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('entrada', 'salida', 'ajuste', 'produccion', 'merma', 'venta')),
  quantity REAL NOT NULL,
  previous_stock REAL,
  new_stock REAL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  employee_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (lot_id) REFERENCES inventory_lots(id)
);

CREATE INDEX IF NOT EXISTS idx_lots_expiration ON inventory_lots(expiration_date);
CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id);

-- =====================================================
-- CONTABILIDAD Y FINANZAS
-- =====================================================

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto')),
  parent_id TEXT,
  balance REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  entry_number INTEGER,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  status TEXT DEFAULT 'posted' CHECK(status IN ('draft', 'posted', 'cancelled')),
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  description TEXT,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

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
);

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
);

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
);

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
JOIN accounts a ON jl.account_id = a.id;

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  account_type TEXT,
  balance REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  bank_account_id TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT CHECK(type IN ('deposito', 'retiro', 'transferencia', 'cargo', 'abono')),
  reference TEXT,
  reconciled INTEGER DEFAULT 0,
  reconciled_with TEXT,
  reconciled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);

-- =====================================================
-- RECURSOS HUMANOS
-- =====================================================

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT,
  department TEXT,
  hire_date TEXT,
  salary REAL DEFAULT 0,
  commission_rate REAL DEFAULT 0,
  schedule_type TEXT DEFAULT 'fixed' CHECK(schedule_type IN ('fixed', 'rotating', 'flexible')),
  payroll_cycle TEXT,
  payroll_system TEXT,
  payroll_system_custom TEXT,
  payroll_rules TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  days_of_week TEXT,
  color TEXT DEFAULT '#6366f1',
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS employee_schedules (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  date TEXT NOT NULL,
  actual_start TEXT,
  actual_end TEXT,
  status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'working', 'completed', 'absent', 'late')),
  notes TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (shift_id) REFERENCES shifts(id)
);

CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  amount REAL NOT NULL,
  rate REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS payroll (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  base_salary REAL NOT NULL,
  commissions REAL DEFAULT 0,
  bonuses REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  employer_contribution REAL DEFAULT 0,
  total REAL NOT NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'paid')),
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- =====================================================
-- SINCRONIZACIÓN OFFLINE
-- =====================================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
  data TEXT NOT NULL,
  device_id TEXT,
  priority INTEGER DEFAULT 5,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  device_id TEXT,
  sync_type TEXT CHECK(sync_type IN ('full', 'incremental', 'push', 'pull')),
  entities_synced INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  status TEXT,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

-- =====================================================
-- CONFIGURACIÓN Y SISTEMA
-- =====================================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  type TEXT DEFAULT 'string',
  description TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

// Ejecutar esquema
console.log('📋 Creando tablas...');
db.exec(schema);
console.log('✅ Tablas creadas correctamente\n');

// ==================== DATOS INICIALES ====================

console.log('📦 Insertando datos iniciales...\n');

// Deshabilitar foreign keys temporalmente para seed data
db.pragma('foreign_keys = OFF');

// Usuarios por defecto
const users = [
  { id: uuidv4(), username: 'admin', password: 'admin123', name: 'Administrador', role: 'admin' },
  { id: uuidv4(), username: 'gerente', password: 'gerente123', name: 'Gerente General', role: 'gerente' },
  { id: uuidv4(), username: 'cajero1', password: 'caja123', name: 'Cajero Principal', role: 'cajero' },
];

const insertUser = db.prepare(`
  INSERT OR REPLACE INTO users (id, username, password_hash, name, role)
  VALUES (?, ?, ?, ?, ?)
`);

for (const user of users) {
  const hash = bcrypt.hashSync(user.password, 10);
  insertUser.run(user.id, user.username, hash, user.name, user.role);
  console.log(`  ✓ Usuario creado: ${user.username} (${user.role})`);
}

// Categorías
const categories = [
  { id: uuidv4(), name: 'Productos', color: '#22c55e', icon: 'package' },
  { id: uuidv4(), name: 'Servicios', color: '#3b82f6', icon: 'briefcase' },
  { id: uuidv4(), name: 'Insumos', color: '#f59e0b', icon: 'box' },
  { id: uuidv4(), name: 'Activos', color: '#8b5cf6', icon: 'monitor' },
  { id: uuidv4(), name: 'Otros', color: '#64748b', icon: 'tag' },
];

const insertCategory = db.prepare(`
  INSERT OR REPLACE INTO categories (id, name, color, icon, sort_order)
  VALUES (?, ?, ?, ?, ?)
`);

categories.forEach((cat, idx) => {
  insertCategory.run(cat.id, cat.name, cat.color, cat.icon, idx);
});
console.log(`  ✓ ${categories.length} categorías creadas`);

// Productos de ejemplo
const products = [
  // Productos
  { name: 'Producto A', category: 'Productos', price: 15.00, cost: 6.00, stock: 80, unit: 'unidad' },
  { name: 'Producto B', category: 'Productos', price: 25.00, cost: 10.00, stock: 40, unit: 'unidad' },
  { name: 'Producto C', category: 'Productos', price: 9.50, cost: 3.50, stock: 120, unit: 'unidad' },
  // Servicios
  { name: 'Servicio Básico', category: 'Servicios', price: 50.00, cost: 0, stock: 999, unit: 'servicio', manufactured: false },
  { name: 'Servicio Premium', category: 'Servicios', price: 120.00, cost: 0, stock: 999, unit: 'servicio', manufactured: false },
  // Insumos
  { name: 'Insumo General (kg)', category: 'Insumos', price: 0, cost: 4.00, stock: 150, unit: 'kg', manufactured: false },
  { name: 'Material de Empaque', category: 'Insumos', price: 0, cost: 1.20, stock: 300, unit: 'unidad', manufactured: false },
  // Activos
  { name: 'Equipo de Oficina', category: 'Activos', price: 0, cost: 350.00, stock: 5, unit: 'unidad', manufactured: false },
  // Otros
  { name: 'Accesorio', category: 'Otros', price: 8.00, cost: 2.50, stock: 60, unit: 'unidad' },
];

const insertProduct = db.prepare(`
  INSERT INTO products (id, name, category_id, price, cost, stock, unit, is_manufactured)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getCategoryId = db.prepare('SELECT id FROM categories WHERE name = ?');

for (const prod of products) {
  const categoryRow = getCategoryId.get(prod.category);
  insertProduct.run(
    uuidv4(),
    prod.name,
    categoryRow?.id,
    prod.price,
    prod.cost,
    prod.stock,
    prod.unit,
    prod.manufactured === false ? 0 : 1
  );
}
console.log(`  ✓ ${products.length} productos creados`);

// Cuentas contables
const accounts = [
  { code: '1000', name: 'Activos', type: 'activo' },
  { code: '1100', name: 'Caja', type: 'activo', parent: '1000' },
  { code: '1200', name: 'Bancos', type: 'activo', parent: '1000' },
  { code: '1300', name: 'Inventario', type: 'activo', parent: '1000' },
  { code: '2000', name: 'Pasivos', type: 'pasivo' },
  { code: '2100', name: 'Cuentas por Pagar', type: 'pasivo', parent: '2000' },
  { code: '3000', name: 'Patrimonio', type: 'patrimonio' },
  { code: '3100', name: 'Capital', type: 'patrimonio', parent: '3000' },
  { code: '4000', name: 'Ingresos', type: 'ingreso' },
  { code: '4100', name: 'Ventas', type: 'ingreso', parent: '4000' },
  { code: '5000', name: 'Gastos', type: 'gasto' },
  { code: '5100', name: 'Costo de Ventas', type: 'gasto', parent: '5000' },
  { code: '5200', name: 'Gastos Operativos', type: 'gasto', parent: '5000' },
  { code: '5300', name: 'Gastos de Personal', type: 'gasto', parent: '5000' },
];

const insertAccount = db.prepare(`
  INSERT OR REPLACE INTO accounts (id, code, name, type, parent_id)
  VALUES (?, ?, ?, ?, ?)
`);

const getAccountId = db.prepare('SELECT id FROM accounts WHERE code = ?');

// Primero insertar cuentas padre
for (const acc of accounts.filter(a => !a.parent)) {
  insertAccount.run(uuidv4(), acc.code, acc.name, acc.type, null);
}
// Luego insertar cuentas hijas
for (const acc of accounts.filter(a => a.parent)) {
  const parentRow = getAccountId.get(acc.parent);
  insertAccount.run(uuidv4(), acc.code, acc.name, acc.type, parentRow?.id);
}
console.log(`  ✓ ${accounts.length} cuentas contables creadas`);

// Caja registradora
const registerId = uuidv4();
db.prepare(`
  INSERT INTO cash_registers (id, name, location)
  VALUES (?, 'Caja Principal', 'Mostrador')
`).run(registerId);
console.log('  ✓ Caja registradora creada');

// Empleados
const employees = [
  { name: 'Juan Pérez', position: 'Cajero', commission: 0.02 },
  { name: 'María García', position: 'Operaciones', commission: 0 },
  { name: 'Carlos López', position: 'Gerente', commission: 0.01 },
];

const insertEmployee = db.prepare(`
  INSERT INTO employees (id, code, name, position, commission_rate)
  VALUES (?, ?, ?, ?, ?)
`);

employees.forEach((emp, idx) => {
  insertEmployee.run(uuidv4(), `EMP${String(idx + 1).padStart(3, '0')}`, emp.name, emp.position, emp.commission);
});
console.log(`  ✓ ${employees.length} empleados creados`);

// Turnos
const shifts = [
  { name: 'Mañana', start: '06:00', end: '14:00', color: '#fbbf24' },
  { name: 'Tarde', start: '14:00', end: '22:00', color: '#60a5fa' },
  { name: 'Noche', start: '22:00', end: '06:00', color: '#a78bfa' },
];

const insertShift = db.prepare(`
  INSERT INTO shifts (id, name, start_time, end_time, color)
  VALUES (?, ?, ?, ?, ?)
`);

shifts.forEach(shift => {
  insertShift.run(uuidv4(), shift.name, shift.start, shift.end, shift.color);
});
console.log(`  ✓ ${shifts.length} turnos creados`);

// Configuración inicial
const settings = [
  { key: 'business_name', value: 'Empresa Demo', type: 'string' },
  { key: 'business_ruc', value: '12345678901', type: 'string' },
  { key: 'business_address', value: 'Av. Principal 123', type: 'string' },
  { key: 'tax_rate', value: '0.18', type: 'number' },
  { key: 'currency', value: 'PEN', type: 'string' },
  { key: 'printer_type', value: 'thermal', type: 'string' },
  { key: 'auto_sync', value: 'true', type: 'boolean' },
  { key: 'sync_interval', value: '30', type: 'number' },
];

const insertSetting = db.prepare(`
  INSERT OR REPLACE INTO settings (key, value, type)
  VALUES (?, ?, ?)
`);

settings.forEach(s => {
  insertSetting.run(s.key, s.value, s.type);
});
console.log(`  ✓ ${settings.length} configuraciones creadas`);

// Cuenta bancaria
db.prepare(`
  INSERT INTO bank_accounts (id, name, bank_name, account_number, balance)
  VALUES (?, 'Cuenta Principal', 'Banco Nacional', '1234-5678-9012', 10000)
`).run(uuidv4());
console.log('  ✓ Cuenta bancaria creada');

// Rehabilitar foreign keys
db.pragma('foreign_keys = ON');

db.close();

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ Base de datos inicializada correctamente            ║
║                                                           ║
║   Archivo: ${dbPath}
║                                                           ║
║   Usuarios creados:                                      ║
║   • admin / admin123 (Administrador)                     ║
║   • gerente / gerente123 (Gerente)                       ║
║   • cajero1 / caja123 (Cajero)                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
