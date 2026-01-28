import { db, logAudit } from "./dataService";

const nowIso = () => new Date().toISOString();

export const CostService = {
  async listCenters() {
    return await db.costCenters?.filter((c) => c.active !== 0).toArray() || [];
  },
  async createCenter({ code, name }) {
    const id = `cc_${Date.now()}`;
    const payload = {
      id,
      code: code || id.slice(-4),
      name,
      active: 1,
      created_at: nowIso()
    };
    await db.costCenters?.add(payload);
    return payload;
  },
  async updateCenter(id, data) {
    await db.costCenters?.update(id, { ...data, updated_at: nowIso() });
  },
  async deleteCenter(id) {
    await db.costCenters?.update(id, { active: 0, updated_at: nowIso() });
  },
  async listAllocations() {
    return await db.costAllocations?.toArray() || [];
  },
  async createAllocation({ center_id, source_type, source_id, amount, date }) {
    const id = `ca_${Date.now()}`;
    const payload = {
      id,
      center_id,
      source_type,
      source_id,
      amount: Number(amount || 0),
      date: date || nowIso(),
      created_at: nowIso()
    };
    await db.costAllocations?.add(payload);
    return payload;
  },
  async deleteAllocation(id) {
    await db.costAllocations?.delete(id);
  },
  async listPlans() {
    return await db.costPlans?.toArray() || [];
  },
  async createPlan({ name, start_date, end_date, revenue_target, cost_target, profit_target }) {
    const id = `cp_${Date.now()}`;
    const payload = {
      id,
      name,
      start_date,
      end_date,
      revenue_target: Number(revenue_target || 0),
      cost_target: Number(cost_target || 0),
      profit_target: Number(profit_target || 0),
      created_at: nowIso()
    };
    await db.costPlans?.add(payload);
    try {
      logAudit("cost", id, "plan_created", null, payload);
    } catch (error) {
      console.error("Audit log error:", error);
    }
    return payload;
  },
  async updatePlan(id, data) {
    await db.costPlans?.update(id, { ...data, updated_at: nowIso() });
  },
  async deletePlan(id) {
    await db.costPlans?.delete(id);
  }
};

export default CostService;
