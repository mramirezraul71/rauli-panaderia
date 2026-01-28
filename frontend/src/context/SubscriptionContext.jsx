import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { PLANS, getPlanFeatures, isPlanAtLeast } from "../config/plans";

const STORAGE_KEY = "genesis_subscription_plan";
const LEGACY_STORAGE_KEY = "rauli_subscription_plan";
const DEFAULT_PLAN = "FREE";

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const [plan, setPlan] = useState(DEFAULT_PLAN);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved && PLANS[saved]) {
        setPlan(saved);
        if (saved && !localStorage.getItem(STORAGE_KEY)) {
          localStorage.setItem(STORAGE_KEY, saved);
        }
      }
    } catch {}
  }, []);

  const adminOverride = (planName) => {
    if (!PLANS[planName]) return;
    setPlan(planName);
    try { localStorage.setItem(STORAGE_KEY, planName); } catch {}
  };

  const features = useMemo(() => getPlanFeatures(plan), [plan]);

  const value = {
    plan,
    planLabel: PLANS[plan]?.label || PLANS.FREE.label,
    features,
    adminOverride,
    hasFeature: (feature) => features.includes(feature),
    hasPlanAtLeast: (requiredPlan) => isPlanAtLeast(plan, requiredPlan)
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    return {
      plan: DEFAULT_PLAN,
      planLabel: PLANS.FREE.label,
      features: getPlanFeatures(DEFAULT_PLAN),
      adminOverride: () => {},
      hasFeature: () => false,
      hasPlanAtLeast: () => false
    };
  }
  return context;
}

export default SubscriptionContext;
