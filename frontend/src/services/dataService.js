import db, {
  CategoriesDB,
  ProductsDB,
  CustomersDB,
  SalesDB,
  TransactionsDB,
  ExpensesDB,
  EvidenceDB,
  SettingsDB,
  CacheDB,
  UsersDB,
  InvestmentDB,
  SoftDelete,
  logAudit
} from "../db/localDB";

const SystemAlertsDB = {
  async checkHealth() {
    try {
      const alerts = await db.systemAlerts?.filter(a => !a.deleted_at && !a.acknowledged).toArray() || [];
      return alerts;
    } catch {
      return [];
    }
  }
};

const AccountsDB = {
  async initialize() {
    return;
  },
  async create(data) {
    const id = data.id || `acc_${Date.now()}`;
    await db.accounts?.add({ id, ...data, active: 1 });
    return { id, ...data };
  },
  async update(id, data) {
    await db.accounts?.update(id, data);
  },
  async delete(id) {
    await db.accounts?.update(id, { active: 0 });
  }
};

const JournalDB = {
  async create(entry) {
    const id = entry.id || `je_${Date.now()}`;
    await db.journalEntries?.add({ id, ...entry, status: "posted" });
    return { id, ...entry };
  }
};

const fuzzyMatch = (query, list) => {
  const term = (query || "").toLowerCase();
  if (!term) return list || [];
  return (list || []).filter(item => String(item || "").toLowerCase().includes(term));
};

// Helper para SentinelService
const localDB = {
  async getPendingSyncCount() {
    try {
      const count = await db.syncQueue?.where("synced").equals(0).count();
      return count || 0;
    } catch (err) {
      console.warn("localDB.getPendingSyncCount error:", err);
      return 0;
    }
  },
  async getPendingSync() {
    try {
      const pending = await db.syncQueue?.where("synced").equals(0).toArray();
      return pending || [];
    } catch (err) {
      console.warn("localDB.getPendingSync error:", err);
      return [];
    }
  }
};

export {
  db,
  CategoriesDB,
  ProductsDB,
  CustomersDB,
  SalesDB,
  TransactionsDB,
  ExpensesDB,
  EvidenceDB,
  SettingsDB,
  CacheDB,
  UsersDB,
  InvestmentDB,
  AccountsDB,
  JournalDB,
  SystemAlertsDB,
  SoftDelete,
  logAudit,
  fuzzyMatch,
  localDB
};

export default localDB;
