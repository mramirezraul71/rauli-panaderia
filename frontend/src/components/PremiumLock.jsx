import { useSubscription } from "../context/SubscriptionContext";
import { useAuth } from "../context/AuthContext";

export default function PremiumLock({ requiredPlan = "PRO", children, title = "Módulo Premium" }) {
  const { hasPlanAtLeast } = useSubscription();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const allowed = isAdmin || hasPlanAtLeast(requiredPlan);

  if (allowed) return children;

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-10 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
      <p className="text-slate-400">
        Disponible solo en planes PRO/MAX o con acceso de administrador.
      </p>
    </div>
  );
}
