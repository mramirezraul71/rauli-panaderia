import React, { useState, useEffect } from 'react';
import { HiOutlineShoppingCart, HiOutlinePlus, HiOutlineTruck, HiOutlineCalendar, HiOutlineDocumentText, HiOutlineCheckCircle, HiOutlineClock } from 'react-icons/hi';

export default function Compras() {
  console.log('🛒 Componente Compras montado');
  const [ordenes, setOrdenes] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  useEffect(() => {
    console.log('📦 Cargando órdenes de compra...');
    // Cargar órdenes de compra
    const loadOrdenes = async () => {
      try {
        // Datos de ejemplo
        setOrdenes([
          { 
            id: 1, 
            proveedor: 'Harina San Carlos', 
            producto: 'Harina de Trigo', 
            cantidad: 50, 
            monto: 2500, 
            estado: 'pendiente',
            fecha: '2024-01-31'
          },
          { 
            id: 2, 
            proveedor: 'Distribuidora Láctea', 
            producto: 'Leche', 
            cantidad: 100, 
            monto: 800, 
            estado: 'recibido',
            fecha: '2024-01-30'
          },
          { 
            id: 3, 
            proveedor: 'Azucarera Central', 
            producto: 'Azúcar', 
            cantidad: 75, 
            monto: 1200, 
            estado: 'en_transito',
            fecha: '2024-01-29'
          }
        ]);
      } catch (error) {
        console.error('Error cargando órdenes:', error);
      }
    };
    loadOrdenes();
  }, []);

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'recibido': return <HiOutlineCheckCircle className="w-5 h-5 text-green-400" />;
      case 'en_transito': return <HiOutlineTruck className="w-5 h-5 text-blue-400" />;
      default: return <HiOutlineClock className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'recibido': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'en_transito': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Compras</h1>
        <p className="text-slate-400">Gestión de órdenes de compra y proveedores</p>
      </div>

      {/* Resumen de compras */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineClock className="w-6 h-6 text-yellow-500" />
            <h3 className="text-lg font-semibold text-white">Pendientes</h3>
          </div>
          <p className="text-3xl font-bold text-yellow-400">1</p>
          <p className="text-slate-400 text-sm mt-1">Órdenes</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineTruck className="w-6 h-6 text-blue-500" />
            <h3 className="text-lg font-semibold text-white">En Tránsito</h3>
          </div>
          <p className="text-3xl font-bold text-blue-400">1</p>
          <p className="text-slate-400 text-sm mt-1">Órdenes</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineCheckCircle className="w-6 h-6 text-green-500" />
            <h3 className="text-lg font-semibold text-white">Recibidas</h3>
          </div>
          <p className="text-3xl font-bold text-green-400">1</p>
          <p className="text-slate-400 text-sm mt-1">Hoy</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineShoppingCart className="w-6 h-6 text-violet-500" />
            <h3 className="text-lg font-semibold text-white">Total</h3>
          </div>
          <p className="text-3xl font-bold text-violet-400">$4,500</p>
          <p className="text-slate-400 text-sm mt-1">En compras</p>
        </div>
      </div>

      {/* Lista de órdenes */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Órdenes de Compra</h2>
          <button className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg font-medium hover:from-violet-500 hover:to-indigo-500 transition-all flex items-center gap-2">
            <HiOutlinePlus className="w-4 h-4" />
            Nueva Orden
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {ordenes.map((orden) => (
              <div key={orden.id} className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <HiOutlineShoppingCart className="w-8 h-8 text-violet-500" />
                    <div>
                      <h3 className="text-lg font-medium text-white">{orden.producto}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-slate-400">
                          Proveedor: {orden.proveedor}
                        </span>
                        <span className="text-sm text-slate-400">
                          Cantidad: {orden.cantidad} unidades
                        </span>
                        <span className="text-sm text-slate-400">
                          Monto: ${orden.monto.toLocaleString()}
                        </span>
                        <span className="text-sm text-slate-400">
                          <HiOutlineCalendar className="w-4 h-4 inline mr-1" />
                          {orden.fecha}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getEstadoBadge(orden.estado)}`}>
                      {orden.estado.replace('_', ' ')}
                    </span>
                    {getEstadoIcon(orden.estado)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
