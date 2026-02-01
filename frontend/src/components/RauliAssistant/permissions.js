export const DEFAULT_PERMISSIONS = {
  canNavigate: true,
  canQuery: true,
  canCreate: true,
  canUpdate: true,
  canDelete: false,
  canAnalyze: true,
  allowedRoutes: [
    "/dashboard",
    "/pos",
    "/sales",
    "/products",
    "/inventory",
    "/customers",
    "/reports"
  ]
};

export const OWNER_PERMISSIONS = {
  canNavigate: true,
  canQuery: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  canAnalyze: true,
  allowedRoutes: [
    "/dashboard",
    "/pos",
    "/sales",
    "/products",
    "/inventory",
    "/customers",
    "/credits",
    "/reports",
    "/settings",
    "/expenses",
    "/cash",
    "/quality",
    "/support",
    "/produccion",
    "/employees",
    "/accounting",
    "/accounting-advanced",
    "/analytics-advanced",
    "/shrinkage",
    "/config-productos",
    "/control-tower"
  ]
};

export const ALL_ROUTES = OWNER_PERMISSIONS.allowedRoutes;

export const DEFAULT_PROFILES = [
  { id: "owner", name: "Dueño", role: "Admin", permissions: OWNER_PERMISSIONS },
  { id: "cajero", name: "Cajero", role: "Caja", permissions: {
    ...DEFAULT_PERMISSIONS,
    canDelete: false,
    allowedRoutes: ["/dashboard", "/pos", "/sales", "/customers", "/cash"]
  }},
  { id: "inventario", name: "Inventario", role: "Stock", permissions: {
    ...DEFAULT_PERMISSIONS,
    allowedRoutes: ["/dashboard", "/inventory", "/products", "/reports"]
  }},
  { id: "produccion", name: "Produccion", role: "Horno", permissions: {
    ...DEFAULT_PERMISSIONS,
    allowedRoutes: ["/dashboard", "/produccion", "/inventory", "/products"]
  }},
  { id: "gerencia", name: "Gerencia", role: "Supervisor", permissions: {
    ...DEFAULT_PERMISSIONS,
    canDelete: false,
    allowedRoutes: ["/dashboard", "/sales", "/reports", "/expenses", "/products", "/inventory"]
  }}
];
