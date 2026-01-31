import AccessControlWidget from "../components/AccessControlWidget";

export default function Dashboard() {
  return (
    <div className="w-full max-w-6xl mx-auto px-0 sm:px-2">
      <div className="rounded-2xl border-2 border-slate-700/80 bg-slate-900/60 overflow-hidden min-w-0 shadow-lg shadow-black/20 sm:rounded-2xl">
        <div className="p-4 sm:p-6 grid gap-4 sm:gap-6 min-h-0">
          <AccessControlWidget />
        </div>
      </div>
    </div>
  );
}