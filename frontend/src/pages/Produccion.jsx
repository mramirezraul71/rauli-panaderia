import React, { useState, useEffect } from 'react';
import { HiOutlineCube, HiOutlinePlus, HiOutlineMinus, HiOutlineClock, HiOutlineFire, HiOutlineCheckCircle, HiOutlineExclamation } from 'react-icons/hi';

export default function Produccion() {
  const [recetas, setRecetas] = useState([]);
  const [produccionActiva, setProduccionActiva] = useState([]);

  useEffect(() => {
    // Cargar recetas de producción
    const loadRecetas = async () => {
      try {
        // Datos de ejemplo para panadería
        setRecetas([
          { id: 1, nombre: 'Pan Francés', tiempo: 2, cantidad: 50, estado: 'en_proceso' },
          { id: 2, nombre: 'Croissants', tiempo: 3, cantidad: 30, estado: 'pendiente' },
          { id: 3, nombre: 'Pan Dulce', tiempo: 1.5, cantidad: 40, estado: 'completado' }
        ]);
      } catch (error) {
        console.error('Error cargando recetas:', error);
      }
    };
    loadRecetas();
  }, []);

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'en_proceso': return <HiOutlineFire className="w-5 h-5 text-orange-400" />;
      case 'completado': return <HiOutlineCheckCircle className="w-5 h-5 text-green-400" />;
      default: return <HiOutlineClock className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Producción</h1>
        <p className="text-slate-400">Control de producción de panadería</p>
      </div>

      {/* Resumen de producción */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineFire className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-semibold text-white">En Proceso</h3>
          </div>
          <p className="text-3xl font-bold text-orange-400">2</p>
          <p className="text-slate-400 text-sm mt-1">Producciones activas</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineCheckCircle className="w-6 h-6 text-green-500" />
            <h3 className="text-lg font-semibold text-white">Completado</h3>
          </div>
          <p className="text-3xl font-bold text-green-400">1</p>
          <p className="text-slate-400 text-sm mt-1">Hoy</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineClock className="w-6 h-6 text-blue-500" />
            <h3 className="text-lg font-semibold text-white">Pendiente</h3>
          </div>
          <p className="text-3xl font-bold text-blue-400">1</p>
          <p className="text-slate-400 text-sm mt-1">En cola</p>
        </div>
      </div>

      {/* Lista de recetas */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Recetas de Producción</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {recetas.map((receta) => (
              <div key={receta.id} className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <HiOutlineCube className="w-8 h-8 text-violet-500" />
                    <div>
                      <h3 className="text-lg font-medium text-white">{receta.nombre}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-slate-400">
                          <HiOutlineClock className="w-4 h-4 inline mr-1" />
                          {receta.tierra}h
                        </span>
                        <span className="text-sm text-slate-400">
                          Cantidad: {receta.cantidad} unidades
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getEstadoIcon(receta.estado)}
                    <div className="flex gap-2">
                      <button className="p-2 bg-slate-600 rounded-lg hover:bg-slate-500 transition-colors">
                        <HiOutlinePlus className="w-4 h-4 text-white" />
                      </button>
                      <button className="p-2 bg-slate-600 rounded-lg hover:bg-slate-500 transition-colors">
                        <HiOutlineMinus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Botón de nueva producción */}
      <div className="mt-6">
        <button className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg font-medium hover:from-violet-500 hover:to-indigo-500 transition-all">
          Nueva Producción
        </button>
      </div>
    </div>
  );
}
