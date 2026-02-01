import AccessControlWidget from "../components/AccessControlWidget";

export default function Dashboard() {
  return (
    <div className="w-full min-h-0 flex-1 space-y-4 sm:space-y-6" aria-label="Pantalla principal para el asistente RAULI">
      <div
        className="p-4 sm:p-6 rounded-2xl border-2 sm:border border-slate-700/80 sm:border-slate-800/60 bg-slate-900/40 backdrop-blur-sm overflow-hidden dashboard-card-mobile"
      >
        <div className="min-h-[120px] flex flex-col justify-center items-center text-center text-slate-400 text-sm sm:text-base">
          <p>Asistente RAULI siempre activo en la barra inferior.</p>
          <p className="mt-2">Usa el menú lateral para ir a Operaciones, Caja, Inventario y más.</p>
        </div>
      </div>
      <AccessControlWidget />
    </div>
  );
}