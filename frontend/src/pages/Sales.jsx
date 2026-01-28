import { useState, useEffect } from "react";
import { db } from "../services/dataService";
import { formatCurrency } from "../config/businessConfig";
import { t } from "../i18n";

export default function Sales() {
  const [sales, setSales] = useState([]);

  useEffect(() => {
    const loadSales = async () => {
      try {
        const data = await db.sales?.orderBy("created_at").reverse().limit(50).toArray() || [];
        setSales(data);
      } catch (e) { console.error(e); }
    };
    loadSales();
  }, []);


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("page.salesHistory", "Historial de Ventas")}</h1>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden min-h-[520px] max-h-[calc(100vh-14rem)] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Fecha</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Total</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {sales.length === 0 ? (
              <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-500">No hay ventas registradas</td></tr>
            ) : sales.map(sale => (
              <tr key={sale.id} className="hover:bg-slate-700/50">
                <td className="px-4 py-3 text-sm text-white font-mono">{sale.id?.slice(-8)}</td>
                <td className="px-4 py-3 text-sm text-slate-300">{new Date(sale.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-right text-emerald-400 font-medium">{formatCurrency(sale.total)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${sale.voided_at ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                    {sale.voided_at ? "Anulada" : "Completada"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
