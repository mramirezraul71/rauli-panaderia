import { cloneElement } from "react";
import { useSubscription } from "../context/SubscriptionContext";

export default function PremiumFeature({ requiredPlan, requiredFeature, children }) {
  const { hasFeature, hasPlanAtLeast } = useSubscription();

  const allowed = requiredPlan
    ? hasPlanAtLeast(requiredPlan)
    : requiredFeature
      ? hasFeature(requiredFeature)
      : true;

  if (!children) return null;

  if (!allowed) {
    const child = cloneElement(children, {
      disabled: true,
      "aria-disabled": true,
      title: "Bloqueado por plan 🔒"
    });

    return (
      <div className="relative inline-flex items-center gap-2">
        {child}
        <span className="text-xs text-slate-400">🔒</span>
      </div>
    );
  }

  return children;
}
