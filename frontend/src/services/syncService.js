/**
 * SYNC SERVICE v3.0 - Simplified
 * Handles offline/online sync (currently disabled for local-only mode)
 */

import { db } from "./dataService";

const API_BASE = "/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const apiFetch = async (path, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...getAuthHeaders(), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: {}, error };
  }
};

const processQueuedItem = async (item) => {
  const payload = item?.data ? JSON.parse(item.data) : {};
  if (item.entity_type === "products") {
    if (item.operation === "create") {
      return apiFetch("/products", { method: "POST", body: JSON.stringify(payload) });
    }
    if (item.operation === "update") {
      return apiFetch(`/products/${payload.id}`, { method: "PUT", body: JSON.stringify(payload) });
    }
    if (item.operation === "delete") {
      return apiFetch(`/products/${payload.id}`, { method: "DELETE" });
    }
  }
  if (item.entity_type === "sales" && item.operation === "create") {
    return apiFetch("/sales", { method: "POST", body: JSON.stringify(payload) });
  }
  return { ok: false, status: 400, data: { message: "Operacion no soportada" } };
};

// Export stubs for compatibility
export const CacheDB = {
  async get(key) {
    try {
      const s = await db.settings?.get(key);
      return s?.value ? JSON.parse(s.value) : null;
    } catch (e) { return null; }
  },
  async set(key, value) {
    await db.settings?.put({ key, value: JSON.stringify(value) });
  },
  async delete(key) {
    await db.settings?.delete(key);
  }
};

export const CategoriesDB = {
  async getAll() { return await db.categories?.toArray() || []; },
  async create(data) { return await db.categories?.add(data); },
  async update(id, data) { return await db.categories?.update(id, data); },
  async delete(id) { return await db.categories?.delete(id); }
};

export const EmployeesDB = {
  async getAll() { return await db.users?.toArray() || []; },
  async create(data) { return await db.users?.add(data); },
  async update(id, data) { return await db.users?.update(id, data); },
  async delete(id) { return await db.users?.delete(id); }
};

export const SyncService = {
  isOnline: () => navigator.onLine,
  
  async queueOperation(entityType, operation, data) {
    console.log(`[Sync] Queued: ${entityType} - ${operation}`);
    // Store in sync queue for later
    try {
      await db.syncQueue?.add({
        entity_type: entityType,
        operation,
        data: JSON.stringify(data),
        synced: 0,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.error("Queue error:", e);
    }
  },

  async processQueue() {
    if (!navigator.onLine) return;
    console.log("[Sync] Processing queue...");
    // Process pending items when online
    try {
      const pending = await db.syncQueue?.where("synced").equals(0).toArray() || [];
      console.log(`[Sync] ${pending.length} items pending`);
      for (const item of pending) {
        const result = await processQueuedItem(item);
        if (result.ok) {
          await db.syncQueue?.update(item.id, { synced: 1 });
        }
      }
    } catch (e) {
      console.error("Sync error:", e);
    }
  },

  init() {
    // Listen for online/offline events
    window.addEventListener("online", () => {
      console.log("[Sync] Online - processing queue");
      this.processQueue();
    });
    window.addEventListener("offline", () => {
      console.log("[Sync] Offline - queuing operations");
    });
  }
};

// Initialize on load
if (typeof window !== "undefined") {
  SyncService.init();
}

export default SyncService;
