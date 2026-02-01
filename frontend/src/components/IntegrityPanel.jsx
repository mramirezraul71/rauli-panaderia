import { useEffect, useState } from "react";
import sentinelService, { HEALTH_STATUS } from "../services/SentinelService";

const STATUS_LABELS = {
  [HEALTH_STATUS.GREEN]: "Estable",
  [HEALTH_STATUS.YELLOW]: "Atencion",
  [HEALTH_STATUS.RED]: "Critico"
};

export default function IntegrityPanel() {
  const [state, setState] = useState(sentinelService.getState());
  const [isRunning, setIsRunning] = useState(false);
  const [autoCorrectEnabled, setAutoCorrectEnabled] = useState(sentinelService.getAutoCorrectEnabled());

  useEffect(() => {
    const unsubscribe = sentinelService.subscribe(setState);
    sentinelService.start(60000);
    setIsRunning(true);
    return () => {
      unsubscribe();
      sentinelService.stop();
      setIsRunning(false);
    };
  }, []);

  const runCheck = async () => {
    await sentinelService.runHealthCheck();
  };

  const toggleAutoCorrect = (enabled) => {
    setAutoCorrectEnabled(enabled);
    sentinelService.setAutoCorrectEnabled(enabled);
  };

  const getSignalColor = (intensity) => {
    if (intensity === "red") return "bg-rose-500/20 text-rose-200 border-rose-400/40";
    if (intensity === "yellow") return "bg-amber-500/20 text-amber-200 border-amber-400/40";
    return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40";
  };

  const getStageLabel = (stage) => {
    const map = {
      ventas: "Ventas",
      caja_cierre: "Caja (Cierre)",
      caja_movimientos: "Caja (Movimientos)",
      inventario: "Inventario",
      contabilidad: "Contabilidad",
      bloqueo_ui: "Bloqueo UI"
    };
    return map[stage] || "Sistema";
  };

  const getStageColor = (stage) => {
    if (stage === "ventas") return "bg-violet-500/20 text-violet-200 border-violet-400/40";
    if (stage === "caja_cierre") return "bg-amber-500/20 text-amber-200 border-amber-400/40";
    if (stage === "caja_movimientos") return "bg-orange-500/20 text-orange-200 border-orange-400/40";
    if (stage === "inventario") return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40";
    if (stage === "contabilidad") return "bg-rose-500/20 text-rose-200 border-rose-400/40";
    if (stage === "bloqueo_ui") return "bg-red-500/20 text-red-200 border-red-400/40";
    return "bg-slate-700/30 text-slate-200 border-slate-500/40";
  };

  const groupedStages = state.alerts.reduce((acc, alert) => {
    const stage = alert.details?.stage || "sistema";
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});

  const exportDiagnostic = async () => {
    const report = await sentinelService.generateDiagnosticReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "diagnostico_integridad.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${
            state.status === HEALTH_STATUS.RED
              ? "bg-rose-500"
              : state.status === HEALTH_STATUS.YELLOW
                ? "bg-amber-500"
                : "bg-emerald-500"
          }`} />
          <div>
            <h3 className="text-lg font-semibold text-white">Centro de Integridad</h3>
            <p className="text-xs text-slate-400">
              Estado: {STATUS_LABELS[state.status]} • Ultimo chequeo: {state.lastCheck ? new Date(state.lastCheck).toLocaleString() : "—"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runCheck}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            Ejecutar verificacion
          </button>
          <button
            onClick={() => toggleAutoCorrect(!autoCorrectEnabled)}
            className={`px-3 py-2 rounded-lg text-sm ${
              autoCorrectEnabled ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
            }`}
          >
            Autocorreccion: {autoCorrectEnabled ? "Activa" : "Off"}
          </button>
          <button
            onClick={exportDiagnostic}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
          >
            Exportar diagnostico
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="text-slate-400">Criticas</div>
          <div className="text-lg font-semibold text-rose-400">{state.criticalCount}</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="text-slate-400">Advertencias</div>
          <div className="text-lg font-semibold text-amber-400">{state.warningCount}</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300">
          <div className="text-slate-400">Informativas</div>
          <div className="text-lg font-semibold text-emerald-400">{state.infoCount}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {Object.keys(groupedStages).length === 0 ? (
          <span className="text-slate-500">Sin etapas críticas</span>
        ) : Object.entries(groupedStages).map(([stage, count]) => (
          <span key={stage} className={`px-2 py-1 rounded border ${getStageColor(stage)}`}>
            {getStageLabel(stage)}: {count}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {state.alerts.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-6">Sin alertas activas</div>
        ) : state.alerts.map((alert) => (
          <div key={alert.id} className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-2">
                <span>{alert.type}</span>
                {alert.details?.stage && (
                  <span className={`px-2 py-0.5 rounded border text-xs ${getStageColor(alert.details.stage)}`}>
                    {getStageLabel(alert.details.stage)}
                  </span>
                )}
              </div>
              <span>{alert.timestamp ? new Date(alert.timestamp).toLocaleString() : "-"}</span>
            </div>
            <div className="text-white mt-1">{alert.message}</div>
            {alert.details?.intensity && (
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs mt-2 ${getSignalColor(alert.details.intensity)}`}>
                Señal IA: {alert.details.intensity.toUpperCase()}
              </div>
            )}
            {alert.details && Object.keys(alert.details).length > 0 && (
              <div className="text-xs text-slate-500 mt-2">
                {Object.entries(alert.details).slice(0, 5).map(([key, value]) => (
                  <div key={key}>
                    {key}: {typeof value === "object" ? JSON.stringify(value).slice(0, 140) : String(value)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {state.lastAutoCorrections?.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400">
          <div className="font-semibold text-slate-300 mb-2">Autocorrecciones recientes</div>
          <div className="space-y-1">
            {state.lastAutoCorrections.map((item, idx) => (
              <div key={`${item.type}-${idx}`}>
                {item.type} • {item.sessionId || item.saleId} • {item.expected || item.total}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-slate-500">
        Monitoreo {isRunning ? "activo" : "detenido"} • Se actualiza automaticamente cada 60s
      </div>
    </div>
  );
}
