import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "../services/dataService";
import { formatCurrency } from "../config/businessConfig";
import { t } from "../i18n";

export default function Credits() {
  const [customers, setCustomers] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const selectedCustomerId = new URLSearchParams(location.search).get("customer_id");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await db.customers?.where("active").equals(1).filter(c => (c.balance || 0) > 0).toArray() || [];
        setCustomers(data);
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  const totalDebt = customers.reduce((sum, c) => sum + (c.balance || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("page.credits", "Creditos Pendientes")}</h1>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-3">
            <div className="text-sm text-slate-400">
              {customers.length} clientes con saldo pendiente
            </div>
            <button
              onClick={() => navigate("/customers")}
              className="text-xs text-violet-300 hover:text-violet-200"
            >
              Ver clientes
            </button>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 min-h-[520px] max-h-[calc(100vh-18rem)] overflow-y-auto">
            {customers.length === 0 ? (
              <div className="bg-slate-900/60 rounded-xl p-8 text-center border border-slate-700/60">
                <p className="text-slate-500">No hay creditos pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customers.map(c => (
                  <div
                    key={c.id}
                    className={`bg-slate-900/60 rounded-xl p-4 border flex justify-between items-center ${
                      selectedCustomerId && String(c.id) === String(selectedCustomerId)
                        ? "border-violet-500/60 shadow-lg shadow-violet-500/10"
                        : "border-slate-700/60"
                    }`}
                  >
                    <div>
                      <h3 className="font-semibold text-white">{c.name}</h3>
                      <p className="text-sm text-slate-400">{c.phone || "Sin telefono"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-amber-400">{formatCurrency(c.balance)}</p>
                      <button className="text-xs text-violet-400 hover:text-violet-300">Registrar Abono</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
            <p className="text-amber-400 text-sm">Total por Cobrar</p>
            <p className="text-3xl font-bold text-amber-400">{formatCurrency(totalDebt)}</p>
            <p className="text-xs text-amber-200/70 mt-2">
              Monitorea el flujo y reduce el riesgo de mora.
            </p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-sm text-slate-300 font-medium mb-3">Acciones rápidas</p>
            <div className="grid gap-2">
              <button
                onClick={() => navigate("/reports")}
                className="px-4 py-2 bg-slate-700/70 hover:bg-slate-700 text-white rounded-lg text-sm"
              >
                Ver reportes de cobranza
              </button>
              <button
                onClick={() => navigate("/analytics-advanced")}
                className="px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 rounded-lg text-sm"
              >
                Analítica avanzada
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
