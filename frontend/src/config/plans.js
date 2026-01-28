export const PLANS = {
  FREE: {
    name: "FREE",
    label: "Básico",
    features: ["basic"]
  },
  PRO: {
    name: "PRO",
    label: "Reportes",
    features: ["basic", "reports"]
  },
  MAX: {
    name: "MAX",
    label: "IA y Predicciones",
    features: ["basic", "reports", "ai", "predictions"]
  }
};

export const PLAN_ORDER = ["FREE", "PRO", "MAX"];

export const getPlanFeatures = (planName) => {
  return PLANS[planName]?.features || PLANS.FREE.features;
};

export const isPlanAtLeast = (planName, requiredPlan) => {
  const currentIndex = PLAN_ORDER.indexOf(planName);
  const requiredIndex = PLAN_ORDER.indexOf(requiredPlan);
  if (currentIndex === -1 || requiredIndex === -1) return false;
  return currentIndex >= requiredIndex;
};
