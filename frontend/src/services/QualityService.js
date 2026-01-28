import { db, logAudit } from "./dataService";

const nowIso = () => new Date().toISOString();

export const QualityService = {
  async listTemplates() {
    return await db.inspectionTemplates?.filter((t) => t.active !== 0).toArray() || [];
  },
  async createTemplate({ name, product_id = null, items = [] }) {
    const id = `tmpl_${Date.now()}`;
    const payload = {
      id,
      name,
      product_id: product_id || null,
      items,
      active: 1,
      created_at: nowIso(),
      updated_at: nowIso()
    };
    await db.inspectionTemplates?.add(payload);
    return payload;
  },
  async updateTemplate(id, data) {
    await db.inspectionTemplates?.update(id, { ...data, updated_at: nowIso() });
  },
  async deleteTemplate(id) {
    await db.inspectionTemplates?.update(id, { active: 0, updated_at: nowIso() });
  },
  async listQualityLogs(limit = 100) {
    const logs = await db.qualityLogs?.orderBy("created_at").reverse().limit(limit).toArray();
    return logs || [];
  },
  async listNonConformities(limit = 100) {
    const list = await db.nonConformities?.orderBy("created_at").reverse().limit(limit).toArray();
    return list || [];
  },
  async createInspection({ product_id, template_id, inspector_id, checklist = [], notes = "", photos = [] }) {
    const id = `ql_${Date.now()}`;
    const result = checklist.every((item) => item.pass) ? "approved" : "rejected";
    const payload = {
      id,
      product_id,
      template_id,
      inspector_id,
      checklist,
      notes,
      photos,
      result,
      created_at: nowIso()
    };
    await db.qualityLogs?.add(payload);

    if (result === "rejected") {
      await db.products?.update(product_id, { quarantine: true, quality_status: "cuarentena" });
      const ncId = `nc_${Date.now()}`;
      await db.nonConformities?.add({
        id: ncId,
        product_id,
        quality_log_id: id,
        status: "open",
        root_cause: "",
        corrective_action: "",
        created_at: nowIso()
      });
      try {
        logAudit("quality", product_id, "non_conformity_opened", inspector_id, {
          quality_log_id: id,
          non_conformity_id: ncId
        });
      } catch (error) {
        console.error("Audit log error:", error);
      }
    } else {
      await db.products?.update(product_id, { quarantine: false, quality_status: "aprobado" });
      try {
        logAudit("quality", product_id, "inspection_approved", inspector_id, { quality_log_id: id });
      } catch (error) {
        console.error("Audit log error:", error);
      }
    }

    return payload;
  },
  async updateNonConformity(id, data, userId = null) {
    await db.nonConformities?.update(id, { ...data, updated_at: nowIso() });
    try {
      logAudit("quality", id, "non_conformity_updated", userId, data);
    } catch (error) {
      console.error("Audit log error:", error);
    }
  },
  async closeNonConformity(id, userId = null) {
    await db.nonConformities?.update(id, {
      status: "closed",
      closed_at: nowIso(),
      closed_by: userId || null
    });
    try {
      logAudit("quality", id, "non_conformity_closed", userId, {});
    } catch (error) {
      console.error("Audit log error:", error);
    }
  }
};

export default QualityService;
