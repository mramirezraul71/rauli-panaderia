/**
 * GENESIS - Main Layout
 * Layout principal con sidebar y header
 */

import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  HiOutlineHome,
  HiOutlineShoppingCart,
  HiOutlineCube,
  HiOutlineArchive,
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineCalculator,
  HiOutlineDocumentReport,
  HiOutlineCog,
  HiOutlineLogout,
  HiOutlineMenuAlt2,
  HiOutlineX,
  HiOutlineRefresh,
  HiOutlineWifi,
  HiOutlineStatusOffline,
  HiOutlineCloud,
} from 'react-icons/hi';
import { Package } from 'lucide-react';
import HealthMonitor from '../components/HealthMonitor';
import ActiveCurrencySelector from '../components/ActiveCurrencySelector';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome, roles: ['admin', 'gerente', 'cajero', 'inventario'] },
  { name: 'Punto de Venta', href: '/pos', icon: HiOutlineShoppingCart, roles: ['admin', 'gerente', 'cajero'] },
  { name: 'Productos', href: '/products', icon: HiOutlineCube, roles: ['admin', 'gerente', 'inventario'] },
  { name: 'Producci�n', href: '/produccion', icon: Package, roles: ['admin', 'gerente', 'inventario'] },
  { name: 'Inventario', href: '/inventory', icon: HiOutlineArchive, roles: ['admin', 'gerente', 'inventario'] },
  { name: 'Ventas', href: '/sales', icon: HiOutlineChartBar, roles: ['admin', 'gerente', 'cajero'] },
  { name: 'Cr�ditos (Fiado)', href: '/credits', icon: HiOutlineUsers, roles: ['admin', 'gerente', 'cajero'] },
  { name: 'Empleados', href: '/employees', icon: HiOutlineUsers, roles: ['admin', 'gerente'] },
  { name: 'Contabilidad', href: '/accounting', icon: HiOutlineCalculator, roles: ['admin', 'gerente'] },
  { name: 'Cont. Avanzada', href: '/accounting/advanced', icon: HiOutlineDocumentReport, roles: ['admin', 'gerente'] },
  { name: 'Reportes', href: '/reports', icon: HiOutlineDocumentReport, roles: ['admin', 'gerente'] },
  { name: 'Configuraci�n', href: '/settings', icon: HiOutlineCog, roles: ['admin', 'gerente', 'cajero', 'inventario'] },
];

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { user, logout, isOnline } = useAuth();
  const { syncStatus, pendingCount, syncAll } = useSync();
  const location = useLocation();

  const filteredNav = navigation.filter(item => 
    item.roles.includes(user?.role)
  );

  const handleSync = async () => {
    await syncAll();
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-800/95 backdrop-blur-sm border-r border-slate-700
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-500/85 to-slate-600/60 border border-slate-400/70 flex items-center justify-center overflow-hidden">
              {!logoError ? (
                <div className="bg-white p-1.5 rounded-xl ring-1 ring-white/70">
                  <img
                    src="/logo-genesis.png"
                    alt="GENESIS"
                    className="w-full h-full object-contain scale-110 filter saturate-125 brightness-110"
                    onError={() => setLogoError(true)}
                  />
                </div>
              ) : (
                <span className="text-white font-bold text-lg">G</span>
              )}
            </div>
            <div>
              <h1 className="text-white font-semibold tracking-wide">GENESIS</h1>
              <p className="text-xs text-slate-400">Sistema inteligente</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-white"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${isActive 
                    ? 'bg-indigo-500/20 text-indigo-400 border-l-2 border-indigo-500' 
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }
                `}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-medium">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <HiOutlineLogout className="w-5 h-5" />
            Cerrar sesi�n
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700">
          <div className="flex items-center justify-between h-full px-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white"
            >
              <HiOutlineMenuAlt2 className="w-6 h-6" />
            </button>

            {/* Page title */}
            <h2 className="text-lg font-semibold text-white hidden lg:block">
              {filteredNav.find(item => item.href === location.pathname)?.name || 'GENESIS'}
            </h2>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Health Monitor (Sem�foro) */}
              <HealthMonitor mode="compact" />

              <ActiveCurrencySelector />
              
              {/* Sync status */}
              <button
                onClick={handleSync}
                disabled={syncStatus === 'syncing' || !isOnline}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                  ${pendingCount > 0 
                    ? 'bg-amber-500/20 text-amber-400' 
                    : 'bg-slate-700/50 text-slate-400'
                  }
                  hover:bg-slate-700 transition-colors disabled:opacity-50
                `}
              >
                {syncStatus === 'syncing' ? (
                  <HiOutlineRefresh className="w-4 h-4 animate-spin" />
                ) : (
                  <HiOutlineCloud className="w-4 h-4" />
                )}
                {pendingCount > 0 && <span>{pendingCount}</span>}
              </button>

              {/* Connection status */}
              <div className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                ${isOnline 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/20 text-red-400'
                }
              `}>
                {isOnline ? (
                  <>
                    <HiOutlineWifi className="w-4 h-4" />
                    <span className="hidden sm:inline">Online</span>
                  </>
                ) : (
                  <>
                    <HiOutlineStatusOffline className="w-4 h-4" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}



