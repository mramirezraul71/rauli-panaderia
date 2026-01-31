import AccessControlWidget from "../components/AccessControlWidget";

export default function AccessControl() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 overflow-hidden">
        <AccessControlWidget />
      </div>
    </div>
  );
}
