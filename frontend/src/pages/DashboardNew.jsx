import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BrainCircuit,
  Sparkles,
  MessageCircle,
  BarChart3,
  Users,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
  Target,
  Lightbulb,
  Settings,
  Package
} from 'lucide-react';

function DashboardNew() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiStatus, setAiStatus] = useState('ready');
  const [activeFeature, setActiveFeature] = useState('chat');

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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const aiFeatures = [
    { 
      id: 'chat', 
      icon: MessageCircle, 
      label: 'Asistente IA', 
      description: 'Conversa inteligente',
      color: 'from-violet-500 to-purple-600',
      route: '/assistant'
    },
    { 
      id: 'analytics', 
      icon: BarChart3, 
      label: 'Análisis', 
      description: 'Reportes inteligentes',
      color: 'from-emerald-500 to-teal-600',
      route: '/reports'
    },
    { 
      id: 'insights', 
      icon: Lightbulb, 
      label: 'Insights', 
      description: 'Recomendaciones',
      color: 'from-amber-500 to-orange-600',
      route: '/insights'
    },
    { 
      id: 'automation', 
      icon: Zap, 
      label: 'Automatización', 
      description: 'Tareas automáticas',
      color: 'from-blue-500 to-cyan-600',
      route: '/automation'
    }
  ];

  const quickStats = [
    { label: 'Consultas Hoy', value: '47', trend: '+12%', icon: MessageCircle },
    { label: 'Insights Generados', value: '23', trend: '+8%', icon: Lightbulb },
    { label: 'Tareas Automatizadas', value: '15', trend: '+25%', icon: Zap },
    { label: 'Eficiencia', value: '94%', trend: '+5%', icon: Target }
  ];

  const greeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-2 sm:p-3 md:p-4 lg:p-6">
      {/* Header elegante */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-r from-violet-500 to-purple-600 rounded-full p-2 sm:p-3">
                <BrainCircuit className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                {greeting()}, Bienvenido
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">Tu asistente inteligente está listo</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-white text-sm sm:font-medium">{formatTime()}</p>
              <p className="text-slate-400 text-[10px] sm:text-xs hidden xs:block">
                {currentTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className={`p-2 sm:p-3 rounded-full ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {isOnline ? <Wifi className="w-4 h-4 sm:w-5 sm:h-5" /> : <WifiOff className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
          </div>
        </div>

        {/* Estado IA */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-violet-500/20 to-purple-600/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-violet-500/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-violet-500 rounded-full blur-lg opacity-50 animate-pulse"></div>
                  <div className="relative bg-violet-500 rounded-full p-2">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Estado del Sistema IA</h2>
                  <p className="text-slate-300 text-sm">Todos los sistemas operativos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-400 text-sm font-medium">Activo</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {quickStats.map((stat, idx) => (
                <div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <stat.icon className="w-5 h-5 text-violet-400" />
                    <span className="text-xs text-emerald-400 font-medium">{stat.trend}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Características IA */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">Características Inteligentes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {aiFeatures.map((feature) => (
              <div
                key={feature.id}
                className={`relative group transition-all duration-300 cursor-pointer ${
                  activeFeature === feature.id 
                    ? 'scale-105' 
                    : 'hover:scale-105'
                }`}
                onClick={() => setActiveFeature(feature.id)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity`}></div>
                <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-slate-700/50 h-full">
                  <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 mx-auto`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-white font-semibold text-center mb-2">{feature.label}</h3>
                  <p className="text-slate-400 text-xs text-center">{feature.description}</p>
                  
                  {activeFeature === feature.id && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(feature.route);
                        }}
                        className="w-full py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-violet-600 hover:to-purple-700 transition-colors"
                      >
                        Abrir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        </div>
    </div>
  );
}

export default DashboardNew;
