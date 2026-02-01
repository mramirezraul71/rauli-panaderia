import Dexie from "dexie";

export const db = new Dexie("GenesisDB");

db.version(3).stores({
  products: "id, name, barcode, category_id, active, deleted_at, synced",
  categories: "id, name, active, deleted_at",
  sales: "id, local_id, created_at, customer_id, payment_status, status, synced, voided_at",
  saleItems: "id, sale_id, product_id, deleted_at",
  customers: "++id, name, phone, email, active, deleted_at",
  accounts: "id, code, name, type, parent, active",
  journalEntries: "id, entry_number, date, reference_type, reference_id, status, voided_at",
  journalLines: "id, entry_id, account_id",
  transactions: "++id, type, customer_id, reference_id, date, deleted_at",
  expenses: "++id, date, category, vendor, amount, status, evidence_id, ai_extracted, deleted_at, synced",
  inventoryMovements: "++id, product_id, movement_type, date, reference_id, deleted_at",
  shrinkage: "++id, product_id, reason, quantity, evidence_id, date, approved, approved_by, deleted_at",
  evidences: "id, type, context, reference_type, reference_id, ai_analyzed, created_at, deleted_at, synced",
  evidenceBlobs: "id, evidence_id, data, mime_type",
  cashSessions: "id, opened_at, closed_at, status, user_id",
  cashMovements: "id, session_id, type, created_at",
  cashVariances: "id, session_id, variance_type, created_at",
  deliveries: "id, sale_id, customer_name, status, delivered_at, deleted_at",
  investments: "++id, type, amount, date, status, amortization_rate, amortized, remaining, deleted_at",
  settings: "key",
  syncQueue: "++id, entity_type, operation, synced, created_at",
  systemAlerts: "++id, type, severity, acknowledged, created_at, deleted_at",
  auditLog: "++id, entity_type, entity_id, action, user_id, details, timestamp",
  users: "++id, username, email, role, active, deleted_at"
});

db.version(4).stores({
  products: "id, name, barcode, category_id, active, deleted_at, synced",
  categories: "id, name, active, deleted_at",
  sales: "id, local_id, created_at, customer_id, payment_status, status, synced, voided_at",
  saleItems: "id, sale_id, product_id, deleted_at",
  customers: "++id, name, phone, email, active, deleted_at",
  accounts: "id, code, name, type, parent, active",
  journalEntries: "id, entry_number, date, reference_type, reference_id, status, voided_at",
  journalLines: "id, entry_id, account_id",
  transactions: "++id, type, customer_id, reference_id, date, deleted_at",
  expenses: "++id, date, category, vendor, amount, status, evidence_id, ai_extracted, deleted_at, synced",
  inventoryMovements: "++id, product_id, movement_type, date, reference_id, deleted_at",
  shrinkage: "++id, product_id, reason, quantity, evidence_id, date, approved, approved_by, deleted_at",
  evidences: "id, type, context, reference_type, reference_id, ai_analyzed, created_at, deleted_at, synced",
  evidenceBlobs: "id, evidence_id, data, mime_type",
  cashSessions: "id, opened_at, closed_at, status, user_id",
  cashMovements: "id, session_id, type, created_at",
  cashVariances: "id, session_id, variance_type, created_at",
  deliveries: "id, sale_id, customer_name, status, delivered_at, deleted_at",
  investments: "++id, type, amount, date, status, amortization_rate, amortized, remaining, deleted_at",
  settings: "key",
  syncQueue: "++id, entity_type, operation, synced, created_at",
  systemAlerts: "++id, type, severity, acknowledged, created_at, deleted_at",
  auditLog: "++id, entity_type, entity_id, action, user_id, details, timestamp",
  users: "++id, username, email, role, active, deleted_at",
  inspectionTemplates: "id, product_id, active, created_at",
  qualityLogs: "id, product_id, template_id, result, created_at",
  nonConformities: "id, product_id, quality_log_id, status, created_at"
});

