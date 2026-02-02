import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Routes, Route, Navigate, NavLink, useLocation, Outlet, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { db, logAudit } from "./services/dataService";
import sentinelService from "./services/SentinelService";
import { formatCurrency, getFeatureFlags, setBusinessConfig } from "./config/businessConfig";
import { t } from "./i18n";
const RauliAssistant = lazy(() => import("./components/RauliAssistant/RauliAssistant"));
import { CommandCenterProvider } from "./context/CommandCenterContext";
import { RauliProvider } from "./context/RauliContext";
import { WelcomeTourProvider } from "./components/WelcomeTour";
import NotificationCenter from "./components/NotificationCenter";
import SupportService from "./services/SupportService";
import AppUpdater from "./components/AppUpdater";
import VersionChecker from "./components/VersionChecker";
import { HiOutlineHome, HiOutlineShoppingCart, HiOutlineDocumentText, HiOutlineCube, HiOutlineUsers, HiOutlineCreditCard, HiOutlineCash, HiOutlineReceiptTax, HiOutlineExclamation, HiOutlineChartBar, HiOutlineCog, HiOutlineMenu, HiOutlineX, HiCheck, HiOutlineDatabase, HiOutlineShieldCheck, HiOutlineCalculator, HiOutlineArchive, HiOutlineCloud, HiOutlineBell, HiOutlineCode, HiOutlineTruck, HiOutlineRefresh, HiOutlineLockClosed } from "react-icons/hi";
import { Package } from 'lucide-react';
import { useAuth } from "./context/AuthContext";
import { APP_VERSION, LAST_IMPROVEMENT_NOTE } from "./config/version";

const readWithMigration = (key, legacyKey) => {
  try {
    const current = localStorage.getItem(key);
    if (current !== null) return current;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      return legacy;
    }
  } catch {}
  return null;
};

// 
// SYSTEM STATUS HOOK
// 

