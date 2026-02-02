import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { APP_VERSION } from '../config/version';
import { HiOutlineHome, HiOutlineShoppingCart, HiOutlineDocumentText, HiOutlineCube, HiOutlineUsers, HiOutlineCreditCard, HiOutlineCash, HiOutlineReceiptTax, HiOutlineExclamation, HiOutlineChartBar, HiOutlineCog, HiOutlineMenu, HiOutlineX, HiOutlineAnnotation } from 'react-icons/hi';

const MENU_SECTIONS = [
  { title: 'Principal', items: [
    { path: '/', name: 'Dashboard', icon: HiOutlineHome },
    { path: '/pos', name: 'Punto de Venta', icon: HiOutlineShoppingCart },
  ]},
  { title: 'Operaciones', items: [
    { path: '/sales', name: 'Ventas', icon: HiOutlineDocumentText },
    { path: '/products', name: 'Productos', icon: HiOutlineCube },
    { path: '/customers', name: 'Clientes', icon: HiOutlineUsers },
    { path: '/credits', name: 'Creditos', icon: HiOutlineCreditCard },
  ]},
  { title: 'Finanzas', items: [
    { path: '/cash', name: 'Caja', icon: HiOutlineCash },
    { path: '/expenses', name: 'Gastos', icon: HiOutlineReceiptTax },
    { path: '/shrinkage', name: 'Mermas', icon: HiOutlineExclamation },
    { path: '/reports', name: 'Reportes', icon: HiOutlineChartBar },
  ]},
  { title: 'Sistema', items: [
    { path: '/settings', name: 'Configuracion', icon: HiOutlineCog },
    { path: '/feedback', name: 'Feedback & Soporte', icon: HiOutlineAnnotation },
  ]}
];

function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 lg:translate-x-0 lg:static ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#d4814b] to-[#c47142] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl font-bold text-white">R</span>
            </div>
            <div>
              <h1 className="font-bold text-white tracking-wide">RAULI</h1>
              <p className="text-xs text-[#d4814b]">Panadería & Dulcería</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white">
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4 space-y-6 overflow-y-auto h-[calc(100%-4rem)]">
          {MENU_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{section.title}</p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={item.path}>
                      <NavLink to={item.path} onClick={onClose} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive ? 'bg-[#d4814b]/20 text-[#d4814b] border-l-2 border-[#d4814b]' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default function MainLayout({ bootReport }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const getCurrentTitle = () => {
    for (const section of MENU_SECTIONS) {
      const item = section.items.find(i => i.path === location.pathname);
      if (item) return item.name;
    }
    return 'Dashboard';
  };
  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white">
              <HiOutlineMenu className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-semibold text-white">{getCurrentTitle()}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${navigator.onLine ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
              <span className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-green-400' : 'bg-amber-400'}`} />
              {navigator.onLine ? 'Online' : 'Offline'}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
        <footer className="h-12 bg-slate-900 border-t border-slate-800 flex items-center justify-center">
          <p className="text-xs text-slate-500">RAULI ERP v{APP_VERSION} • Panadería & Dulcería</p>
        </footer>
      </div>
    </div>
  );
}
