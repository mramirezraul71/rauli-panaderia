import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, logAudit } from "../services/dataService";
import { getAuditAlertConfig, setAuditAlertConfig } from "../config/businessConfig";
import sentinelService from "../services/SentinelService";
import EvidenceCapture from "./EvidenceVault";

const ENTITY_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "product", label: "Productos" },
  { value: "customer", label: "Clientes" },
  { value: "sale", label: "Ventas" },
  { value: "cash_session", label: "Caja" }
];

const ACTION_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "bulk", label: "Bulk" },
  { value: "open", label: "Open" },
  { value: "close", label: "Close" }
];

const EVIDENCE_ALERT_TYPES = [
  "cash_evidence_required",
  "evidence_missing",
  "expense_missing_receipt",
  "sale_missing_evidence",
  "inventory_evidence_missing",
  "production_evidence_missing"
];

const parseDetails = (details) => {
  if (!details) return null;
  try { return JSON.parse(details); } catch { return null; }
};

const toDateKey = (date) => {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export default function AuditPanel() {
  const initialAlertConfig = getAuditAlertConfig();
  const severityPresets = {
    conservador: { low: 1.4, medium: 2.0 },
    normal: { low: 1.2, medium: 1.6 },
    agresivo: { low: 1.1, medium: 1.3 }
  };
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [revertingId, setRevertingId] = useState(null);
  const [anomalyMultiplier, setAnomalyMultiplier] = useState(initialAlertConfig.anomalyMultiplier);
  const [anomalyMin, setAnomalyMin] = useState(initialAlertConfig.anomalyMin);
  const [entityAlertMultiplier, setEntityAlertMultiplier] = useState(initialAlertConfig.entityAlertMultiplier);
  const [entityThresholds, setEntityThresholds] = useState(initialAlertConfig.entityThresholds || {});
  const [severityProfile, setSeverityProfile] = useState(initialAlertConfig.severityProfile || "normal");
  const [severityMultipliers, setSeverityMultipliers] = useState(initialAlertConfig.severityMultipliers || { low: 1.2, medium: 1.6 });
  const [entitySeverityMultipliers, setEntitySeverityMultipliers] = useState(initialAlertConfig.entitySeverityMultipliers || {});
  const [monthlyEntity, setMonthlyEntity] = useState("all");
  const [exportEntityScope, setExportEntityScope] = useState("all");
  const [exportUserScope, setExportUserScope] = useState("all");
  const [userProfiles, setUserProfiles] = useState(initialAlertConfig.auditUserProfiles || {});
  const [roleProfiles, setRoleProfiles] = useState(initialAlertConfig.auditRoleProfiles || {});
  const [userRoles, setUserRoles] = useState(initialAlertConfig.auditUserRoles || {});
  const [evidenceAlerts, setEvidenceAlerts] = useState([]);
  const [evidenceTypeFilter, setEvidenceTypeFilter] = useState("all");
  const [selectedEvidenceAlert, setSelectedEvidenceAlert] = useState(null);

  const rows = useLiveQuery(async () => {
    const data = await db.auditLog?.toArray() || [];
    return data.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }, []) || [];

  useEffect(() => {
    setEvidenceAlerts(sentinelService.alerts || []);
    const unsubscribe = sentinelService.subscribe((state) => {
      setEvidenceAlerts(state.alerts || []);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const filteredEvidenceAlerts = useMemo(() => {
    return (evidenceAlerts || [])
      .filter((alert) => EVIDENCE_ALERT_TYPES.includes(alert.type))
      .filter((alert) => evidenceTypeFilter === "all" || alert.type === evidenceTypeFilter);
  }, [evidenceAlerts, evidenceTypeFilter]);

  const exportEvidenceAlertsCSV = () => {
    const rows = filteredEvidenceAlerts.map((alert) => ({
      id: alert.id,
      tipo: alert.type,
      mensaje: alert.message,
      referencia_tipo: alert.details?.reference_type || "",
      referencia_id: alert.details?.reference_id || "",
      severidad: alert.severity,
      fecha: alert.timestamp
    }));
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "alertas_evidencias.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(r => {
      if (entity !== "all" && r.entity_type !== entity) return false;
      if (action !== "all" && r.action !== action) return false;
      if (userFilter.trim() && String(r.user_id || "").toLowerCase().includes(userFilter.trim().toLowerCase()) === false) return false;
      if (roleFilter !== "all") {
        const role = resolveRoleForUser(r.user_id);
        if (role !== roleFilter) return false;
      }
      if (stageFilter !== "all") {
        if (resolveStage(r) !== stageFilter) return false;
      }
      if (startDate || endDate) {
        if (!r.timestamp) return false;
        const day = new Date(r.timestamp).toISOString().slice(0, 10);
        if (startDate && day < startDate) return false;
        if (endDate && day > endDate) return false;
      }
      if (!term) return true;
      return (
        String(r.entity_id || "").toLowerCase().includes(term) ||
        String(r.action || "").toLowerCase().includes(term) ||
        String(r.user_id || "").toLowerCase().includes(term)
      );
    });
  }, [rows, entity, action, search, userFilter, roleFilter, stageFilter, startDate, endDate, userRoles]);

  const canRevertEntry = (entry) => {
    const reversible = ["update", "create", "delete"];
    const tableMap = { product: "products", customer: "customers" };
    if (!reversible.includes(entry.action)) return false;
    if (!tableMap[entry.entity_type]) return false;
    if (entry.action === "update" || entry.action === "delete") {
      const details = parseDetails(entry.details);
      if (!details?.before) return false;
    }
    return true;
  };

  const summary = useMemo(() => {
    return filtered.reduce((acc, entry) => {
      acc.total += 1;
      acc.byAction[entry.action] = (acc.byAction[entry.action] || 0) + 1;
      const stage = resolveStage(entry);
      acc.byStage[stage] = (acc.byStage[stage] || 0) + 1;
      return acc;
    }, { total: 0, byAction: {}, byStage: {} });
  }, [filtered]);

  const summaryByDay = useMemo(() => {
    const map = filtered.reduce((acc, entry) => {
      if (!entry.timestamp) return acc;
      const date = new Date(entry.timestamp);
      const key = toDateKey(date);
      if (!acc[key]) {
        acc[key] = {
          key,
          label: date.toLocaleDateString(),
          total: 0,
          byEntity: {}
        };
      }
      acc[key].total += 1;
      acc[key].byEntity[entry.entity_type] = (acc[key].byEntity[entry.entity_type] || 0) + 1;
      return acc;
    }, {});

    return Object.values(map).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [filtered]);

  const maxDailyTotal = useMemo(() => {
    return Math.max(1, ...summaryByDay.map(day => day.total));
  }, [summaryByDay]);

  const weeklyTrend = useMemo(() => {
    const today = toStartOfDay(new Date());
    const last7Start = addDays(today, -6);
    const prev7Start = addDays(today, -13);
    const prev7End = addDays(today, -7);

    const sumRange = (start, end) => {
      return filtered.reduce((acc, entry) => {
        if (!entry.timestamp) return acc;
        const ts = new Date(entry.timestamp);
        if (ts >= start && ts <= end) acc += 1;
        return acc;
      }, 0);
    };

    const last7 = sumRange(last7Start, toEndOfDay(today));
    const prev7 = sumRange(prev7Start, toEndOfDay(prev7End));
    const delta = last7 - prev7;
    const deltaPct = prev7 === 0 ? (last7 > 0 ? 100 : 0) : Math.round((delta / prev7) * 100);
    return { last7, prev7, delta, deltaPct };
  }, [filtered]);

  const spikes = useMemo(() => {
    const days = summaryByDay.slice(0, 14);
    if (days.length < 5) return [];
    const totals = days.map(d => d.total);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const threshold = Math.max(anomalyMin, avg * anomalyMultiplier);
    return days.filter(d => d.total >= threshold);
  }, [summaryByDay, anomalyMin, anomalyMultiplier]);

  const leaderboards = useMemo(() => {
    const byEntity = {};
    const byAction = {};
    const byUser = {};

    filtered.forEach((entry) => {
      const entityKey = entry.entity_type || "unknown";
      const actionKey = entry.action || "unknown";
      const userKey = entry.user_id || "sin_usuario";
      byEntity[entityKey] = (byEntity[entityKey] || 0) + 1;
      byAction[actionKey] = (byAction[actionKey] || 0) + 1;
      byUser[userKey] = (byUser[userKey] || 0) + 1;
    });

    const sortPairs = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
    return {
      entities: sortPairs(byEntity).slice(0, 5),
      actions: sortPairs(byAction).slice(0, 5),
      users: sortPairs(byUser).slice(0, 5)
    };
  }, [filtered]);

  const hourlyTop = useMemo(() => {
    const byHour = Array.from({ length: 24 }, () => 0);
    filtered.forEach((entry) => {
      if (!entry.timestamp) return;
      const hour = new Date(entry.timestamp).getHours();
      byHour[hour] += 1;
    });
    const pairs = byHour.map((count, hour) => [hour, count]);
    return pairs.sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filtered]);

  const topUserByEntity = useMemo(() => {
    const map = {};
    filtered.forEach((entry) => {
      const entityKey = entry.entity_type || "unknown";
      const userKey = entry.user_id || "sin_usuario";
      if (!map[entityKey]) map[entityKey] = {};
      map[entityKey][userKey] = (map[entityKey][userKey] || 0) + 1;
    });
    return Object.entries(map).map(([entityKey, users]) => {
      const [topUser, count] = Object.entries(users).sort((a, b) => b[1] - a[1])[0] || [];
      return { entityKey, topUser: topUser || "-", count: count || 0 };
    }).slice(0, 6);
  }, [filtered]);

  const heatmap = useMemo(() => {
    const map = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    filtered.forEach((entry) => {
      if (!entry.timestamp) return;
      const date = new Date(entry.timestamp);
      const dayIndex = date.getDay();
      const hour = date.getHours();
      map[dayIndex][hour] += 1;
    });
    const flat = map.flat();
    const max = Math.max(1, ...flat);
    return { map, max };
  }, [filtered]);

  const entityTrends = useMemo(() => {
    const entities = {};
    filtered.forEach((entry) => {
      if (!entry.timestamp) return;
      const date = new Date(entry.timestamp);
      const key = toDateKey(date);
      if (!entities[entry.entity_type]) entities[entry.entity_type] = {};
      entities[entry.entity_type][key] = (entities[entry.entity_type][key] || 0) + 1;
    });

    return Object.entries(entities).map(([entityKey, counts]) => {
      const days = Object.entries(counts)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .slice(-14);
      const values = days.map(([, value]) => value);
      return { entityKey, days, values };
    });
  }, [filtered]);

  const proactiveEntityAlerts = useMemo(() => {
    const perEntityTotals = {};
    filtered.forEach((entry) => {
      if (!entry.timestamp) return;
      const key = toDateKey(entry.timestamp);
      const entityKey = entry.entity_type || "unknown";
      if (!perEntityTotals[entityKey]) perEntityTotals[entityKey] = {};
      perEntityTotals[entityKey][key] = (perEntityTotals[entityKey][key] || 0) + 1;
    });

    return Object.entries(perEntityTotals).flatMap(([entityKey, byDay]) => {
      const values = Object.values(byDay);
      if (values.length < 5) return [];
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const perEntityThreshold = entityThresholds[entityKey];
      const threshold = perEntityThreshold
        ? Math.max(2, perEntityThreshold)
        : Math.max(2, avg * entityAlertMultiplier);
      const overrides = entitySeverityMultipliers[entityKey];
      const low = overrides?.low || severityMultipliers.low || 1.2;
      const medium = overrides?.medium || severityMultipliers.medium || 1.6;
      return Object.entries(byDay)
        .filter(([, value]) => value >= threshold)
        .map(([day, value]) => {
          const ratio = value / threshold;
          const severity = ratio >= medium ? "alta" : ratio >= low ? "media" : "baja";
          return { entityKey, day, value, threshold, severity };
        });
    }).slice(0, 8);
  }, [filtered, entityAlertMultiplier, entityThresholds, entitySeverityMultipliers, severityMultipliers]);

  const monthlyEntityHeatmap = useMemo(() => {
    const byDay = {};
    filtered.forEach((entry) => {
      if (!entry.timestamp) return;
      if (monthlyEntity !== "all" && entry.entity_type !== monthlyEntity) return;
      const key = toDateKey(entry.timestamp);
      byDay[key] = (byDay[key] || 0) + 1;
    });
    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const key = toDateKey(date);
      days.push({
        key,
        label: date.getDate(),
        count: byDay[key] || 0
      });
    }
    const max = Math.max(1, ...days.map(d => d.count));
    return { days, max };
  }, [filtered, monthlyEntity]);

  const monthlyEntitySeverity = useMemo(() => {
    if (monthlyEntity === "all") return null;
    const counts = monthlyEntityHeatmap.days.map(d => d.count);
    const avg = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
    const baseThreshold = entityThresholds[monthlyEntity] || Math.max(2, avg * entityAlertMultiplier);
    const overrides = entitySeverityMultipliers[monthlyEntity];
    const low = overrides?.low || severityMultipliers.low || 1.2;
    const medium = overrides?.medium || severityMultipliers.medium || 1.6;
    return { baseThreshold, low, medium };
  }, [monthlyEntity, monthlyEntityHeatmap, entityAlertMultiplier, entityThresholds, entitySeverityMultipliers, severityMultipliers]);

  const alertTrend = useMemo(() => {
    const today = toStartOfDay(new Date());
    const last7Start = addDays(today, -6);
    const prev7Start = addDays(today, -13);
    const prev7End = addDays(today, -7);
    const parseDay = (dayKey) => new Date(`${dayKey}T00:00:00`);
    const last7 = proactiveEntityAlerts.filter(a => {
      const ts = parseDay(a.day);
      return ts >= last7Start && ts <= toEndOfDay(today);
    }).length;
    const prev7 = proactiveEntityAlerts.filter(a => {
      const ts = parseDay(a.day);
      return ts >= prev7Start && ts <= toEndOfDay(prev7End);
    }).length;
    const delta = last7 - prev7;
    const deltaPct = prev7 === 0 ? (last7 > 0 ? 100 : 0) : Math.round((delta / prev7) * 100);
    return { last7, prev7, delta, deltaPct };
  }, [proactiveEntityAlerts]);

  const alertsByEntityTrend = useMemo(() => {
    const today = toStartOfDay(new Date());
    const last7Start = addDays(today, -6);
    const prev7Start = addDays(today, -13);
    const prev7End = addDays(today, -7);
    const parseDay = (dayKey) => new Date(`${dayKey}T00:00:00`);
    const tallyRange = (start, end) => {
      const counts = {};
      proactiveEntityAlerts.forEach((alert) => {
        const ts = parseDay(alert.day);
        if (ts < start || ts > end) return;
        counts[alert.entityKey] = (counts[alert.entityKey] || 0) + 1;
      });
      return counts;
    };

    const last7 = tallyRange(last7Start, toEndOfDay(today));
    const prev7 = tallyRange(prev7Start, toEndOfDay(prev7End));
    const entityKeys = Array.from(new Set([...Object.keys(last7), ...Object.keys(prev7)]));
    return entityKeys.map((key) => {
      const current = last7[key] || 0;
      const previous = prev7[key] || 0;
      const delta = current - previous;
      const deltaPct = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((delta / previous) * 100);
      return { key, current, previous, delta, deltaPct };
    }).sort((a, b) => b.current - a.current).slice(0, 6);
  }, [proactiveEntityAlerts]);

  const alertsByUser = useMemo(() => {
    const perUserTotals = {};
    filtered.forEach((entry) => {
      if (!entry.timestamp) return;
      const dayKey = toDateKey(entry.timestamp);
      const userKey = entry.user_id || "sin_usuario";
      if (!perUserTotals[userKey]) perUserTotals[userKey] = {};
      perUserTotals[userKey][dayKey] = (perUserTotals[userKey][dayKey] || 0) + 1;
    });

    return Object.entries(perUserTotals).map(([user, byDay]) => {
      const values = Object.values(byDay);
      if (values.length === 0) return null;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const threshold = Math.max(2, avg * entityAlertMultiplier);
      const profile = resolveProfileForUser(user);
      const preset = severityPresets[profile] || severityPresets.normal;
      const todayKey = toDateKey(new Date());
      const current = byDay[todayKey] || values[values.length - 1] || 0;
      const ratio = current / threshold;
      const severity = ratio >= preset.medium ? "alta" : ratio >= preset.low ? "media" : "baja";
      return { user, count: current, threshold, severity, profile, role: userRoles[user] || "-" };
    }).filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filtered, entityAlertMultiplier, userProfiles, userRoles, roleProfiles, severityProfile]);

  const availableUsers = useMemo(() => {
    const users = new Set();
    filtered.forEach((entry) => {
      if (entry.user_id) users.add(entry.user_id);
    });
    return Array.from(users).sort();
  }, [filtered]);

  const resolveProfileForUser = (userId) => {
    const direct = userProfiles[userId];
    if (direct) return direct;
    const role = userRoles[userId];
    const roleProfile = role ? roleProfiles[role] : null;
    return roleProfile || severityProfile || "normal";
  };

  const resolveRoleForUser = (userId) => {
    if (!userId) return "sin_rol";
    return userRoles[userId] || "sin_rol";
  };

  const resolveStage = (entry) => {
    const details = parseDetails(entry.details) || {};
    return details.stage || "sistema";
  };

  const stageLabels = {
    ventas: "Ventas",
    caja_cierre: "Caja (Cierre)",
    caja_movimientos: "Caja (Movimientos)",
    inventario: "Inventario",
    contabilidad: "Contabilidad",
    bloqueo_ui: "Bloqueo UI",
    sistema: "Sistema"
  };

  const applyPresetToAllEntities = (profile) => {
    const preset = severityPresets[profile] || severityPresets.normal;
    const nextMultipliers = { ...entitySeverityMultipliers };
    ENTITY_OPTIONS.filter(o => o.value !== "all").forEach((opt) => {
      nextMultipliers[opt.value] = { ...preset, profile };
    });
    setEntitySeverityMultipliers(nextMultipliers);
    setAuditAlertConfig({
      anomalyMultiplier,
      anomalyMin,
      entityAlertMultiplier,
      entityThresholds,
      severityProfile,
      severityMultipliers,
      entitySeverityMultipliers: nextMultipliers
    });
  };

  const monthlyHeatmap = useMemo(() => {
    const byDay = {};
    filtered.forEach((entry) => {
      if (!entry.timestamp) return;
      const key = toDateKey(entry.timestamp);
      byDay[key] = (byDay[key] || 0) + 1;
    });
    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const key = toDateKey(date);
      days.push({
        key,
        label: date.getDate(),
        count: byDay[key] || 0
      });
    }
    const max = Math.max(1, ...days.map(d => d.count));
    return { days, max };
  }, [filtered]);

  const exportAuditCSV = (list) => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Entidad", "Accion", "ID", "Fecha", "Usuario", "Rol"];
    const lines = [
      header.join(","),
      ...list.map(e => [
        escape(e.entity_type),
        escape(e.action),
        escape(e.entity_id),
        escape(e.timestamp ? new Date(e.timestamp).toISOString() : ""),
        escape(e.user_id || ""),
        escape(resolveRoleForUser(e.user_id))
      ].join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportSummaryCSV = (list) => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Fecha", "Entidad", "Conteo", "TotalDia", "RolFiltro", "UsuarioFiltro"];
    const lines = [
      header.join(","),
      ...list.flatMap((day) => {
        return Object.entries(day.byEntity).map(([entityKey, count]) => [
          escape(day.key),
          escape(entityKey),
          escape(count),
          escape(day.total),
          escape(roleFilter),
          escape(userFilter)
        ].join(","));
      })
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria_resumen.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportAlertsCSV = (list) => {
    const scoped = exportEntityScope === "all"
      ? list
      : list.filter((alert) => alert.entityKey === exportEntityScope);
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Entidad", "Fecha", "Valor", "Umbral", "Severidad", "RolFiltro", "UsuarioFiltro"];
    const lines = [
      header.join(","),
      ...scoped.map(alert => [
        escape(alert.entityKey),
        escape(alert.day),
        escape(alert.value),
        escape(Math.round(alert.threshold)),
        escape(alert.severity || ""),
        escape(roleFilter),
        escape(userFilter)
      ].join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria_alertas.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportWeeklyHeatmapCSV = () => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Dia", "Hora", "Conteo", "RolFiltro", "UsuarioFiltro"];
    const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
    const lines = [
      header.join(","),
      ...dayNames.flatMap((label, dayIndex) => {
        return heatmap.map[dayIndex].map((count, hour) => [
          escape(label),
          escape(String(hour).padStart(2, "0")),
          escape(count),
          escape(roleFilter),
          escape(userFilter)
        ].join(","));
      })
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria_heatmap_semanal.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportMonthlyHeatmapCSV = () => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Fecha", "Conteo", "Entidad", "RolFiltro", "UsuarioFiltro"];
    const lines = [
      header.join(","),
      ...monthlyEntityHeatmap.days.map((day) => [
        escape(day.key),
        escape(day.count),
        escape(monthlyEntity === "all" ? "todas" : monthlyEntity),
        escape(roleFilter),
        escape(userFilter)
      ].join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria_heatmap_mensual.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportAlertsByEntityCSV = () => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const scoped = exportEntityScope === "all"
      ? alertsByEntityTrend
      : alertsByEntityTrend.filter((row) => row.key === exportEntityScope);
    const header = ["Entidad", "Alertas", "Delta", "DeltaPct"];
    const lines = [
      header.join(","),
      ...scoped.map((row) => [
        escape(row.key),
        escape(row.current),
        escape(row.delta),
        escape(row.deltaPct)
      ].join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria_alertas_entidad.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportAlertsByUserCSV = () => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const scoped = exportUserScope === "all"
      ? alertsByUser
      : alertsByUser.filter((row) => row.user === exportUserScope);
    const header = ["Usuario", "Alertas", "Umbral", "Severidad", "Perfil", "Rol"];
    const lines = [
      header.join(","),
      ...scoped.map((row) => [
        escape(row.user),
        escape(row.count),
        escape(Math.round(row.threshold || 0)),
        escape(row.severity || ""),
        escape(row.profile || ""),
        escape(row.role || "")
      ].join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria_alertas_usuario.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const setQuickRange = (days) => {
    const today = new Date();
    const start = addDays(today, -days + 1);
    setStartDate(toDateKey(start));
    setEndDate(toDateKey(today));
  };

  const clearRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const revertEntry = async (entry, options = {}) => {
    if (!entry) return;
    if (entry.action === "bulk") return;
    if (!options.skipConfirm && !confirm("¿Revertir este cambio?")) return;
    try {
      setRevertingId(entry.id);
      const details = parseDetails(entry.details);
      const tableMap = {
        product: "products",
        customer: "customers"
      };
      const table = tableMap[entry.entity_type];
      if (!table) throw new Error("Entidad no reversible");

      if (entry.action === "update" && details?.before) {
        await db[table]?.update(entry.entity_id, details.before);
      }
      if (entry.action === "create") {
        await db[table]?.update(entry.entity_id, { active: 0, deleted_at: new Date().toISOString() });
      }
      if (entry.action === "delete" && details?.before) {
        await db[table]?.update(entry.entity_id, { ...details.before, active: 1, deleted_at: null });
      }
    } catch (error) {
      console.error("Error al revertir:", error);
      alert("No se pudo revertir el cambio.");
    } finally {
      setRevertingId(null);
    }
  };

  const revertFiltered = async () => {
    const reversible = filtered.filter(canRevertEntry).slice(0, 100);
    if (reversible.length === 0) {
      alert("No hay cambios reversibles en este filtro.");
      return;
    }
    if (!confirm(`¿Revertir ${reversible.length} cambios?`)) return;
    for (const entry of reversible) {
      await revertEntry(entry, { skipConfirm: true });
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Auditoría del Sistema</h3>
        <div className="flex flex-1 flex-wrap gap-2 max-w-3xl">
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white">
            {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white">
            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Usuario ID..."
            className="w-40 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Admin</option>
            <option value="gerente">Gerente</option>
            <option value="cajero">Cajero</option>
            <option value="vendedor">Vendedor</option>
            <option value="sin_rol">Sin rol</option>
          </select>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="all">Todas las etapas</option>
            {Object.entries(stageLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuickRange(1)}
              className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs"
            >
              Hoy
            </button>
            <button
              onClick={() => setQuickRange(7)}
              className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs"
            >
              Semana
            </button>
            <button
              onClick={() => setQuickRange(30)}
              className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs"
            >
              Mes
            </button>
            <button
              onClick={clearRange}
              className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs"
            >
              Limpiar
            </button>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID o acción..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Export entidad</span>
            <select
              value={exportEntityScope}
              onChange={(e) => setExportEntityScope(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
            >
              <option value="all">Todas</option>
              {ENTITY_OPTIONS.filter(o => o.value !== "all").map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Export usuario</span>
            <select
              value={exportUserScope}
              onChange={(e) => setExportUserScope(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
            >
              <option value="all">Todos</option>
              {availableUsers.map((user) => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
          <button
            onClick={revertFiltered}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
          >
            Revertir filtrados
          </button>
          <button
            onClick={() => exportSummaryCSV(summaryByDay)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
          >
            Exportar resumen
          </button>
          <button
            onClick={() => exportAlertsCSV(proactiveEntityAlerts)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
          >
            Exportar alertas
          </button>
          <button
            onClick={exportAlertsByEntityCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
          >
            Exportar alertas por entidad
          </button>
          <button
            onClick={exportAlertsByUserCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
          >
            Exportar alertas por usuario
          </button>
          <button
            onClick={exportWeeklyHeatmapCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
          >
            Exportar heatmap semanal
          </button>
          <button
            onClick={exportMonthlyHeatmapCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
          >
            Exportar heatmap mensual
          </button>
          <button
            onClick={() => exportAuditCSV(filtered)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-white font-semibold">Alertas por evidencia pendiente</h4>
            <p className="text-xs text-slate-400">Alertas activas vinculadas a evidencia requerida.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={evidenceTypeFilter}
              onChange={(e) => setEvidenceTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
            >
              <option value="all">Todas</option>
              {EVIDENCE_ALERT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button
              onClick={exportEvidenceAlertsCSV}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
            >
              Exportar CSV
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {filteredEvidenceAlerts.map((alert) => (
            <div key={alert.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm text-white">{alert.message}</p>
                <p className="text-xs text-slate-400">
                  {alert.details?.reference_type} · {alert.details?.reference_id} · {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="px-2 py-1 rounded-full bg-slate-700/60">{alert.type}</span>
                <button
                  onClick={() => setSelectedEvidenceAlert(alert)}
                  className="px-2 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 rounded"
                >
                  Adjuntar evidencia
                </button>
                <button
                  onClick={() => sentinelService.acknowledgeAlert(alert.id)}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"
                >
                  Reconocer
                </button>
              </div>
            </div>
          ))}
          {filteredEvidenceAlerts.length === 0 && (
            <div className="text-xs text-slate-500">No hay alertas pendientes de evidencia.</div>
          )}
        </div>
      </div>

      {selectedEvidenceAlert && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h4 className="text-white font-semibold">Adjuntar evidencia</h4>
              <button
                onClick={() => setSelectedEvidenceAlert(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-400">
                {selectedEvidenceAlert.details?.reference_type} · {selectedEvidenceAlert.details?.reference_id}
              </p>
              <EvidenceCapture
                context={selectedEvidenceAlert.details?.reference_type || "system"}
                referenceId={selectedEvidenceAlert.details?.reference_id}
                referenceType={selectedEvidenceAlert.details?.reference_type || "system"}
                required={true}
                onCapture={() => {
                  try {
                    logAudit(
                      "evidence",
                      selectedEvidenceAlert.details?.reference_id || "unknown",
                      "evidence_attached",
                      null,
                      {
                        reference_type: selectedEvidenceAlert.details?.reference_type,
                        reference_id: selectedEvidenceAlert.details?.reference_id,
                        alert_id: selectedEvidenceAlert.id
                      }
                    );
                  } catch {}
                  sentinelService.acknowledgeAlert(selectedEvidenceAlert.id);
                  setSelectedEvidenceAlert(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-3">
        <span className="px-2 py-1 rounded bg-slate-900/60 border border-slate-700/50">Total: {summary.total}</span>
        {Object.entries(summary.byAction).map(([key, value]) => (
          <span key={key} className="px-2 py-1 rounded bg-slate-900/60 border border-slate-700/50">
            {key}: {value}
          </span>
        ))}
        {Object.entries(summary.byStage).map(([key, value]) => (
          <span key={key} className="px-2 py-1 rounded bg-slate-900/60 border border-slate-700/50">
            {stageLabels[key] || key}: {value}
          </span>
        ))}
      </div>
      <div className="grid gap-3 mb-4 md:grid-cols-3 text-xs">
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="text-slate-400">Últimos 7 días</div>
          <div className="text-lg font-semibold">{weeklyTrend.last7}</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="text-slate-400">Semana anterior</div>
          <div className="text-lg font-semibold">{weeklyTrend.prev7}</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="text-slate-400">Tendencia</div>
          <div className={`text-lg font-semibold ${weeklyTrend.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {weeklyTrend.delta >= 0 ? "+" : ""}{weeklyTrend.delta} ({weeklyTrend.deltaPct}%)
          </div>
        </div>
      </div>
      {spikes.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-3 mb-4 text-xs text-amber-200">
          <div className="font-semibold mb-1">Alertas de picos</div>
          <div className="flex flex-wrap gap-2">
            {spikes.slice(0, 6).map(spike => (
              <span key={spike.key} className="px-2 py-1 rounded bg-amber-500/10 border border-amber-400/30">
                {spike.label}: {spike.total}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3 mb-4 md:grid-cols-2 text-xs">
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="text-slate-400">Alertas últimos 7 días</div>
          <div className="text-lg font-semibold">{alertTrend.last7}</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="text-slate-400">Comparativo vs semana anterior</div>
          <div className={`text-lg font-semibold ${alertTrend.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {alertTrend.delta >= 0 ? "+" : ""}{alertTrend.delta} ({alertTrend.deltaPct}%)
          </div>
        </div>
      </div>
      <div className="grid gap-3 mb-4 md:grid-cols-2 text-xs">
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="font-semibold text-slate-300 mb-2">Top alertas por entidad</div>
          {alertsByEntityTrend.length === 0 ? (
            <div className="text-slate-500">Sin datos</div>
          ) : alertsByEntityTrend.map((row) => (
            <div key={row.key} className="flex items-center justify-between">
              <span className="text-slate-400">{row.key}</span>
              <span className={`${row.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {row.current} ({row.delta >= 0 ? "+" : ""}{row.delta})
              </span>
            </div>
          ))}
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="font-semibold text-slate-300 mb-2">Alertas por usuario</div>
          {alertsByUser.length === 0 ? (
            <div className="text-slate-500">Sin datos</div>
          ) : alertsByUser.map((row) => (
            <div key={row.user} className="flex items-center justify-between">
              <span className="text-slate-400">{row.user}</span>
              <span>{row.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 mb-4 text-xs text-slate-300">
        <div className="font-semibold text-slate-300 mb-2">Sensibilidad de anomalías</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Multiplicador</span>
            <input
              type="number"
              min="1"
              step="0.5"
              value={anomalyMultiplier}
              onChange={(e) => {
                const nextValue = Number(e.target.value || 1);
                setAnomalyMultiplier(nextValue);
                setAuditAlertConfig({
                  anomalyMultiplier: nextValue,
                  anomalyMin,
                  entityAlertMultiplier,
                  entityThresholds,
                  severityProfile,
                  severityMultipliers,
                  entitySeverityMultipliers
                });
              }}
              className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Mínimo</span>
            <input
              type="number"
              min="1"
              step="1"
              value={anomalyMin}
              onChange={(e) => {
                const nextValue = Number(e.target.value || 1);
                setAnomalyMin(nextValue);
                setAuditAlertConfig({
                  anomalyMultiplier,
                  anomalyMin: nextValue,
                  entityAlertMultiplier,
                  entityThresholds,
                  severityProfile,
                  severityMultipliers,
                  entitySeverityMultipliers
                });
              }}
              className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
            />
          </div>
          <span className="text-slate-500">Picos = promedio × multiplicador, con mínimo.</span>
        </div>
      </div>
      <div className="grid gap-3 mb-4 md:grid-cols-3 text-xs">
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="font-semibold text-slate-300 mb-2">Top entidades</div>
          {leaderboards.entities.length === 0 ? (
            <div className="text-slate-500">Sin datos</div>
          ) : leaderboards.entities.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-slate-400">{name}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="font-semibold text-slate-300 mb-2">Top acciones</div>
          {leaderboards.actions.length === 0 ? (
            <div className="text-slate-500">Sin datos</div>
          ) : leaderboards.actions.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-slate-400">{name}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="font-semibold text-slate-300 mb-2">Top usuarios</div>
          {leaderboards.users.length === 0 ? (
            <div className="text-slate-500">Sin datos</div>
          ) : leaderboards.users.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-slate-400">{name}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 mb-4 md:grid-cols-2 text-xs">
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="font-semibold text-slate-300 mb-2">Top horas</div>
          {hourlyTop.length === 0 ? (
            <div className="text-slate-500">Sin datos</div>
          ) : hourlyTop.map(([hour, count]) => (
            <div key={hour} className="flex items-center justify-between">
              <span className="text-slate-400">{String(hour).padStart(2, "0")}:00</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="font-semibold text-slate-300 mb-2">Top usuario por entidad</div>
          {topUserByEntity.length === 0 ? (
            <div className="text-slate-500">Sin datos</div>
          ) : topUserByEntity.map((row) => (
            <div key={row.entityKey} className="flex items-center justify-between">
              <span className="text-slate-400">{row.entityKey}</span>
              <span>{row.topUser} • {row.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 mb-4 text-xs text-slate-300">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-300">Heatmap semanal</span>
          <span className="text-slate-500">0-24h</span>
        </div>
        <div className="flex justify-end mb-2">
          <button
            onClick={exportWeeklyHeatmapCSV}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px]"
          >
            Exportar
          </button>
        </div>
        <div className="grid grid-cols-8 gap-1 text-[10px] text-slate-500">
          <div />
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="text-center">{hour % 4 === 0 ? String(hour).padStart(2, "0") : ""}</div>
          ))}
          {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"].map((label, dayIndex) => (
            <div key={label} className="contents">
              <div className="text-slate-400">{label}</div>
              {heatmap.map[dayIndex].map((count, hour) => {
                const intensity = Math.round((count / heatmap.max) * 100);
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    title={`${label} ${String(hour).padStart(2, "0")}:00 • ${count}`}
                    className="h-3 rounded"
                    style={{ backgroundColor: `rgba(139, 92, 246, ${Math.max(0.1, intensity / 100)})` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 mb-4 text-xs text-slate-300">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-300">Heatmap mensual</span>
          <span className="text-slate-500">Últimos 30 días</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-slate-400">Entidad:</span>
          <select
            value={monthlyEntity}
            onChange={(e) => setMonthlyEntity(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
          >
            <option value="all">Todas</option>
            {ENTITY_OPTIONS.filter(o => o.value !== "all").map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={exportMonthlyHeatmapCSV}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px]"
          >
            Exportar
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-500">
          {monthlyEntityHeatmap.days.map((day) => {
            const intensity = Math.round((day.count / monthlyEntityHeatmap.max) * 100);
            const severityStyle = monthlyEntitySeverity
              ? day.count >= monthlyEntitySeverity.baseThreshold * monthlyEntitySeverity.medium
                ? "rgba(239, 68, 68, 0.6)"
                : day.count >= monthlyEntitySeverity.baseThreshold * monthlyEntitySeverity.low
                  ? "rgba(245, 158, 11, 0.5)"
                  : "rgba(16, 185, 129, 0.35)"
              : null;
            return (
              <div
                key={day.key}
                title={`${day.key} • ${day.count}`}
                className="h-7 rounded flex items-center justify-center"
                style={{ backgroundColor: severityStyle || `rgba(14, 165, 233, ${Math.max(0.12, intensity / 100)})` }}
              >
                {day.label}
              </div>
            );
          })}
        </div>
        {monthlyEntitySeverity && (
          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400/50" /> Baja</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400/50" /> Media</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-400/50" /> Alta</span>
          </div>
        )}
      </div>
      <div className="grid gap-3 mb-4 md:grid-cols-2 text-xs">
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="font-semibold text-slate-300 mb-2">Tendencia por entidad</div>
          {entityTrends.length === 0 ? (
            <div className="text-slate-500">Sin datos</div>
          ) : entityTrends.map((trend) => {
            const max = Math.max(1, ...trend.values);
            return (
              <div key={trend.entityKey} className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400">{trend.entityKey}</span>
                  <span>{trend.values[trend.values.length - 1] || 0}</span>
                </div>
                <div className="flex items-end gap-0.5 h-6">
                  {trend.values.map((value, idx) => (
                    <div
                      key={`${trend.entityKey}-${idx}`}
                      className="flex-1 rounded bg-violet-500/60"
                      style={{ height: `${Math.max(15, Math.round((value / max) * 100))}%` }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-300">Alertas por entidad</span>
            <div className="flex items-center gap-2 text-slate-400">
              <span>Multiplicador</span>
              <input
                type="number"
                min="1"
                step="0.5"
                value={entityAlertMultiplier}
                onChange={(e) => {
                  const nextValue = Number(e.target.value || 1);
                  setEntityAlertMultiplier(nextValue);
                  setAuditAlertConfig({
                    anomalyMultiplier,
                    anomalyMin,
                    entityAlertMultiplier: nextValue,
                    entityThresholds,
                    severityProfile,
                    severityMultipliers,
                    entitySeverityMultipliers
                  });
                }}
                className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-2 text-slate-400">
            {ENTITY_OPTIONS.filter(o => o.value !== "all").map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <span>{opt.label}</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={entityThresholds[opt.value] || ""}
                  onChange={(e) => {
                    const nextValue = e.target.value ? Number(e.target.value) : undefined;
                    const nextThresholds = { ...entityThresholds };
                    if (nextValue) nextThresholds[opt.value] = nextValue;
                    else delete nextThresholds[opt.value];
                    setEntityThresholds(nextThresholds);
                    setAuditAlertConfig({
                      anomalyMultiplier,
                      anomalyMin,
                      entityAlertMultiplier,
                      entityThresholds: nextThresholds,
                      severityProfile,
                      severityMultipliers,
                      entitySeverityMultipliers
                    });
                  }}
                  className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                  placeholder="auto"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-2 text-slate-400">
            {ENTITY_OPTIONS.filter(o => o.value !== "all").map((opt) => (
              <div key={`${opt.value}-sev`} className="flex items-center gap-2">
                <span>{opt.label} sev.</span>
                <select
                  value={entitySeverityMultipliers[opt.value]?.profile || "personalizado"}
                  onChange={(e) => {
                    const profile = e.target.value;
                    const preset = severityPresets[profile];
                    const nextMultipliers = { ...entitySeverityMultipliers };
                    if (preset) {
                      nextMultipliers[opt.value] = { ...preset, profile };
                    } else {
                      nextMultipliers[opt.value] = { ...(nextMultipliers[opt.value] || {}) };
                      delete nextMultipliers[opt.value].profile;
                    }
                    setEntitySeverityMultipliers(nextMultipliers);
                    setAuditAlertConfig({
                      anomalyMultiplier,
                      anomalyMin,
                      entityAlertMultiplier,
                      entityThresholds,
                      severityProfile,
                      severityMultipliers,
                      entitySeverityMultipliers: nextMultipliers
                    });
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                >
                  <option value="personalizado">Personalizado</option>
                  <option value="conservador">Conservador</option>
                  <option value="normal">Normal</option>
                  <option value="agresivo">Agresivo</option>
                </select>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={entitySeverityMultipliers[opt.value]?.low || ""}
                  onChange={(e) => {
                    const nextValue = Number(e.target.value || 1);
                    const nextMultipliers = { ...entitySeverityMultipliers };
                    nextMultipliers[opt.value] = {
                      ...(nextMultipliers[opt.value] || {}),
                      low: nextValue
                    };
                    setEntitySeverityMultipliers(nextMultipliers);
                    setAuditAlertConfig({
                      anomalyMultiplier,
                      anomalyMin,
                      entityAlertMultiplier,
                      entityThresholds,
                      severityProfile,
                      severityMultipliers,
                      entitySeverityMultipliers: nextMultipliers
                    });
                  }}
                  className="w-24"
                />
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={entitySeverityMultipliers[opt.value]?.low || ""}
                  onChange={(e) => {
                    const nextValue = e.target.value ? Number(e.target.value) : undefined;
                    const nextMultipliers = { ...entitySeverityMultipliers };
                    nextMultipliers[opt.value] = {
                      ...(nextMultipliers[opt.value] || {}),
                      low: nextValue
                    };
                    if (!nextValue) delete nextMultipliers[opt.value].low;
                    if (Object.keys(nextMultipliers[opt.value] || {}).length === 0) delete nextMultipliers[opt.value];
                    setEntitySeverityMultipliers(nextMultipliers);
                    setAuditAlertConfig({
                      anomalyMultiplier,
                      anomalyMin,
                      entityAlertMultiplier,
                      entityThresholds,
                      severityProfile,
                      severityMultipliers,
                      entitySeverityMultipliers: nextMultipliers
                    });
                  }}
                  className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                  placeholder="low"
                />
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={entitySeverityMultipliers[opt.value]?.medium || ""}
                  onChange={(e) => {
                    const nextValue = Number(e.target.value || 1);
                    const nextMultipliers = { ...entitySeverityMultipliers };
                    nextMultipliers[opt.value] = {
                      ...(nextMultipliers[opt.value] || {}),
                      medium: nextValue
                    };
                    setEntitySeverityMultipliers(nextMultipliers);
                    setAuditAlertConfig({
                      anomalyMultiplier,
                      anomalyMin,
                      entityAlertMultiplier,
                      entityThresholds,
                      severityProfile,
                      severityMultipliers,
                      entitySeverityMultipliers: nextMultipliers
                    });
                  }}
                  className="w-24"
                />
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={entitySeverityMultipliers[opt.value]?.medium || ""}
                  onChange={(e) => {
                    const nextValue = e.target.value ? Number(e.target.value) : undefined;
                    const nextMultipliers = { ...entitySeverityMultipliers };
                    nextMultipliers[opt.value] = {
                      ...(nextMultipliers[opt.value] || {}),
                      medium: nextValue
                    };
                    if (!nextValue) delete nextMultipliers[opt.value].medium;
                    if (Object.keys(nextMultipliers[opt.value] || {}).length === 0) delete nextMultipliers[opt.value];
                    setEntitySeverityMultipliers(nextMultipliers);
                    setAuditAlertConfig({
                      anomalyMultiplier,
                      anomalyMin,
                      entityAlertMultiplier,
                      entityThresholds,
                      severityProfile,
                      severityMultipliers,
                      entitySeverityMultipliers: nextMultipliers
                    });
                  }}
                  className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                  placeholder="med"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <span>Severidad global</span>
            <input
              type="number"
              min="1"
              step="0.1"
              value={severityMultipliers.low}
              onChange={(e) => {
                const nextValue = Number(e.target.value || 1);
                const nextGlobal = { ...severityMultipliers, low: nextValue };
                setSeverityMultipliers(nextGlobal);
                setAuditAlertConfig({
                  anomalyMultiplier,
                  anomalyMin,
                  entityAlertMultiplier,
                  entityThresholds,
                  severityProfile,
                  severityMultipliers: nextGlobal,
                  entitySeverityMultipliers
                });
              }}
              className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
              placeholder="low"
            />
            <input
              type="number"
              min="1"
              step="0.1"
              value={severityMultipliers.medium}
              onChange={(e) => {
                const nextValue = Number(e.target.value || 1);
                const nextGlobal = { ...severityMultipliers, medium: nextValue };
                setSeverityMultipliers(nextGlobal);
                setAuditAlertConfig({
                  anomalyMultiplier,
                  anomalyMin,
                  entityAlertMultiplier,
                  entityThresholds,
                  severityProfile,
                  severityMultipliers: nextGlobal,
                  entitySeverityMultipliers
                });
              }}
              className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
              placeholder="med"
            />
          </div>
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <span>Perfil severidad</span>
            <select
              value={severityProfile}
              onChange={(e) => {
                const nextProfile = e.target.value;
                const preset = severityPresets[nextProfile] || severityPresets.normal;
                setSeverityProfile(nextProfile);
                setSeverityMultipliers(preset);
                setAuditAlertConfig({
                  anomalyMultiplier,
                  anomalyMin,
                  entityAlertMultiplier,
                  entityThresholds,
                  severityProfile: nextProfile,
                  severityMultipliers: preset,
                  entitySeverityMultipliers,
                  auditUserProfiles: userProfiles,
                  auditRoleProfiles: roleProfiles,
                  auditUserRoles: userRoles
                });
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
            >
              <option value="conservador">Conservador</option>
              <option value="normal">Normal</option>
              <option value="agresivo">Agresivo</option>
            </select>
            <button
              onClick={() => applyPresetToAllEntities(severityProfile)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px]"
            >
              Aplicar a todas
            </button>
          </div>
          <div className="grid gap-2 mb-2 text-slate-400">
            <div className="font-semibold text-slate-300">Perfiles por usuario/rol</div>
            {availableUsers.length === 0 ? (
              <div className="text-slate-500">Sin usuarios detectados</div>
            ) : availableUsers.map((userId) => (
              <div key={userId} className="flex flex-wrap items-center gap-2">
                <span className="text-slate-300">{userId}</span>
                <select
                  value={userRoles[userId] || ""}
                  onChange={(e) => {
                    const nextRoles = { ...userRoles, [userId]: e.target.value };
                    setUserRoles(nextRoles);
                    setAuditAlertConfig({
                      anomalyMultiplier,
                      anomalyMin,
                      entityAlertMultiplier,
                      entityThresholds,
                      severityProfile,
                      severityMultipliers,
                      entitySeverityMultipliers,
                      auditUserProfiles: userProfiles,
                      auditRoleProfiles: roleProfiles,
                      auditUserRoles: nextRoles
                    });
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                >
                  <option value="">Rol...</option>
                  <option value="admin">Admin</option>
                  <option value="gerente">Gerente</option>
                  <option value="cajero">Cajero</option>
                  <option value="vendedor">Vendedor</option>
                </select>
                <select
                  value={userProfiles[userId] || ""}
                  onChange={(e) => {
                    const nextProfiles = { ...userProfiles, [userId]: e.target.value };
                    if (!e.target.value) delete nextProfiles[userId];
                    setUserProfiles(nextProfiles);
                    setAuditAlertConfig({
                      anomalyMultiplier,
                      anomalyMin,
                      entityAlertMultiplier,
                      entityThresholds,
                      severityProfile,
                      severityMultipliers,
                      entitySeverityMultipliers,
                      auditUserProfiles: nextProfiles,
                      auditRoleProfiles: roleProfiles,
                      auditUserRoles: userRoles
                    });
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                >
                  <option value="">Perfil...</option>
                  <option value="conservador">Conservador</option>
                  <option value="normal">Normal</option>
                  <option value="agresivo">Agresivo</option>
                </select>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-300">Roles globales</span>
              {["admin", "gerente", "cajero", "vendedor"].map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <span className="text-slate-400">{role}</span>
                  <select
                    value={roleProfiles[role] || "normal"}
                    onChange={(e) => {
                      const nextRoleProfiles = { ...roleProfiles, [role]: e.target.value };
                      setRoleProfiles(nextRoleProfiles);
                      setAuditAlertConfig({
                        anomalyMultiplier,
                        anomalyMin,
                        entityAlertMultiplier,
                        entityThresholds,
                        severityProfile,
                        severityMultipliers,
                        entitySeverityMultipliers,
                        auditUserProfiles: userProfiles,
                        auditRoleProfiles: nextRoleProfiles,
                        auditUserRoles: userRoles
                      });
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                  >
                    <option value="conservador">Conservador</option>
                    <option value="normal">Normal</option>
                    <option value="agresivo">Agresivo</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
          {proactiveEntityAlerts.length === 0 ? (
            <div className="text-slate-500">Sin alertas</div>
          ) : (
            <div className="space-y-1">
              {proactiveEntityAlerts.map((alert) => (
                <div key={`${alert.entityKey}-${alert.day}`} className="flex items-center justify-between">
                  <span className="text-slate-400">{alert.entityKey} • {alert.day}</span>
                  <span className={`px-2 py-0.5 rounded ${
                    alert.severity === "alta"
                      ? "bg-rose-500/20 text-rose-200"
                      : alert.severity === "media"
                        ? "bg-amber-500/20 text-amber-200"
                        : "bg-emerald-500/20 text-emerald-200"
                  }`}>
                    {alert.value} ({">="} {Math.round(alert.threshold)}) • {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 mb-4 text-xs text-slate-400">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-300">Resumen por día</span>
          <span>{summaryByDay.length} días</span>
        </div>
        {summaryByDay.length === 0 ? (
          <div className="text-slate-500">Sin datos</div>
        ) : (
          <div className="space-y-1">
            {summaryByDay.slice(0, 10).map((day) => (
              <div key={day.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>{day.label}</span>
                  <span className="text-slate-300">
                    {Object.entries(day.byEntity).map(([k, v]) => `${k}:${v}`).join(" • ")}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded">
                  <div
                    className="h-1.5 rounded bg-violet-500/70"
                    style={{ width: `${Math.round((day.total / maxDailyTotal) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="max-h-[360px] overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="text-slate-500 text-center py-6">Sin registros</div>
        ) : filtered.slice(0, 100).map((entry) => (
          <div key={entry.id} className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-2">
                <span>{entry.entity_type} • {entry.action} • {stageLabels[resolveStage(entry)] || resolveStage(entry)}</span>
                {entry.action === "human_factor_lock" && (
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 text-[10px] border border-rose-400/40">
                    Bloqueo humano
                  </span>
                )}
              </div>
              <span>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "-"}</span>
            </div>
            <div className="text-white mt-1">ID: {entry.entity_id}</div>
            {entry.action === "human_factor_lock" && (() => {
              const details = parseDetails(entry.details) || {};
              const periodLabel = details.period_start && details.period_end
                ? ` • Periodo: ${details.period_start} - ${details.period_end}`
                : "";
              return (
                <div className="text-xs text-rose-200 mt-2">
                  Intensidad: {details.intensity || "-"} • Pagina: {details.page || "-"} • Etapa: {details.stage || "-"}{periodLabel}
                </div>
              );
            })()}
            <div className="text-slate-500 text-xs">Usuario: {entry.user_id || "-"} • Rol: {resolveRoleForUser(entry.user_id)}</div>
            <div className="mt-2">
              <button
                onClick={() => revertEntry(entry)}
                disabled={revertingId === entry.id || entry.action === "bulk" || !canRevertEntry(entry)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs disabled:opacity-50"
              >
                {revertingId === entry.id ? "Revirtiendo..." : "Revertir"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