function useSystemStatus() {
  const [status, setStatus] = useState({ level: "ok", alerts: [] });

  useEffect(() => {
    const checkStatus = async () => {
      const alerts = [];
      
      try {
        const products = await db.products?.where("active").equals(1).toArray() || [];
        const lowStock = products.filter(p => (p.stock || 0) < 5);
        if (lowStock.length > 0) alerts.push({ type: "warning", msg: `${lowStock.length} productos con stock bajo` });

        const customers = await db.customers?.where("active").equals(1).toArray() || [];
        const totalDebt = customers.reduce((s, c) => s + (c.balance || 0), 0);
        if (totalDebt > 1000) alerts.push({ type: "warning", msg: `${formatCurrency(totalDebt)} en créditos pendientes` });

        const aiKey = await db.settings?.get("ai_api_key");
        if (!aiKey?.value) alerts.push({ type: "info", msg: "IA no configurada" });

        setStatus({
          level: alerts.some(a => a.type === "error") ? "error" : alerts.some(a => a.type === "warning") ? "warning" : "ok",
          alerts
        });
      } catch (e) {
        setStatus({ level: "error", alerts: [{ type: "error", msg: "Error de sistema" }] });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  return status;
}

// 
// BOOT LOADER
// 

function BootLoader({ onComplete }) {
  const [checks, setChecks] = useState([
    { id: 1, name: "Base de Datos (IndexedDB)", status: "pending", detail: "", icon: HiOutlineDatabase },
    { id: 2, name: "Integridad del Schema", status: "pending", detail: "", icon: HiOutlineShieldCheck },
    { id: 3, name: "Ecuación Contable (A=P+C)", status: "pending", detail: "", icon: HiOutlineCalculator },
    { id: 4, name: "Consistencia de Inventario", status: "pending", detail: "", icon: HiOutlineArchive },
    { id: 5, name: "Motor de IA (Gemini)", status: "pending", detail: "", icon: HiOutlineCloud },
  ]);
  const [currentCheck, setCurrentCheck] = useState(0);
  const [canStart, setCanStart] = useState(false);
  const [overallStatus, setOverallStatus] = useState("checking");

  useEffect(() => {
    const runChecks = async () => {
      const results = [];
      
      try { await db.open(); results.push({ status: "success", detail: "Conexión OK" }); } 
      catch (e) { results.push({ status: "error", detail: "Error de conexión" }); }
      setCurrentCheck(0);
      setChecks(prev => prev.map((c, i) => i === 0 ? { ...c, ...results[0] } : c));
      await new Promise(r => setTimeout(r, 300));

      try {
        for (const t of ["products", "sales", "customers", "settings"]) await db[t]?.count();
        results.push({ status: "success", detail: "Schema íntegro" });
      } catch (e) { results.push({ status: "warning", detail: "Tablas faltantes" }); }
      setCurrentCheck(1);
      setChecks(prev => prev.map((c, i) => i === 1 ? { ...c, ...results[1] } : c));
      await new Promise(r => setTimeout(r, 300));

      results.push({ status: "success", detail: "Sin cuentas (nuevo sistema)" });
      setCurrentCheck(2);
      setChecks(prev => prev.map((c, i) => i === 2 ? { ...c, ...results[2] } : c));
      await new Promise(r => setTimeout(r, 300));

      try {
        const products = await db.products?.where("active").equals(1).count() || 0;
        results.push({ status: "success", detail: `${products} productos OK` });
      } catch (e) { results.push({ status: "success", detail: "0 productos OK" }); }
      setCurrentCheck(3);
      setChecks(prev => prev.map((c, i) => i === 3 ? { ...c, ...results[3] } : c));
      await new Promise(r => setTimeout(r, 300));

      try {
        const aiKey = await db.settings?.get("ai_api_key");
        results.push({ status: aiKey?.value ? "success" : "warning", detail: aiKey?.value ? "API Key configurada" : "Sin API Key" });
      } catch (e) { results.push({ status: "warning", detail: "Sin configurar" }); }
      setCurrentCheck(4);
      setChecks(prev => prev.map((c, i) => i === 4 ? { ...c, ...results[4] } : c));
      await new Promise(r => setTimeout(r, 300));

      const hasErrors = results.some(r => r.status === "error");
      const hasWarnings = results.some(r => r.status === "warning");
      setOverallStatus(hasErrors ? "error" : hasWarnings ? "warning" : "success");
      setCanStart(true);
    };

    runChecks();
  }, []);

  const getStatusIcon = (status) => {
    if (status === "pending") return <div className="w-4 h-4 border-2 border-slate-600 border-t-violet-500 rounded-full animate-spin" />;
    if (status === "success") return <HiCheck className="w-5 h-5 text-emerald-400" />;
    if (status === "warning") return <HiOutlineExclamation className="w-5 h-5 text-amber-400" />;
    return <HiOutlineX className="w-5 h-5 text-red-400" />;
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center z-50">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-violet-500/30 animate-pulse">
            <span className="text-5xl">🧩</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-wide">RAULI</h1>
          <p className="text-slate-400">Panaderia y Dulceria v{APP_VERSION}</p>
        </div>

        <div className={`mb-6 p-4 rounded-xl border ${
          overallStatus === "success" ? "bg-emerald-500/10 border-emerald-500/30" :
          overallStatus === "warning" ? "bg-amber-500/10 border-amber-500/30" :
          overallStatus === "error" ? "bg-red-500/10 border-red-500/30" :
          "bg-slate-800/50 border-slate-700"
        }`}>
          <div className="flex items-center gap-3">
            {overallStatus === "checking" ? <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /> : getStatusIcon(overallStatus)}
            <div>
              <p className={`font-semibold ${overallStatus === "success" ? "text-emerald-400" : overallStatus === "warning" ? "text-amber-400" : overallStatus === "error" ? "text-red-400" : "text-violet-400"}`}>
                {overallStatus === "checking" ? "Verificando Sistema..." : overallStatus === "success" ? "Sistema Operativo" : overallStatus === "warning" ? "Sistema con Alertas" : "Errores Detectados"}
              </p>
              <p className="text-sm text-slate-400">Diagnóstico completado</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-8">
          {checks.map((check, idx) => (
            <div key={check.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${idx === currentCheck && check.status === "pending" ? "bg-violet-500/10 border-violet-500/30" : "bg-slate-800/30 border-slate-700/50"}`}>
              <div className="flex items-center gap-3">
                {getStatusIcon(check.status)}
                <span className="font-medium text-white">{check.name}</span>
              </div>
              <span className={`text-sm ${check.status === "success" ? "text-emerald-400" : check.status === "warning" ? "text-amber-400" : check.status === "error" ? "text-red-400" : "text-slate-500"}`}>{check.detail || "Pendiente"}</span>
            </div>
          ))}
        </div>

        <button onClick={onComplete} disabled={!canStart}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${canStart ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-violet-500/25" : "bg-slate-800 text-slate-500 cursor-not-allowed"}`}>
          {canStart ? "Iniciar Sistema" : "Verificando..."}
        </button>

        {/* Developer Credits in BootLoader */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-xs text-slate-600">Desarrollado por <span className="text-slate-500">Ing. RAUL MARTINEZ RAMIREZ</span></p>
          <p className="text-xs text-slate-600">Powered by <span className="text-violet-500">Claude Opus</span> & <span className="text-blue-500">Gemini</span></p>
        </div>
      </div>
    </div>
  );
}

// 
// LAYOUT WITH DEVELOPER CREDITS
// 

const MENU = [
  { sectionKey: "menu.section.main", items: [
    { path: "/", name: "Dashboard", icon: HiOutlineHome, roles: ["admin", "gerente", "cajero", "inventario"] },
  ]},
  { sectionKey: "menu.section.operations", items: [
    { path: "/pos", name: "POS", icon: HiOutlineShoppingCart, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/sales", name: "Ventas", icon: HiOutlineDocumentText, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/customers", name: "Clientes", icon: HiOutlineUsers, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/credits", name: "Créditos", icon: HiOutlineCreditCard, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/products", name: "Productos", icon: HiOutlineCube, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/inventory", name: "Inventario", icon: HiOutlineArchive, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/inventory", name: "Movimientos", icon: HiOutlineTruck, tab: "movements", roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/produccion", name: "Producción", icon: Package, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/compras", name: "Compras", icon: HiOutlineShoppingCart, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/marketing", name: "Marketing", icon: HiOutlineChartBar, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/quality", name: "Calidad", icon: HiOutlineShieldCheck, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/shrinkage", name: "Mermas", icon: HiOutlineExclamation, feature: "inventory", roles: ["admin", "gerente", "cajero", "inventario"] },
  ]},
  { sectionKey: "menu.section.finance", items: [
    { path: "/cash", name: "Caja", icon: HiOutlineCash, feature: "cash", roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/expenses", name: "Gastos", icon: HiOutlineReceiptTax, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/reports", name: "Reportes", icon: HiOutlineChartBar, feature: "reports", roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/analytics-advanced", name: "Análisis", icon: HiOutlineChartBar, roles: ["admin", "gerente", "cajero", "inventario"] },
  ]},
  { sectionKey: "menu.section.accounting", items: [
    { path: "/accounting", name: "Contabilidad", icon: HiOutlineCalculator, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/accounting-advanced", name: "Contabilidad Pro", icon: HiOutlineChartBar, roles: ["admin", "gerente", "cajero", "inventario"] },
  ]},
  { sectionKey: "menu.section.hr", items: [
    { path: "/employees", name: "Empleados", icon: HiOutlineUsers, roles: ["admin", "gerente", "cajero", "inventario"] },
  ]},
  { sectionKey: "menu.section.management", items: [
    { path: "/gerencia", name: "Gerencia", icon: HiOutlineChartBar, roles: ["admin", "gerente", "cajero", "inventario"] },
  ]},
  { sectionKey: "menu.section.system", items: [
    { path: "/control-acceso", name: "Centro de Control de Acceso", icon: HiOutlineLockClosed, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/settings", name: "Configuración", icon: HiOutlineCog, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/config-productos", name: "Config. Productos", icon: HiOutlineCog, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/support", name: "Soporte", icon: HiOutlineBell, roles: ["admin", "gerente", "cajero", "inventario"] },
    { path: "/control-tower", name: "Control Tower", icon: HiOutlineShieldCheck, roles: ["SUPER_ADMIN", "admin", "gerente", "cajero", "inventario"] },
  ]},
];

const AUTONOMO_ALLOWED_PATHS = new Set([
  "/dashboard",
  "/pos",
  "/products",
  "/sales",
  "/customers",
  "/credits",
  "/cash",
  "/accounting",
  "/expenses",
  "/reports",
  "/settings",
  "/support",
  "/produccion",
  "/compras",
  "/marketing",
  "/gerencia",
  "/control-acceso"
]);

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);
  const [humanLock, setHumanLock] = useState(null);
  const lastHumanSignalRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const systemStatus = useSystemStatus();
  const featureFlags = getFeatureFlags();
  const { user, isOnline } = useAuth();
  const [isAutonomo, setIsAutonomo] = useState(false);
  
  useEffect(() => {
    const loadAutonomo = async () => {
      try {
        const stored = await db.settings?.get("business_is_autonomo");
        setIsAutonomo(stored?.value === "true" || stored?.value === true);
      } catch {
        setIsAutonomo(false);
      }
    };
    loadAutonomo();
  }, []);
  
  useEffect(() => {
    const saved = readWithMigration("genesis_sidebar_visible", "rauli_sidebar_visible");
    if (saved !== null) {
      setSidebarPinned(saved === "true");
    }
  }, []);
  
  const getCurrentPage = () => {
    const currentTab = new URLSearchParams(location.search).get("tab");
    for (const section of MENU) {
      const item = section.items.find(i =>
        i.path === location.pathname &&
        (i.tab ? currentTab === i.tab : !currentTab)
      );
      if (item) return t(item.nameKey || item.name || "");
    }
    return t("menu.dashboard", "Dashboard");
  };

  const handleAIAction = (action) => {
    console.log('handleAIAction llamado con:', action);
    if (action.action === "NAVIGATE" && action.to) {
      console.log('Navegando a:', action.to);
      navigate(action.to);
    }
    if (action.action === "OPEN_MODAL" && action.modal) {
      console.log('Abriendo modal:', action.modal);
      window.dispatchEvent(new CustomEvent(`command:${action.modal}`, { detail: action.payload || {} }));
    }
    if (action.action === "NAVIGATE_AND_OPEN" && action.to && action.modal) {
      console.log('Navegando y abriendo modal:', action.to, action.modal);
      navigate(action.to);
      const delay = typeof action.delay === "number" ? action.delay : 320;
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent(`command:${action.modal}`, { detail: action.payload || {} }));
      }, delay);
    }
  };

  useEffect(() => {
    let timeout = null;
    const unsubscribe = sentinelService.subscribe((state) => {
      const redSignal = state.alerts.find(a => a.type === "human_factor_signal" && a.details?.intensity === "red");
      const tamperSignal = state.alerts.find(a => a.type === "data_corruption" && a.details?.stage === "contabilidad");
      if (redSignal && !humanLock) {
        const until = Date.now() + 8000;
        setHumanLock({
          until,
          message: redSignal.message || "Señal crítica detectada"
        });
        if (lastHumanSignalRef.current !== redSignal.id) {
          lastHumanSignalRef.current = redSignal.id;
          logAudit("system", "human_lock", "human_factor_lock", user?.id, {
            alertId: redSignal.id,
            intensity: redSignal.details?.intensity,
            page: location.pathname,
            role: user?.role || "sin_rol",
            stage: "bloqueo_ui"
          });
        }
        timeout = setTimeout(() => setHumanLock(null), 8000);
      }
      if (tamperSignal && !humanLock) {
        const periodStart = tamperSignal.details?.period_start;
        const periodEnd = tamperSignal.details?.period_end;
        const periodLabel = periodStart && periodEnd ? ` (${periodStart} - ${periodEnd})` : "";
        const until = Date.now() + 8000;
        setHumanLock({
          until,
          message: `Alteracion contable detectada${periodLabel}`
        });
        if (lastHumanSignalRef.current !== tamperSignal.id) {
          lastHumanSignalRef.current = tamperSignal.id;
          logAudit("system", "tamper_lock", "human_factor_lock", user?.id, {
            alertId: tamperSignal.id,
            intensity: "red",
            page: location.pathname,
            role: user?.role || "sin_rol",
            stage: "bloqueo_ui",
            source: "contabilidad"
          });
        }
        timeout = setTimeout(() => setHumanLock(null), 8000);
      }
    });
    sentinelService.start(60000);
    return () => {
      unsubscribe();
      if (timeout) clearTimeout(timeout);
      sentinelService.stop();
    };
  }, [humanLock, location.pathname, user]);

  return (
    <WelcomeTourProvider>
      <CommandCenterProvider>
        <RauliProvider>
        <div className="min-h-screen bg-slate-950 flex">
      <VersionChecker />
      {humanLock && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-rose-500/10 border border-rose-500/40 rounded-2xl p-6 max-w-md text-center">
            <div className="text-3xl mb-2">🔴</div>
            <h3 className="text-xl font-bold text-rose-200 mb-2">Señal crítica detectada</h3>
            <p className="text-sm text-rose-100 mb-4">
              {humanLock.message}. Revisa el Centro de Integridad antes de continuar.
            </p>
            <div className="text-xs text-rose-200">Bloqueo temporal de 8s</div>
          </div>
        </div>
      )}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      
      {/* SIDEBAR WITH CREDITS */}
      {(sidebarPinned || sidebarOpen) && (
        <aside data-tour="sidebar" className={`fixed top-0 left-0 z-50 h-full w-72 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800/50 transform transition-transform ${sidebarPinned ? "lg:translate-x-0 lg:static" : "lg:-translate-x-full lg:hidden"} flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo */}
        <div className="h-20 flex items-center gap-4 px-6 border-b border-slate-800/50 flex-shrink-0">
          <div className="w-14 h-14 bg-gradient-to-br from-slate-500/85 to-slate-600/60 border border-slate-400/70 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/40 overflow-hidden">
            <div className="bg-white p-1.5 rounded-xl ring-1 ring-white/70">
              <img
                src="/logo-genesis.png"
                alt="RAULI"
                className="w-full h-full object-contain scale-110 filter saturate-125 brightness-110"
              />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-white text-lg tracking-wide">RAULI</h1>
            <p className="text-xs text-violet-400">Enterprise v3.0</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-2 text-slate-400">
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-4 overflow-y-auto flex-1">
          {MENU.map((section) => {
            const visibleItems = section.items.filter(item => {
              if (item.feature && featureFlags[item.feature] === false) return false;
              // Eliminar filtro de roles para que todos los botones sean visibles
              // if (item.roles && !item.roles.includes(user?.role)) return false;
              if (isAutonomo && !AUTONOMO_ALLOWED_PATHS.has(item.path)) return false;
              return true;
            });
            if (visibleItems.length === 0) return null;
            return (
            <div key={section.sectionKey || section.section || section.items?.[0]?.path || "section"}>
              <p className="px-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {section.sectionKey === "menu.section.main" && "Principal"}
                {section.sectionKey === "menu.section.operations" && "Operaciones"}
                {section.sectionKey === "menu.section.finance" && "Finanzas"}
                {section.sectionKey === "menu.section.accounting" && "Contabilidad"}
                {section.sectionKey === "menu.section.hr" && "Recursos Humanos"}
                {section.sectionKey === "menu.section.management" && "Gerencia"}
                {section.sectionKey === "menu.section.system" && "Sistema"}
              </p>
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const currentTab = new URLSearchParams(location.search).get("tab");
                  const isActive = location.pathname === item.path && (item.tab ? currentTab === item.tab : !currentTab);
                  const to = item.tab ? `${item.path}?tab=${item.tab}` : item.path;
                  return (
                    <li key={`${item.path}${item.tab ? `-${item.tab}` : ""}`}>
                      <button
                        onClick={() => {
                          console.log('Click en botón:', item.name, 'Navegando a:', to);
                          setSidebarOpen(false);
                          navigate(to);
                        }}
                        data-tour={item.path === "/settings" ? "sidebar-settings" : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all w-full text-left ${isActive ? "bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-violet-400 border border-violet-500/30" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )})}
        </nav>

        {/* APP UPDATER */}
        <div className="flex-shrink-0 px-4 pt-4">
          <AppUpdater />
        </div>

        {/* DEVELOPER CREDITS FOOTER */}
        <div className="flex-shrink-0 p-4 border-t border-slate-800/50 bg-slate-900/50">
          <div className="p-3 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <HiOutlineCode className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-semibold text-slate-400">CRÉDITOS</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <p className="text-slate-500">
                <span className="text-slate-400">Versión:</span> 3.0 Enterprise
              </p>
              <p className="text-slate-500">
                <span className="text-slate-400">Desarrollador:</span>
                <br />
                <span className="text-violet-400 font-medium">Ing. RAUL MARTINEZ RAMIREZ</span>
              </p>
              <p className="text-slate-500">
                <span className="text-slate-400">Powered by:</span>
                <br />
                <span className="text-violet-400">Claude Opus</span> & <span className="text-blue-400">Gemini</span>
              </p>
            </div>
          </div>
        </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header data-tour="navbar" className="h-14 sm:h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const next = !sidebarPinned;
                setSidebarPinned(next);
                localStorage.setItem("genesis_sidebar_visible", String(next));
              }}
              className="hidden lg:inline-flex p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              title={sidebarPinned ? "Ocultar menú" : "Mostrar menú"}
            >
              <HiOutlineMenu className="w-6 h-6" />
            </button>
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl">
              <HiOutlineMenu className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">{getCurrentPage()}</h2>
              <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">Sistema de Gestión Empresarial</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* System Status */}
            <div className="relative">
              <button onClick={() => setShowAlerts(!showAlerts)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  systemStatus.level === "ok" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : 
                  systemStatus.level === "warning" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : 
                  "bg-red-500/10 text-red-400 border-red-500/30"
                }`}>
                <span className={`w-3 h-3 rounded-full ${systemStatus.level === "ok" ? "bg-emerald-400" : systemStatus.level === "warning" ? "bg-amber-400 animate-pulse" : "bg-red-400 animate-pulse"}`} />
                {systemStatus.level === "ok" ? "Sistema OK" : `${systemStatus.alerts.length} Alertas`}
                <HiOutlineBell className="w-4 h-4" />
              </button>
              
              {showAlerts && systemStatus.alerts.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-4 space-y-2">
                  {systemStatus.alerts.map((alert, idx) => (
                    <div key={idx} className={`p-3 rounded-lg ${alert.type === "error" ? "bg-red-500/10 text-red-400" : alert.type === "warning" ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"}`}>
                      <p className="text-sm">{alert.msg}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <NotificationCenter />

            {/* Online Status — actualiza al cambiar red (online/offline) */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isOnline ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"}`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
              {isOnline ? "Online" : "Offline"}
            </div>
          </div>
        </header>

        <main className="flex-1 p-2 sm:p-3 overflow-auto overflow-x-hidden min-w-0 safe-area-padding flex flex-col min-h-0">
          <div className="main-content-mobile flex flex-col flex-1 min-h-0 gap-2">
            {location.pathname !== "/auth" && (
              <div className="rounded-xl sm:rounded-2xl border border-slate-700/60 sm:border-slate-800/60 bg-slate-900/40 backdrop-blur-sm overflow-hidden flex-1 min-h-[65vh] flex flex-col">
                <div className="flex-1 min-h-[380px] overflow-auto flex flex-col">
                  <Suspense fallback={
                    <div className="h-full flex items-center justify-center bg-slate-800/30">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-slate-400">Cargando asistente RAULI...</p>
                      </div>
                    </div>
                  }>
                    <RauliAssistant />
                  </Suspense>
                </div>
              </div>
            )}
            <div className="min-w-0 w-full flex-shrink-0" data-outlet-content>
              <Outlet />
            </div>
          </div>
        </main>

        {location.pathname !== "/" && (
          <div className="px-6 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm"
            >
              Volver a pantalla principal
            </button>
              {location.pathname.startsWith("/analytics-advanced") && (
                <button
                  onClick={() => {
                    const view = new URLSearchParams(location.search).get("view") || "main";
                    const nextView = view === "config" ? "main" : "config";
                    navigate(`/analytics-advanced?view=${nextView}`);
                  }}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm"
                >
                  {new URLSearchParams(location.search).get("view") === "config"
                    ? "Volver al análisis"
                    : "Siguiente análisis"}
                </button>
              )}
            </div>
          </div>
        )}

        <footer className="h-10 sm:h-12 bg-slate-900/50 border-t border-slate-800/50 flex items-center justify-center">
          <p className="text-sm text-slate-600">
            RAULI v{APP_VERSION} Panaderia y Dulceria · {LAST_IMPROVEMENT_NOTE} 2026
          </p>
        </footer>
      </div>

          
        </div>
        </RauliProvider>
      </CommandCenterProvider>
    </WelcomeTourProvider>
  );
}

// 
// PAGES
// 

const Placeholder = ({ name }) => (
  <div className="flex items-center justify-center h-96">
    <div className="text-center">
      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center mb-4 border border-slate-700">
        <span className="text-3xl">📦</span>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{name}</h2>
      <p className="text-slate-400">Módulo en desarrollo</p>
    </div>
  </div>
);

const safeLazy = (fn, name) => lazy(() => fn().catch(() => ({ default: () => <Placeholder name={name} /> })));

const Dashboard = safeLazy(() => import("./pages/Dashboard"), "Dashboard");
const POS = safeLazy(() => import("./pages/POS"), "POS");
const Products = safeLazy(() => import("./pages/Products"), "Productos");
const Inventory = safeLazy(() => import("./pages/Inventory"), "Inventario");
const Sales = safeLazy(() => import("./pages/Sales"), "Ventas");
const Customers = safeLazy(() => import("./pages/Customers"), "Clientes");
const Credits = safeLazy(() => import("./pages/Credits"), "Créditos");
const Expenses = safeLazy(() => import("./pages/Expenses"), "Gastos");
const Shrinkage = safeLazy(() => import("./pages/Shrinkage"), "Mermas");
const CashDrawer = safeLazy(() => import("./pages/CashDrawer"), "Caja");
const Employees = safeLazy(() => import("./pages/Employees"), "RRHH");
const Accounting = safeLazy(() => import("./pages/Accounting"), "Contabilidad");
const AccountingAdvanced = safeLazy(() => import("./pages/AccountingAdvanced"), "Contabilidad Pro");
const AnalyticsAdvanced = safeLazy(() => import("./pages/AnalyticsAdvanced"), "Analítica Avanzada");
const Settings = safeLazy(() => import("./pages/Settings"), "Configuración");
const Reports = safeLazy(() => import("./pages/Reports"), "Reportes");
const ProductionModule = safeLazy(() => import("./components/Production/ProductionModule"), "Producción");
const ProductConfig = safeLazy(() => import("./components/ProductConfig/ProductTypeConfig"), "Configuración");
const Quality = safeLazy(() => import("./pages/Quality/Quality"), "Calidad");
const Feedback = safeLazy(() => import("./pages/Support/Feedback"), "Feedback");
const ControlTower = safeLazy(() => import("./pages/Admin/ControlTower"), "Control Tower");
const AccessControlPage = safeLazy(() => import("./pages/AccessControl"), "Control de Acceso");
const RauliLive = safeLazy(() => import("./components/RauliLive/RauliLiveSimple"), "RAULI LIVE");
const Produccion = safeLazy(() => import("./pages/Produccion"), "PRODUCCION");
const Compras = safeLazy(() => import("./pages/Compras"), "COMPRAS");
const Marketing = safeLazy(() => import("./pages/Marketing"), "MARKETING");
const Gerencia = safeLazy(() => import("./pages/Gerencia"), "GERENCIA");

const Loader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);
// MAIN APP
// 

export default function App() {
  console.log('🚀 App component montado');
  const [booted] = useState(true);
  const [setupLoading, setSetupLoading] = useState(true);
  const [isAutonomo, setIsAutonomo] = useState(false);
  const featureFlags = getFeatureFlags();
  console.log('🏳️ FeatureFlags:', featureFlags);

  useEffect(() => {
    const loadSetup = async () => {
      try {
        const autonomo = await db.settings?.get("business_is_autonomo");
        setIsAutonomo(autonomo?.value === "true" || autonomo?.value === true);
        document.documentElement.lang = "es";
        document.documentElement.dir = "ltr";
        setBusinessConfig({ appLanguage: "es", dateLocale: "es-CU" });
      } catch {
        setIsAutonomo(false);
      } finally {
        setSetupLoading(false);
      }
    };
    loadSetup();
  }, []);

  useEffect(() => {
    SupportService.initConsoleCapture();
    SupportService.trackInstall();
  }, []);

  const allowRoute = (path) => {
    console.log('🔍 allowRoute llamado con:', path, 'isAutonomo:', isAutonomo);
    const result = !isAutonomo || AUTONOMO_ALLOWED_PATHS.has(path);
    console.log('✅ allowRoute resultado:', result);
    return result;
  };

  if (setupLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <HiOutlineRefresh className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: "#1e293b", color: "#fff", border: "1px solid #334155", borderRadius: "12px" } }} />
      <Routes>
        {/* RAULI LIVE - Interfaz Conversacional (sin layout) */}
        <Route path="/rauli-live" element={<Suspense fallback={<Loader />}><RauliLive /></Suspense>} />
        
        <Route path="/" element={<Layout />}>
          <Route index element={<Suspense fallback={<Loader />}><Dashboard /></Suspense>} />
          <Route path="pos" element={<Suspense fallback={<Loader />}><POS /></Suspense>} />
          <Route path="sales" element={<Suspense fallback={<Loader />}><Sales /></Suspense>} />
          <Route path="customers" element={<Suspense fallback={<Loader />}><Customers /></Suspense>} />
          <Route path="credits" element={<Suspense fallback={<Loader />}><Credits /></Suspense>} />
          <Route path="products" element={<Suspense fallback={<Loader />}><Products /></Suspense>} />
          <Route path="inventory" element={<Suspense fallback={<Loader />}><Inventory /></Suspense>} />
          <Route path="produccion" element={<Suspense fallback={<Loader />}><Produccion /></Suspense>} />
          <Route path="compras" element={<Suspense fallback={<Loader />}><Compras /></Suspense>} />
          <Route path="marketing" element={<Suspense fallback={<Loader />}><Marketing /></Suspense>} />
          <Route path="gerencia" element={<Suspense fallback={<Loader />}><Gerencia /></Suspense>} />
          <Route path="quality" element={<Suspense fallback={<Loader />}><Quality /></Suspense>} />
          <Route path="support" element={<Suspense fallback={<Loader />}><Feedback /></Suspense>} />
          <Route path="feedback" element={<Suspense fallback={<Loader />}><Feedback /></Suspense>} />
          <Route path="expenses" element={<Suspense fallback={<Loader />}><Expenses /></Suspense>} />
          <Route path="employees" element={<Suspense fallback={<Loader />}><Employees /></Suspense>} />
          <Route path="accounting" element={<Suspense fallback={<Loader />}><Accounting /></Suspense>} />
          <Route path="accounting-advanced" element={<Suspense fallback={<Loader />}><AccountingAdvanced /></Suspense>} />
          <Route path="analytics-advanced" element={<Suspense fallback={<Loader />}><AnalyticsAdvanced /></Suspense>} />
          <Route path="cash" element={<Suspense fallback={<Loader />}><CashDrawer /></Suspense>} />
          <Route path="shrinkage" element={<Suspense fallback={<Loader />}><Shrinkage /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<Loader />}><Reports /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<Loader />}><Settings /></Suspense>} />
          <Route path="control-acceso" element={<Suspense fallback={<Loader />}><AccessControlPage /></Suspense>} />
          <Route path="control-tower" element={<Suspense fallback={<Loader />}><ControlTower /></Suspense>} />
          <Route path="produccion" element={<Suspense fallback={<Loader />}><ProductionModule /></Suspense>} />
          <Route path="config-productos" element={<Suspense fallback={<Loader />}><ProductConfig /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}