db.version(5).stores({
  products: "id, name, barcode, category_id, active, deleted_at, synced",
  categories: "id, name, active, deleted_at",
  sales: "id, local_id, created_at, customer_id, payment_status, status, synced, voided_at",
  saleItems: "id, sale_id, product_id, deleted_at",
  customers: "++id, name, phone, email, active, deleted_at",
  accounts: "id, code, name, type, parent, active",
  journalEntries: "id, entry_number, date, reference_type, reference_id, status, voided_at",
  journalLines: "id, entry_id, account_id",
  transactions: "++id, type, customer_id, reference_id, date, deleted_at",
  expenses: "++id, date, category, vendor, amount, status, evidence_id, ai_extracted, deleted_at, synced",
  inventoryMovements: "++id, product_id, movement_type, date, reference_id, deleted_at",
  shrinkage: "++id, product_id, reason, quantity, evidence_id, date, approved, approved_by, deleted_at",
  evidences: "id, type, context, reference_type, reference_id, ai_analyzed, created_at, deleted_at, synced",
  evidenceBlobs: "id, evidence_id, data, mime_type",
  cashSessions: "id, opened_at, closed_at, status, user_id",
  cashMovements: "id, session_id, type, created_at",
  cashVariances: "id, session_id, variance_type, created_at",
  deliveries: "id, sale_id, customer_name, status, delivered_at, deleted_at",
  investments: "++id, type, amount, date, status, amortization_rate, amortized, remaining, deleted_at",
  settings: "key",
  syncQueue: "++id, entity_type, operation, synced, created_at",
  systemAlerts: "++id, type, severity, acknowledged, created_at, deleted_at",
  auditLog: "++id, entity_type, entity_id, action, user_id, details, timestamp",
  users: "++id, username, email, role, active, deleted_at",
  inspectionTemplates: "id, product_id, active, created_at",
  qualityLogs: "id, product_id, template_id, result, created_at",
  nonConformities: "id, product_id, quality_log_id, status, created_at",
  costCenters: "id, code, name, active, created_at",
  costAllocations: "id, center_id, source_type, source_id, date, created_at",
  costPlans: "id, name, start_date, end_date, created_at"
});

db.version(6).stores({
  products: "id, name, barcode, category_id, active, deleted_at, synced",
  categories: "id, name, active, deleted_at",
  sales: "id, local_id, created_at, customer_id, payment_status, status, synced, voided_at",
  saleItems: "id, sale_id, product_id, deleted_at",
  customers: "++id, name, phone, email, active, deleted_at",
  accounts: "id, code, name, type, parent, active",
  journalEntries: "id, entry_number, date, reference_type, reference_id, status, voided_at, created_at",
  journalLines: "id, entry_id, account_id",
  transactions: "++id, type, customer_id, reference_id, date, deleted_at",
  expenses: "++id, date, category, vendor, amount, status, evidence_id, ai_extracted, deleted_at, synced",
  inventoryMovements: "++id, product_id, movement_type, date, reference_id, deleted_at",
  shrinkage: "++id, product_id, reason, quantity, evidence_id, date, approved, approved_by, deleted_at",
  evidences: "id, type, context, reference_type, reference_id, ai_analyzed, created_at, deleted_at, synced",
  evidenceBlobs: "id, evidence_id, data, mime_type",
  cashSessions: "id, opened_at, closed_at, status, user_id",
  cashMovements: "id, session_id, type, created_at",
  cashVariances: "id, session_id, variance_type, created_at",
  deliveries: "id, sale_id, customer_name, status, delivered_at, deleted_at",
  investments: "++id, type, amount, date, status, amortization_rate, amortized, remaining, deleted_at",
  settings: "key",
  syncQueue: "++id, entity_type, operation, synced, created_at",
  systemAlerts: "++id, type, severity, acknowledged, created_at, deleted_at",
  auditLog: "++id, entity_type, entity_id, action, user_id, details, timestamp",
  users: "++id, username, email, role, active, deleted_at",
  inspectionTemplates: "id, product_id, active, created_at",
  qualityLogs: "id, product_id, template_id, result, created_at",
  nonConformities: "id, product_id, quality_log_id, status, created_at",
  costCenters: "id, code, name, active, created_at",
  costAllocations: "id, center_id, source_type, source_id, date, created_at",
  costPlans: "id, name, start_date, end_date, created_at"
});

// 
// HELPER EXPORTS
// 

export const CategoriesDB = {
  async getAll() {
    try { return await db.categories?.where("active").equals(1).toArray() || []; } 
    catch (e) { return []; }
  },
  async create(data) {
    const id = `cat_${Date.now()}`;
    await db.categories?.add({ id, ...data, active: 1, deleted_at: null });
    return { id, ...data };
  },
  async update(id, data) { await db.categories?.update(id, data); },
  async delete(id) { await db.categories?.update(id, { active: 0, deleted_at: new Date().toISOString() }); }
};

export const ProductsDB = {
  async getAll() {
    try { return await db.products?.where("active").equals(1).toArray() || []; }
    catch (e) { return []; }
  },
  async create(data) {
    const id = data.id || `prod_${Date.now()}`;
    await db.products?.add({ id, ...data, active: 1, deleted_at: null, synced: 0 });
    return { id, ...data };
  },
  async update(id, data) { await db.products?.update(id, data); },
  async delete(id) { await db.products?.update(id, { active: 0, deleted_at: new Date().toISOString() }); },
  async adjustStock(id, qty) {
    const p = await db.products?.get(id);
    if (p) await db.products?.update(id, { stock: (p.stock || 0) + qty });
  }
};

