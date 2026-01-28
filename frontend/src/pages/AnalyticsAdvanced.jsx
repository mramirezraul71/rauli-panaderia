import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { db } from "../services/dataService";
import CostService from "../services/CostService";
import {
  IncomeExpenseChart,
  ExpenseDistributionChart,
  TrendProjectionChart
} from "../components/ChartsModule";
import { formatCurrency } from "../config/businessConfig";
import { t } from "../i18n";

const PERIODS = [
  { id: "day", label: "Diario" },
  { id: "week", label: "Semanal" },
  { id: "month", label: "Mensual" },
  { id: "year", label: "Anual" }
];

const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfWeek = (date) => {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

const getPeriodKey = (date, granularity) => {
  const d = new Date(date);
  if (granularity === "day") return d.toISOString().split("T")[0];
  if (granularity === "week") {
    const iso = getISOWeek(d);
    return `${iso.year}-W${String(iso.week).padStart(2, "0")}`;
  }
  if (granularity === "year") return `${d.getFullYear()}`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const buildPeriods = (granularity) => {
  const now = new Date();
  const count = granularity === "day" ? 14 : granularity === "week" ? 8 : granularity === "month" ? 12 : 5;
  const periods = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    if (granularity === "day") {
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      periods.push({ key: getPeriodKey(date, granularity), start: date, end });
      continue;
    }
    if (granularity === "week") {
      date.setDate(now.getDate() - i * 7);
      periods.push({
        key: getPeriodKey(date, granularity),
        start: startOfWeek(date),
        end: endOfWeek(date)
      });
      continue;
    }
    if (granularity === "year") {
      date.setFullYear(now.getFullYear() - i, 0, 1);
      const start = new Date(date.getFullYear(), 0, 1);
      const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
      periods.push({ key: getPeriodKey(date, granularity), start, end });
      continue;
    }
    date.setMonth(now.getMonth() - i, 1);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    periods.push({ key: getPeriodKey(date, granularity), start, end });
  }
  return periods;
};

export default function AnalyticsAdvanced() {
  const [period, setPeriod] = useState("month");
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);
  const [productionMovements, setProductionMovements] = useState([]);
  const [centers, setCenters] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [centerDraft, setCenterDraft] = useState({ code: "", name: "" });
  const [allocationDraft, setAllocationDraft] = useState({ center_id: "", expense_id: "", amount: "" });
  const [planDraft, setPlanDraft] = useState({
    name: "",
    start_date: "",
    end_date: "",
    revenue_target: "",
    cost_target: "",
    profit_target: ""
  });
  const reportRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const view = new URLSearchParams(location.search).get("view") || "main";
  const isConfigView = view === "config";

  const exportCSV = (rows, filename) => {
    if (!rows?.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportReportPDF = () => {
    const content = reportRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Analítica Avanzada</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1, h2, h3 { margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; font-size: 12px; }
            .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
            .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
            .muted { color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  useEffect(() => {
    const load = async () => {
      const [salesList, expenseList, productList, movementList, centerList, allocationList, planList] = await Promise.all([
        db.sales?.toArray() || [],
        db.expenses?.filter((e) => !e.deleted_at).toArray() || [],
        db.products?.where("active").equals(1).toArray() || [],
        db.inventoryMovements?.toArray() || [],
        CostService.listCenters(),
        CostService.listAllocations(),
        CostService.listPlans()
      ]);
      setSales(salesList);
      setExpenses(expenseList);
      setProducts(productList);
      setProductionMovements(movementList.filter((m) => m.movement_type === "produccion"));
      setCenters(centerList);
      setAllocations(allocationList);
      setPlans(planList);
      if (!selectedPlanId && planList.length) {
        setSelectedPlanId(planList[0].id);
      }
    };
    load();
  }, [selectedPlanId]);

  useEffect(() => {
    if (!location.hash) return;
    const targetId = location.hash.replace("#", "");
    const el = document.getElementById(targetId);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, [location.hash]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => { map[p.id] = p; });
    return map;
  }, [products]);

  const periodBuckets = useMemo(() => buildPeriods(period), [period]);

  const normalizeAmount = (value) => Number(value || 0);
  const normalizeQty = (value) => Number(value || 0);

  const expenseTotal = expenses.reduce((sum, e) => sum + normalizeAmount(e.total ?? e.amount), 0);
  const revenueTotal = sales.reduce((sum, s) => sum + normalizeAmount(s.total), 0);

  const costByProduct = useMemo(() => {
    const map = {};
    sales.forEach((sale) => {
      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach((item) => {
        const prod = productMap[item.id] || productMap[item.product_id];
        const cost = normalizeAmount(prod?.cost) * normalizeAmount(item.qty || item.quantity || 0);
        const revenue = normalizeAmount(item.price || item.unit_price) * normalizeAmount(item.qty || item.quantity || 0);
        const key = item.id || item.product_id;
        if (!key) return;
        if (!map[key]) {
          map[key] = { product_id: key, name: prod?.name || item.name || key, revenue: 0, cost: 0 };
        }
        map[key].revenue += revenue;
        map[key].cost += cost;
      });
    });
    return Object.values(map).map((entry) => ({
      ...entry,
      profit: entry.revenue - entry.cost,
      margin: entry.revenue > 0 ? (entry.profit / entry.revenue) * 100 : 0
    }));
  }, [sales, productMap]);

  const productionCostSummary = useMemo(() => {
    let producedUnits = 0;
    let totalCost = 0;
    productionMovements.forEach((mov) => {
      const qty = normalizeQty(mov.quantity || mov.qty || mov.amount || 0);
      const prod = productMap[mov.product_id];
      const unitCost = normalizeAmount(prod?.cost);
      producedUnits += qty;
      totalCost += unitCost * qty;
    });
    return { producedUnits, totalCost };
  }, [productionMovements, productMap]);

  const cogsTotal = costByProduct.reduce((sum, p) => sum + p.cost, 0);
  const totalCost = cogsTotal + expenseTotal + productionCostSummary.totalCost;
  const profitTotal = revenueTotal - totalCost;
  const marginTotal = revenueTotal > 0 ? (profitTotal / revenueTotal) * 100 : 0;

  const temporalData = useMemo(() => {
    return periodBuckets.map((bucket) => {
      const salesSum = sales.filter((s) => {
        const date = new Date(s.created_at || s.date || Date.now());
        return date >= bucket.start && date <= bucket.end;
      }).reduce((sum, s) => sum + normalizeAmount(s.total), 0);
      const expenseSum = expenses.filter((e) => {
        const date = new Date(e.date || e.created_at || Date.now());
        return date >= bucket.start && date <= bucket.end;
      }).reduce((sum, e) => sum + normalizeAmount(e.total ?? e.amount), 0);
      const productionCost = productionMovements.filter((m) => {
        const date = new Date(m.date || m.created_at || Date.now());
        return date >= bucket.start && date <= bucket.end;
      }).reduce((sum, m) => {
        const qty = normalizeQty(m.quantity || m.qty || m.amount || 0);
        const prod = productMap[m.product_id];
        return sum + normalizeAmount(prod?.cost) * qty;
      }, 0);
      const costSum = costByProduct.reduce((sum, p) => sum + p.cost, 0);
      return {
        month: bucket.key,
        ingresos: salesSum,
        gastos: expenseSum + costSum + productionCost,
        utilidad: salesSum - (expenseSum + costSum + productionCost),
        produccion: productionCost
      };
    });
  }, [periodBuckets, sales, expenses, costByProduct, productionMovements, productMap]);

  const expenseDistribution = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      const key = e.category || "otros";
      map[key] = (map[key] || 0) + normalizeAmount(e.total ?? e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const centerCosts = useMemo(() => {
    const map = {};
    centers.forEach((c) => { map[c.id] = { name: c.name, total: 0 }; });
    allocations.forEach((a) => {
      if (!map[a.center_id]) return;
      map[a.center_id].total += normalizeAmount(a.amount);
    });
    return Object.entries(map).map(([id, data]) => ({ id, center: data.name, total: data.total }));
  }, [centers, allocations]);

  const trendProjection = useMemo(() => {
    const historical = temporalData.slice(-6).map((item) => ({ period: item.month, historical: item.ingresos }));
    const avg = historical.reduce((sum, item) => sum + item.historical, 0) / (historical.length || 1);
    const future = Array.from({ length: 3 }).map((_, idx) => ({
      period: `P+${idx + 1}`,
      projection: Math.round(avg * (1 + (idx + 1) * 0.05))
    }));
    return [
      ...historical.map((item) => ({ ...item, projection: null })),
      ...future.map((item) => ({ period: item.period, historical: null, projection: item.projection }))
    ];
  }, [temporalData]);

  const costProjection = useMemo(() => {
    const historical = temporalData.slice(-6).map((item) => ({ period: item.month, historical: item.gastos }));
    const avg = historical.reduce((sum, item) => sum + item.historical, 0) / (historical.length || 1);
    const future = Array.from({ length: 3 }).map((_, idx) => ({
      period: `P+${idx + 1}`,
      projection: Math.round(avg * (1 + (idx + 1) * 0.03))
    }));
    return [
      ...historical.map((item) => ({ ...item, projection: null })),
      ...future.map((item) => ({ period: item.period, historical: null, projection: item.projection }))
    ];
  }, [temporalData]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const planActuals = useMemo(() => {
    if (!selectedPlan) return null;
    const start = new Date(selectedPlan.start_date);
    const end = new Date(selectedPlan.end_date);
    const planRevenue = sales.filter((s) => {
      const date = new Date(s.created_at || s.date || Date.now());
      return date >= start && date <= end;
    }).reduce((sum, s) => sum + normalizeAmount(s.total), 0);
    const planExpenses = expenses.filter((e) => {
      const date = new Date(e.date || e.created_at || Date.now());
      return date >= start && date <= end;
    }).reduce((sum, e) => sum + normalizeAmount(e.total ?? e.amount), 0);
    const planProfit = planRevenue - planExpenses;
    return {
      revenue: planRevenue,
      cost: planExpenses,
      profit: planProfit
    };
  }, [selectedPlan, sales, expenses]);

  const planCenterTarget = useMemo(() => {
    if (!selectedPlan || centers.length === 0) return 0;
    return normalizeAmount(selectedPlan.cost_target) / centers.length;
  }, [selectedPlan, centers.length]);

  const handleCreateCenter = async () => {
    if (!centerDraft.name) return;
    await CostService.createCenter(centerDraft);
    setCenterDraft({ code: "", name: "" });
    setCenters(await CostService.listCenters());
  };

  const handleCreateAllocation = async () => {
    if (!allocationDraft.center_id || !allocationDraft.expense_id || !allocationDraft.amount) return;
    const expense = expenses.find((e) => e.id === Number(allocationDraft.expense_id) || e.id === allocationDraft.expense_id);
    await CostService.createAllocation({
      center_id: allocationDraft.center_id,
      source_type: "expense",
      source_id: allocationDraft.expense_id,
      amount: allocationDraft.amount,
      date: expense?.date || new Date().toISOString()
    });
    setAllocationDraft({ center_id: "", expense_id: "", amount: "" });
    setAllocations(await CostService.listAllocations());
  };

  const handleCreatePlan = async () => {
    if (!planDraft.name || !planDraft.start_date || !planDraft.end_date) return;
    await CostService.createPlan(planDraft);
    setPlanDraft({ name: "", start_date: "", end_date: "", revenue_target: "", cost_target: "", profit_target: "" });
    setPlans(await CostService.listPlans());
  };

  const productAnalysis = [...costByProduct].sort((a, b) => b.profit - a.profit).slice(0, 10);

  return (
    <div className="space-y-6 min-h-[calc(100vh-12rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t("page.analytics", "Analítica Avanzada")}</h1>
          <p className="text-xs text-slate-400">Costos, centros de costos y proyección financiera.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`px-3 py-2 rounded-lg text-xs ${period === item.id ? "bg-violet-500/20 text-violet-300" : "bg-slate-800/60 text-slate-300"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {!isConfigView && (
        <>
      <div className="grid gap-3 md:grid-cols-6" id="kpis">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Ingresos</p>
          <p className="text-lg text-emerald-300 font-semibold">{formatCurrency(revenueTotal)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Costos directos</p>
          <p className="text-lg text-slate-200 font-semibold">{formatCurrency(cogsTotal)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Gastos</p>
          <p className="text-lg text-amber-300 font-semibold">{formatCurrency(expenseTotal)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Producción</p>
          <p className="text-lg text-white font-semibold">{formatCurrency(productionCostSummary.totalCost)}</p>
          <p className="text-xs text-slate-500">{productionCostSummary.producedUnits} unidades</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Utilidad</p>
          <p className="text-lg text-white font-semibold">{formatCurrency(profitTotal)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Margen</p>
          <p className="text-lg text-white font-semibold">{marginTotal.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2" id="ingresos-costos">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">Ingresos vs Costos</h3>
          <IncomeExpenseChart data={temporalData} />
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">Distribución de gastos</h3>
          <ExpenseDistributionChart data={expenseDistribution} />
        </div>
      </div>

          <div className="grid gap-6 lg:grid-cols-2" id="ventas">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">Ventas por periodo</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={temporalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="ingresos" fill="#10b981" name="Ventas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4" id="centros-costo">
          <h3 className="text-white font-semibold mb-3">Costos por centro</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={centerCosts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="center" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#8b5cf6" name="Costo" />
            </BarChart>
          </ResponsiveContainer>
        </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 lg:col-span-2">
          <h3 className="text-white font-semibold mb-3">Proyección de ingresos</h3>
              <TrendProjectionChart data={trendProjection} height={320} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2" id="proyecciones">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">Proyección de costos</h3>
          <TrendProjectionChart data={costProjection} />
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4" id="comparativo-centros">
          <h3 className="text-white font-semibold mb-3">Comparativo por centro</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={centerCosts.map((center) => ({
                ...center,
                plan: planCenterTarget
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="center" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#06b6d4" name="Real" />
              <Bar dataKey="plan" fill="#8b5cf6" name="Plan" />
            </BarChart>
          </ResponsiveContainer>
          {selectedPlan && (
            <p className="text-xs text-slate-400 mt-2">
              Objetivo por centro basado en plan seleccionado.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => exportCSV(temporalData, "analitica_temporal.csv")}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
        >
          Exportar temporalidad CSV
        </button>
        <button
          onClick={() => exportCSV(centerCosts, "costos_centros.csv")}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
        >
          Exportar centros CSV
        </button>
        <button
          onClick={() => exportCSV(productAnalysis, "costos_productos.csv")}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
        >
          Exportar productos CSV
        </button>
        <button
          onClick={exportReportPDF}
          className="px-3 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs"
        >
          Exportar PDF
        </button>
      </div>

        </>
      )}

      {isConfigView && (
        <>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4" ref={reportRef} id="productos">
            <h3 className="text-white font-semibold">Análisis de ventas y costos por producto</h3>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="text-left py-2">Producto</th>
                    <th className="text-right py-2">Ingresos</th>
                    <th className="text-right py-2">Costo</th>
                    <th className="text-right py-2">Utilidad</th>
                    <th className="text-right py-2">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {productAnalysis.map((item) => (
                    <tr key={item.product_id} className="border-t border-slate-700/50">
                      <td className="py-2 text-slate-200">{item.name}</td>
                      <td className="py-2 text-right text-emerald-300">{formatCurrency(item.revenue)}</td>
                      <td className="py-2 text-right text-slate-300">{formatCurrency(item.cost)}</td>
                      <td className="py-2 text-right text-white">{formatCurrency(item.profit)}</td>
                      <td className="py-2 text-right text-white">{item.margin.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {productAnalysis.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">Sin datos de productos.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2" id="config">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
              <h3 className="text-white font-semibold">Centros de costo</h3>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  value={centerDraft.code}
                  onChange={(e) => setCenterDraft((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="Código"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <input
                  value={centerDraft.name}
                  onChange={(e) => setCenterDraft((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <button
                onClick={handleCreateCenter}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
              >
                Crear centro
              </button>
              <div className="grid gap-2">
                {centers.map((center) => (
                  <div key={center.id} className="flex items-center justify-between text-sm text-slate-300">
                    <span>{center.code} · {center.name}</span>
                  </div>
                ))}
                {centers.length === 0 && <p className="text-xs text-slate-500">Sin centros registrados.</p>}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3" id="asignaciones">
              <h3 className="text-white font-semibold">Asignar costos</h3>
              <div className="grid gap-2">
                <select
                  value={allocationDraft.center_id}
                  onChange={(e) => setAllocationDraft((prev) => ({ ...prev, center_id: e.target.value }))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Centro de costo</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>{center.name}</option>
                  ))}
                </select>
                <select
                  value={allocationDraft.expense_id}
                  onChange={(e) => setAllocationDraft((prev) => ({ ...prev, expense_id: e.target.value }))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Gasto</option>
                  {expenses.map((expense) => (
                    <option key={expense.id} value={expense.id}>
                      {expense.vendor || expense.category} · {formatCurrency(expense.total ?? expense.amount)}
                    </option>
                  ))}
                </select>
                <input
                  value={allocationDraft.amount}
                  onChange={(e) => setAllocationDraft((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Monto asignado"
                  type="number"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <button
                onClick={handleCreateAllocation}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
              >
                Asignar costo
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4" id="plan-real">
            <h3 className="text-white font-semibold">Plan vs Real</h3>
            <div className="grid gap-2 md:grid-cols-3">
              <input
                value={planDraft.name}
                onChange={(e) => setPlanDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre del plan"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <input
                value={planDraft.start_date}
                onChange={(e) => setPlanDraft((prev) => ({ ...prev, start_date: e.target.value }))}
                type="date"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <input
                value={planDraft.end_date}
                onChange={(e) => setPlanDraft((prev) => ({ ...prev, end_date: e.target.value }))}
                type="date"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <input
                value={planDraft.revenue_target}
                onChange={(e) => setPlanDraft((prev) => ({ ...prev, revenue_target: e.target.value }))}
                placeholder="Ingreso objetivo"
                type="number"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <input
                value={planDraft.cost_target}
                onChange={(e) => setPlanDraft((prev) => ({ ...prev, cost_target: e.target.value }))}
                placeholder="Costo objetivo"
                type="number"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <input
                value={planDraft.profit_target}
                onChange={(e) => setPlanDraft((prev) => ({ ...prev, profit_target: e.target.value }))}
                placeholder="Utilidad objetivo"
                type="number"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <button
              onClick={handleCreatePlan}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
            >
              Guardar plan
            </button>

            <div className="grid gap-3 md:grid-cols-2 items-center">
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">Seleccionar plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
              {selectedPlan && (
                <span className="text-xs text-slate-400">
                  {selectedPlan.start_date} - {selectedPlan.end_date}
                </span>
              )}
            </div>

            {selectedPlan && planActuals && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Ingresos (real / plan)</p>
                  <p className="text-sm text-white">
                    {formatCurrency(planActuals.revenue)} / {formatCurrency(selectedPlan.revenue_target)}
                  </p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Costos (real / plan)</p>
                  <p className="text-sm text-white">
                    {formatCurrency(planActuals.cost)} / {formatCurrency(selectedPlan.cost_target)}
                  </p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Utilidad (real / plan)</p>
                  <p className="text-sm text-white">
                    {formatCurrency(planActuals.profit)} / {formatCurrency(selectedPlan.profit_target)}
                  </p>
                </div>
                <div className="md:col-span-3">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={[
                        {
                          name: "Ingresos",
                          real: planActuals.revenue,
                          plan: selectedPlan.revenue_target
                        },
                        {
                          name: "Costos",
                          real: planActuals.cost,
                          plan: selectedPlan.cost_target
                        },
                        {
                          name: "Utilidad",
                          real: planActuals.profit,
                          plan: selectedPlan.profit_target
                        }
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="real" fill="#10b981" name="Real" />
                      <Bar dataKey="plan" fill="#8b5cf6" name="Plan" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      
    </div>
  );
}
