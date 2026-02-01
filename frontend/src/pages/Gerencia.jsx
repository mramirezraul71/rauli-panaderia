import React, { useState, useEffect } from 'react';
import { HiOutlineChartBar, HiOutlineUsers, HiOutlineShoppingCart, HiOutlineCash, HiOutlineTrendingUp, HiOutlineCalendar, HiOutlineDocumentText, HiOutlineCube } from 'react-icons/hi';

export default function Gerencia() {
  const [stats, setStats] = useState({
    totalVentas: 0,
    totalClientes: 0,
    totalProductos: 0,
    cajaActual: 0,
    crecimiento: 0
  });

  useEffect(() => {
    // Cargar estadísticas desde la base de datos
    const loadStats = async () => {
      try {
        // Aquí irían las llamadas a la base de datos
        setStats({
          totalVentas: 125430,
          totalClientes: 48,
          totalProductos: 156,
          cajaActual: 45320,
          crecimiento: 12.5
        });
      } catch (error) {
        console.error('Error cargando estadísticas:', error);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Gerencia</h1>
        <p className="text-slate-400">Panel de control administrativo</p>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <HiOutlineShoppingCart className="w-8 h-8 text-violet-500" />
            <span className="text-sm text-green-400">+12.5%</span>
          </div>
          <h3 className="text-2xl font-bold text-white">${stats.totalVentas.toLocaleString()}</h3>
          <p className="text-slate-400 text-sm mt-1">Ventas totales</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <HiOutlineUsers className="w-8 h-8 text-blue-500" />
            <span className="text-sm text-green-400">+8.2%</span>
          </div>
          <h3 className="text-2xl font-bold text-white">{stats.totalClientes}</h3>
          <p className="text-slate-400 text-sm mt-1">Clientes activos</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <HiOutlineCube className="w-8 h-8 text-green-500" />
            <span className="text-sm text-yellow-400">+2.1%</span>
          </div>
          <h3 className="text-2xl font-bold text-white">{stats.totalProductos}</h3>
          <p className="text-slate-400 text-sm mt-1">Productos</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <HiOutlineCash className="w-8 h-8 text-emerald-500" />
            <span className="text-sm text-green-400">+15.3%</span>
          </div>
          <h3 className="text-2xl font-bold text-white">${stats.cajaActual.toLocaleString()}</h3>
          <p className="text-slate-400 text-sm mt-1">Caja actual</p>
        </div>
      </div>

      {/* Secciones de gestión */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reportes rápidos */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <HiOutlineDocumentText className="w-6 h-6 text-violet-500" />
            <h2 className="text-xl font-semibold text-white">Reportes Rápidos</h2>
          </div>
          <div className="space-y-3">
            <button className="w-full text-left p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-white">Ventas del día</span>
                <HiOutlineTrendingUp className="w-4 h-4 text-green-400" />
              </div>
            </button>
            <button className="w-full text-left p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-white">Inventario crítico</span>
                <HiOutlineChartBar className="w-4 h-4 text-yellow-400" />
              </div>
            </button>
            <button className="w-full text-left p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-white">Cuentas por cobrar</span>
                <HiOutlineCash className="w-4 h-4 text-red-400" />
              </div>
            </button>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <HiOutlineCalendar className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">Acciones Rápidas</h2>
          </div>
          <div className="space-y-3">
            <button className="w-full text-left p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-white">Cierre de caja</span>
                <HiOutlineCash className="w-4 h-4 text-emerald-400" />
              </div>
            </button>
            <button className="w-full text-left p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-white">Backup de datos</span>
                <HiOutlineDocumentText className="w-4 h-4 text-blue-400" />
              </div>
            </button>
            <button className="w-full text-left p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-white">Generar reporte mensual</span>
                <HiOutlineChartBar className="w-4 h-4 text-violet-400" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