export const CustomersDB = {
  async getAll() {
    try { return await db.customers?.where("active").equals(1).toArray() || []; }
    catch (e) { return []; }
  },
  async create(data) {
    const id = await db.customers?.add({ ...data, active: 1, balance: 0, deleted_at: null });
    return { id, ...data };
  },
  async update(id, data) { await db.customers?.update(id, data); },
  async delete(id) { await db.customers?.update(id, { active: 0, deleted_at: new Date().toISOString() }); },
  async updateBalance(id, amount) {
    const c = await db.customers?.get(id);
    if (c) await db.customers?.update(id, { balance: (c.balance || 0) + amount });
  }
};

export const SalesDB = {
  async getAll() {
    try { return await db.sales?.toArray() || []; }
    catch (e) { return []; }
  },
  async getByDateRange(start, end) {
    try { return await db.sales?.where("created_at").between(start, end).toArray() || []; }
    catch (e) { return []; }
  },
  async create(data) {
    const id = data.id || `sale_${Date.now()}`;
    await db.sales?.add({ id, ...data, voided_at: null });
    return { id, ...data };
  },
  async void(id) { await db.sales?.update(id, { voided_at: new Date().toISOString() }); }
};

export const TransactionsDB = {
  async getAll() {
    try { return await db.transactions?.toArray() || []; }
    catch (e) { return []; }
  },
  async create(data) {
    const id = await db.transactions?.add({ ...data, deleted_at: null });
    return { id, ...data };
  }
};

export const ExpensesDB = {
  async getAll() {
    try { return await db.expenses?.filter(e => !e.deleted_at).toArray() || []; }
    catch (e) { return []; }
  },
  async create(data) {
    const id = await db.expenses?.add({ ...data, deleted_at: null, synced: 0 });
    return { id, ...data };
  },
  async delete(id) { await db.expenses?.update(id, { deleted_at: new Date().toISOString() }); }
};

export const EvidenceDB = {
  async save(data) {
    const id = `ev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.evidences?.add({ id, ...data, created_at: new Date().toISOString(), deleted_at: null, synced: 0 });
    return { id, ...data };
  },
  async get(id) { return await db.evidences?.get(id); },
  async getByReference(type, refId) {
    return await db.evidences?.filter(e => e.reference_type === type && e.reference_id === refId && !e.deleted_at).toArray() || [];
  }
};

export const SettingsDB = {
  async get(key) {
    try {
      const s = await db.settings?.get(key);
      return s?.value ? JSON.parse(s.value) : null;
    } catch (e) { return null; }
  },
  async set(key, value) {
    await db.settings?.put({ key, value: JSON.stringify(value) });
  }
};

export const CacheDB = {
  async get(key) { return await SettingsDB.get(key); },
  async set(key, value) { return await SettingsDB.set(key, value); },
  async delete(key) { await db.settings?.delete(key); }
};

export const UsersDB = {
  async getAll() {
    try { return await db.users?.toArray() || []; }
    catch (e) { return []; }
  },
  async getByUsername(username) {
    return await db.users?.where("username").equals(username).first() || null;
  },
  async create(data) {
    const id = await db.users?.add({ ...data, active: 1, deleted_at: null });
    return { id, ...data };
  },
  async update(id, data) {
    await db.users?.update(id, data);
  },
  async delete(id) {
    await db.users?.update(id, { active: 0, deleted_at: new Date().toISOString() });
  }
};

export const InvestmentDB = {
  async getAll() {
    try { return await db.investments?.filter(i => !i.deleted_at).toArray() || []; }
    catch (e) { return []; }
  },
  async create(data) {
    const id = await db.investments?.add({ ...data, amortized: 0, remaining: data.amount, status: "active", deleted_at: null });
    return { id, ...data };
  },
  async getSummary() {
    const investments = await this.getAll();
    return {
      total_invested: investments.reduce((s, i) => s + (i.amount || 0), 0),
      total_amortized: investments.reduce((s, i) => s + (i.amortized || 0), 0),
      total_remaining: investments.reduce((s, i) => s + (i.remaining || 0), 0)
    };
  }
};

export const SoftDelete = {
  async mark(table, id) {
    await db[table]?.update(id, { active: 0, deleted_at: new Date().toISOString() });
  },
  async restore(table, id) {
    await db[table]?.update(id, { active: 1, deleted_at: null });
  }
};

export async function logAudit(entityType, entityId, action, userId = null, details = null) {
  try {
    await db.auditLog?.add({
      entity_type: entityType,
      entity_id: String(entityId),
      action,
      user_id: userId,
      details: details ? JSON.stringify(details) : null,
      timestamp: new Date().toISOString()
    });
  } catch (e) { console.error("Audit log failed:", e); }
}

export default db;
