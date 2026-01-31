import AccessControlWidget from "../components/AccessControlWidget";

export default function Dashboard() {
  return (
    <div className="w-full max-w-6xl mx-auto px-0 sm:px-2">
      <div className="dashboard-card-mobile rounded-2xl border-2 border-slate-600 bg-slate-900/80 overflow-hidden min-w-0 shadow-xl shadow-black/30 sm:rounded-2xl sm:border-slate-700/80 sm:bg-slate-900/60">
        <div className="p-4 sm:p-6 grid gap-4 sm:gap-6 min-h-0">
          <AccessControlWidget />
        </div>
      </div>
    </div>
  );
}