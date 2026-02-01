import { useState, useEffect } from "react";
import { db } from "../services/dataService";
import { formatCurrency } from "../config/businessConfig";
import { useSubscription } from "../context/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { t } from "../i18n";

export default function Reports() {
  const { hasPlanAtLeast } = useSubscription();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalSales: 0, totalExpenses: 0, profit: 0 });
  const margin = stats.totalSales > 0 ? stats.profit / stats.totalSales : 0;

  useEffect(() => {
    if (!hasPlanAtLeast("PRO")) return;
    const load = async () => {
      try {
        const sales = await db.sales?.filter(s => !s.voided_at).toArray() || [];
        const expenses = await db.expenses?.filter(e => !e.deleted_at).toArray() || [];
        const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        setStats({ totalSales, totalExpenses, profit: totalSales - totalExpenses });
      } catch (e) { console.error(e); }
    };
    load();
  }, [hasPlanAtLeast]);


  if (!hasPlanAtLeast("PRO")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">{t("page.reports", "Reportes")}</h1>
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-slate-300">
          <div className="text-lg font-semibold mb-2">Función Premium 🔒</div>
          <p className="text-sm text-slate-400 mb-4">Los reportes están disponibles desde el plan PRO.</p>
          <button
            onClick={() => navigate("/settings")}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            Ir a Configuración
          </button>
        </div>
        <div className="flex flex-wrap gap-3 bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            Volver al Dashboard
          </button>
          <button
            onClick={() => navigate("/analytics-advanced")}
            className="px-4 py-2 bg-violet-600/20 text-violet-200 hover:bg-violet-600/30 rounded-lg text-sm"
          >
            Ir a Analítica Avanzada
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("page.reports", "Reportes")}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p className="text-slate-400 text-sm">Ventas Totales</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{formatCurrency(stats.totalSales)}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p className="text-slate-400 text-sm">Gastos Totales</p>
          <p className="text-3xl font-bold text-red-400 mt-2">{formatCurrency(stats.totalExpenses)}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p className="text-slate-400 text-sm">Ganancia Neta</p>
          <p className={`text-3xl font-bold mt-2 ${stats.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(stats.profit)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-2">Resumen ejecutivo</h3>
          <p className="text-sm text-slate-400">
            Margen neto actual:{" "}
            <span className={`font-semibold ${margin >= 0.1 ? "text-emerald-400" : margin >= 0 ? "text-amber-400" : "text-red-400"}`}>
              {(margin * 100).toFixed(1)}%
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Ajusta precios, costos directos y gastos operativos para mejorar la rentabilidad.
          </p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-2">Acciones sugeridas</h3>
          <div className="grid gap-2">
            <button
              onClick={() => navigate("/analytics-advanced")}
              className="px-4 py-2 bg-violet-600/20 text-violet-200 hover:bg-violet-600/30 rounded-lg text-sm"
            >
              Abrir analítica avanzada
            </button>
            <button
              onClick={() => navigate("/expenses")}
              className="px-4 py-2 bg-slate-700/70 hover:bg-slate-700 text-white rounded-lg text-sm"
            >
              Revisar gastos recientes
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
        >
          Volver al Dashboard
        </button>
        <button
          onClick={() => navigate("/analytics-advanced")}
          className="px-4 py-2 bg-violet-600/20 text-violet-200 hover:bg-violet-600/30 rounded-lg text-sm"
        >
          Volver a Analítica Avanzada
        </button>
      </div>
    </div>
  );
}
