export default function Dashboard() {
  return (
    <div
      className="w-full min-h-0 flex-1 p-4 sm:p-6 rounded-2xl border-2 sm:border border-slate-700/80 sm:border-slate-800/60 bg-slate-900/40 backdrop-blur-sm overflow-hidden dashboard-card-mobile"
      aria-label="Pantalla principal para el asistente RAULI"
    >
      <div className="h-full min-h-[200px] flex flex-col justify-center items-center text-center text-slate-400 text-sm sm:text-base">
        <p>Asistente RAULI siempre activo en la barra inferior.</p>
        <p className="mt-2">Usa el menú lateral para ir a Operaciones, Caja, Inventario y más.</p>
      </div>
    </div>
  );
}