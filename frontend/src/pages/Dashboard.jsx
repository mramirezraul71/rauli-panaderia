import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  Package, 
  Users, 
  TrendingUp, 
  DollarSign,
  ChefHat,
  BarChart3,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState({
    ventasHoy: 0,
    productosActivos: 0,
    ordenesProduccion: 0,
    clientesRegistrados: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Intentar cargar desde el backend
      const [productsRes, ordersRes] = await Promise.allSettled([
        fetch('https://rauli-panaderia-1.onrender.com/api/products'),
        fetch('https://rauli-panaderia-1.onrender.com/api/production/production-orders')
      ]);
      
      const products = productsRes.status === 'fulfilled' && productsRes.value.ok 
        ? await productsRes.value.json() 
        : [];
      const orders = ordersRes.status === 'fulfilled' && ordersRes.value.ok 
        ? await ordersRes.value.json() 
        : [];

      setStats({
        ventasHoy: Math.floor(Math.random() * 50) + 10, // Simular ventas
        productosActivos: Array.isArray(products) ? products.length : 0,
        ordenesProduccion: Array.isArray(orders) ? orders.length : 0,
        clientesRegistrados: 12 // Placeholder
      });
    } catch (error) {
      console.warn('Error cargando stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { icon: ShoppingCart, label: 'POS', route: '/pos', color: 'from-emerald-500 to-emerald-600' },
    { icon: Package, label: 'Inventario', route: '/inventory', color: 'from-[#1e3a5f] to-[#2a4a7f]' },
    { icon: ChefHat, label: 'Produccion', route: '/produccion', color: 'from-[#d4814b] to-[#c47142]' },
    { icon: Users, label: 'Empleados', route: '/employees', color: 'from-[#1e3a5f] to-[#2a4a7f]' },
    { icon: BarChart3, label: 'Reportes', route: '/reports', color: 'from-[#d4814b] to-[#c47142]' },
    { icon: Settings, label: 'Ajustes', route: '/settings', color: 'from-slate-600 to-slate-700' },
  ];

  const statCards = [
    { label: 'Ventas Hoy', value: stats.ventasHoy, icon: DollarSign, color: 'text-emerald-400' },
    { label: 'Productos', value: stats.productosActivos, icon: Package, color: 'text-blue-400' },
    { label: 'Ordenes', value: stats.ordenesProduccion, icon: ChefHat, color: 'text-amber-400' },
    { label: 'Clientes', value: stats.clientesRegistrados, icon: Users, color: 'text-purple-400' },
  ];

  const greeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Buenos dias';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('es-MX', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 min-w-0 overflow-x-hidden box-border">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">{greeting()}</h1>
          <p className="text-xs sm:text-sm text-slate-400 capitalize truncate">{formatDate()}</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button 
            onClick={loadStats}
            className="p-1.5 sm:p-2 rounded-full bg-slate-800/50 text-slate-400 hover:text-white transition-colors touch-manipulation"
            disabled={loading}
            aria-label="Actualizar datos"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className={`p-1.5 sm:p-2 rounded-full ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          </div>
        </div>
      </div>

      {/* Stats Grid - 2x2 en móvil, 4 columnas en desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4 min-w-0">
        {statCards.map((stat, idx) => (
          <div 
            key={idx}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-slate-700/50 hover:border-[#d4814b]/30 transition-colors min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <stat.icon size={18} className={stat.color} />
              <TrendingUp size={14} className="text-emerald-400" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">
              {loading ? '-' : stat.value}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions - 3 columnas móvil, 6 columnas desktop */}
      <div className="mb-3 sm:mb-4">
        <h2 className="text-sm sm:text-base font-semibold text-slate-300 mb-2 sm:mb-3">Acceso Rápido</h2>
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => navigate(action.route)}
              className={`bg-gradient-to-br ${action.color} rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center gap-1 sm:gap-2 active:scale-95 hover:scale-105 transition-transform shadow-lg touch-manipulation min-h-[80px] sm:min-h-[100px]`}
              aria-label={action.label}
            >
              <action.icon size={24} className="text-white" />
              <span className="text-[10px] sm:text-xs font-medium text-white/90 text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-slate-700/30">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <p className="text-xs sm:text-sm text-slate-400">
            {isOnline 
              ? 'Conectado a RAULI Cloud' 
              : 'Modo offline - Los cambios se sincronizarán'
            }
          </p>
        </div>
        <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
          Backend: rauli-panaderia-1.onrender.com
        </p>
      </div>

      {/* RAULI Assistant hint - solo móvil */}
      <div className="mt-3 sm:mt-4 text-center lg:hidden">
        <p className="text-[10px] text-slate-600">
          Toca el menú para acceder a más opciones
        </p>
      </div>
    </div>
  );
}
