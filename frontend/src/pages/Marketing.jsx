import React, { useState, useEffect } from 'react';
import { HiOutlineUsers, HiOutlineChartBar, HiOutlineCalendar, HiOutlinePhotograph, HiOutlineMail, HiOutlineCheckCircle, HiOutlineSpeakerphone, HiOutlineLightningBolt } from 'react-icons/hi';

export default function Marketing() {
  console.log('📢 Componente Marketing montado');
  const [campañas, setCampañas] = useState([]);
  const [estadisticas, setEstadisticas] = useState({
    alcance: 0,
    interacciones: 0,
    conversiones: 0,
    clientesNuevos: 0
  });

  useEffect(() => {
    console.log('📈 Cargando campañas de marketing...');
    // Cargar campañas de marketing
    const loadCampañas = async () => {
      try {
        // Datos de ejemplo para panadería
        setCampañas([
          {
            id: 1,
            nombre: 'Promoción de Pan Fresco',
            tipo: 'descuento',
            estado: 'activa',
            alcance: 250,
            conversiones: 45,
            fechaInicio: '2024-01-15',
            fechaFin: '2024-02-15'
          },
          {
            id: 2,
            nombre: 'Lanzamiento de Croissants',
            tipo: 'producto_nuevo',
            estado: 'completada',
            alcance: 180,
            conversiones: 32,
            fechaInicio: '2024-01-01',
            fechaFin: '2024-01-31'
          },
          {
            id: 3,
            nombre: 'Programa de Lealtad',
            tipo: 'fidelizacion',
            estado: 'programada',
            alcance: 0,
            conversiones: 0,
            fechaInicio: '2024-02-01',
            fechaFin: '2024-04-30'
          }
        ]);

        setEstadisticas({
          alcance: 430,
          interacciones: 89,
          conversiones: 77,
          clientesNuevos: 23
        });
      } catch (error) {
        console.error('Error cargando campañas:', error);
      }
    };
    loadCampañas();
  }, []);

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'activa': return <HiOutlineLightningBolt className="w-5 h-5 text-green-400" />;
      case 'completada': return <HiOutlineCheckCircle className="w-5 h-5 text-blue-400" />;
      default: return <HiOutlineCalendar className="w-5 h-5 text-slate-400" />;
    }
  };

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'activa': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'completada': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Marketing</h1>
        <p className="text-slate-400">Campañas de marketing y promociones</p>
      </div>

      {/* Estadísticas de marketing */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineSpeakerphone className="w-6 h-6 text-violet-500" />
            <h3 className="text-lg font-semibold text-white">Alcance</h3>
          </div>
          <p className="text-3xl font-bold text-violet-400">{estadisticas.alcance}</p>
          <p className="text-slate-400 text-sm mt-1">Personas alcanzadas</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineChartBar className="w-6 h-6 text-blue-500" />
            <h3 className="text-lg font-semibold text-white">Interacciones</h3>
          </div>
          <p className="text-3xl font-bold text-blue-400">{estadisticas.interacciones}</p>
          <p className="text-slate-400 text-sm mt-1">Total de interacciones</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineCheckCircle className="w-6 h-6 text-green-500" />
            <h3 className="text-lg font-semibold text-white">Conversiones</h3>
          </div>
          <p className="text-3xl font-bold text-green-400">{estadisticas.conversiones}</p>
          <p className="text-slate-400 text-sm mt-1">Ventas generadas</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineUsers className="w-6 h-6 text-emerald-500" />
            <h3 className="text-lg font-semibold text-white">Clientes Nuevos</h3>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{estadisticas.clientesNuevos}</p>
          <p className="text-slate-400 text-sm mt-1">Este mes</p>
        </div>
      </div>

      {/* Campañas activas */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Campañas</h2>
          <button className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg font-medium hover:from-violet-500 hover:to-indigo-500 transition-all">
            Nueva Campaña
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {campañas.map((campaña) => (
              <div key={campaña.id} className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <HiOutlineLightningBolt className="w-8 h-8 text-violet-500" />
                    <div>
                      <h3 className="text-lg font-medium text-white">{campaña.nombre}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-slate-400">
                          Tipo: {campaña.tipo.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-slate-400">
                          Alcance: {campaña.alcance} personas
                        </span>
                        <span className="text-sm text-slate-400">
                          Conversiones: {campaña.conversiones}
                        </span>
                        <span className="text-sm text-slate-400">
                          <HiOutlineCalendar className="w-4 h-4 inline mr-1" />
                          {campaña.fechaInicio} - {campaña.fechaFin}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getEstadoBadge(campaña.estado)}`}>
                      {campaña.estado}
                    </span>
                    {getEstadoIcon(campaña.estado)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Herramientas de marketing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlinePhotograph className="w-6 h-6 text-purple-500" />
            <h3 className="text-lg font-semibold text-white">Redes Sociales</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Gestiona tus publicaciones en redes sociales</p>
          <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 transition-colors">
            Administrar
          </button>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineMail className="w-6 h-6 text-blue-500" />
            <h3 className="text-lg font-semibold text-white">Email Marketing</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Envía promociones a tus clientes</p>
          <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition-colors">
            Crear Campaña
          </button>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <HiOutlineChartBar className="w-6 h-6 text-green-500" />
            <h3 className="text-lg font-semibold text-white">Análisis</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Reportes de rendimiento de campañas</p>
          <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 transition-colors">
            Ver Reportes
          </button>
        </div>
      </div>
    </div>
  );
}
