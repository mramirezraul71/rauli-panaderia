import { Navigate, useNavigate, useLocation } from "react-router-dom";
import AccessControlWidget from "../components/AccessControlWidget";
import { useAuth } from "../context/AuthContext";

const MENU_TABS = [
  { id: "Operaciones", path: "/", label: "Operaciones" },
  { id: "Caja", path: "/cash", label: "Caja" },
  { id: "Inventario", path: "/inventory", label: "Inventario" },
  { id: "Produccion", path: "/produccion", label: "Produccion" },
  { id: "Compras", path: "/inventory", label: "Compras" },
  { id: "Marketing", path: "/reports", label: "Marketing" },
  { id: "Gerencia", path: "/reports", label: "Gerencia" },
];

export default function AccessControl() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const currentPath = location.pathname;
  const activeTab = MENU_TABS.find(
    (t) => t.path === currentPath || (t.path !== "/" && currentPath.startsWith(t.path))
  )?.id ?? null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Barra de menú (movimiento del centro de control de acceso según acordado) */}
      <nav className="flex flex-wrap gap-2 p-2 sm:p-3 rounded-xl sm:rounded-2xl border-2 sm:border border-slate-600/80 sm:border-slate-700/50 bg-slate-800/60 overflow-x-auto overflow-y-hidden min-h-[44px]">
        {MENU_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.path)}
            className={`flex-shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all border min-h-[40px] sm:min-h-[44px] cursor-pointer [touch-action:manipulation] ${
              activeTab === tab.id
                ? "bg-violet-600 text-white border-violet-500/50 shadow-md shadow-violet-500/20"
                : "bg-slate-700/60 text-slate-300 border-slate-600/60 hover:bg-slate-700 hover:text-white hover:border-slate-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 overflow-hidden">
        <AccessControlWidget />
      </div>
    </div>
  );
}
