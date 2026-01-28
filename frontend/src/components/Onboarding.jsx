/**
 * GENESIS - Onboarding & QR Team Setup
 * Módulo de bienvenida y configuración de equipo con códigos QR
 */

import { useState, useEffect, useRef } from 'react';
import {
  HiOutlineQrcode,
  HiOutlineUserGroup,
  HiOutlinePlay,
  HiOutlineCheckCircle,
  HiOutlineClipboardCopy,
  HiOutlineDownload,
  HiOutlineRefresh,
  HiOutlineDeviceMobile,
  HiOutlineWifi,
  HiOutlineCloud,
  HiOutlineLightningBolt,
  HiOutlineShieldCheck,
  HiOutlineSparkles
} from 'react-icons/hi';

// ==================== GENERADOR QR SIMPLE (SVG) ====================

function generateQRCode(data, size = 200) {
  // Usando una implementación simple de QR con URL de API pública
  // En producción usar librería como qrcode.react
  const encodedData = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}`;
}

// ==================== COMPONENTE PRINCIPAL ====================

export default function Onboarding({ showAsModal = false, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQRData] = useState(null);
  const [copied, setCopied] = useState(false);
  
  const videoRef = useRef(null);

  // Datos de configuración para compartir
  const generateSetupData = () => {
    const baseUrl = window.location.origin;
    const setupData = {
      url: baseUrl,
      app: 'GENESIS',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    };
    return JSON.stringify(setupData);
  };

  const generateInviteLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/login?invite=true`;
  };

  const handleCopyLink = async () => {
    const link = generateInviteLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying:', err);
    }
  };

  const handleShowQR = () => {
    const data = generateSetupData();
    setQRData(data);
    setShowQRModal(true);
  };

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.href = generateQRCode(qrData, 400);
    link.download = 'genesis-setup-qr.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==================== PASOS DEL ONBOARDING ====================

  const steps = [
    {
      id: 'welcome',
      title: '¡Bienvenido a GENESIS!',
      description: 'Tu sistema de gestión integral',
      content: (
        <div className="text-center py-8">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center">
            <span className="text-5xl">🧩</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4 tracking-wide">GENESIS</h2>
          <p className="text-slate-300 max-w-md mx-auto">
            Sistema completo de punto de venta, inventario, contabilidad y más.
            Funciona incluso sin conexión a internet.
          </p>
          
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-lg mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-green-500/20 rounded-full flex items-center justify-center">
                <HiOutlineWifi className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-xs text-slate-400">Offline First</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-blue-500/20 rounded-full flex items-center justify-center">
                <HiOutlineCloud className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-xs text-slate-400">Sincronización</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-purple-500/20 rounded-full flex items-center justify-center">
                <HiOutlineShieldCheck className="w-6 h-6 text-purple-400" />
              </div>
              <p className="text-xs text-slate-400">Seguro</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'features',
      title: 'Características Principales',
      description: 'Todo lo que necesitas para tu negocio',
      content: (
        <div className="py-4">
          <div className="grid gap-4">
            {[
              { icon: HiOutlineLightningBolt, title: 'Punto de Venta', desc: 'Ventas rápidas con escáner y voz', color: 'yellow' },
              { icon: HiOutlineUserGroup, title: 'Gestión de Personal', desc: 'Horarios, comisiones y nómina', color: 'blue' },
              { icon: HiOutlineSparkles, title: 'Contabilidad Automática', desc: 'Asientos y reportes fiscales', color: 'purple' },
              { icon: HiOutlineDeviceMobile, title: 'PWA Instalable', desc: 'Funciona como app nativa', color: 'green' },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-xl">
                <div className={`p-3 rounded-lg bg-${feature.color}-500/20`}>
                  <feature.icon className={`w-6 h-6 text-${feature.color}-400`} />
                </div>
                <div>
                  <h4 className="font-medium text-white">{feature.title}</h4>
                  <p className="text-sm text-slate-400">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'video',
      title: 'Tutorial Rápido',
      description: 'Aprende lo básico en 2 minutos',
      content: (
        <div className="py-4">
          <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative">
            {/* Placeholder para video tutorial */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-500/30 transition-colors">
                  <HiOutlinePlay className="w-10 h-10 text-purple-400 ml-1" />
                </div>
                <p className="text-slate-400">Video tutorial próximamente</p>
                <p className="text-xs text-slate-500 mt-2">
                  Mientras tanto, explora la app - ¡Es muy intuitiva!
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
            <h4 className="font-medium text-white mb-2">💡 Tip rápido</h4>
            <p className="text-sm text-slate-300">
              Usa el botón flotante de IA en la esquina para comandos de voz.
              Di "ayuda" para ver todos los comandos disponibles.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'team',
      title: 'Configura tu Equipo',
      description: 'Invita a tus empleados fácilmente',
      content: (
        <div className="py-4 space-y-6">
          <p className="text-slate-300 text-center">
            Comparte el acceso con tu equipo usando un código QR o enlace directo.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Opción QR */}
            <button
              onClick={handleShowQR}
              className="p-6 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-colors text-center group"
            >
              <div className="w-16 h-16 mx-auto mb-3 bg-purple-500/20 group-hover:bg-purple-500/30 rounded-xl flex items-center justify-center transition-colors">
                <HiOutlineQrcode className="w-8 h-8 text-purple-400" />
              </div>
              <h4 className="font-medium text-white">Código QR</h4>
              <p className="text-xs text-slate-400 mt-1">Escanear para configurar</p>
            </button>
            
            {/* Opción Link */}
            <button
              onClick={handleCopyLink}
              className="p-6 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-colors text-center group"
            >
              <div className="w-16 h-16 mx-auto mb-3 bg-blue-500/20 group-hover:bg-blue-500/30 rounded-xl flex items-center justify-center transition-colors">
                {copied ? (
                  <HiOutlineCheckCircle className="w-8 h-8 text-green-400" />
                ) : (
                  <HiOutlineClipboardCopy className="w-8 h-8 text-blue-400" />
                )}
              </div>
              <h4 className="font-medium text-white">
                {copied ? '¡Copiado!' : 'Copiar Enlace'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">Compartir por mensaje</p>
            </button>
          </div>
          
          <div className="bg-slate-800 rounded-xl p-4">
            <h4 className="text-sm font-medium text-white mb-3">Usuarios de Prueba</h4>
            <div className="space-y-2">
              {[
                { email: 'admin@genesis.com', pass: 'admin123', role: 'Administrador' },
                { email: 'gerente@genesis.com', pass: 'gerente123', role: 'Gerente' },
                { email: 'cajero@genesis.com', pass: 'cajero123', role: 'Cajero' },
              ].map((user, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm p-2 bg-slate-700/30 rounded-lg">
                  <span className="text-slate-300">{user.email}</span>
                  <span className="text-purple-400 font-mono">{user.pass}</span>
                  <span className="text-xs text-slate-500">{user.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'ready',
      title: '¡Todo Listo!',
      description: 'Comienza a usar GENESIS',
      content: (
        <div className="text-center py-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
            <HiOutlineCheckCircle className="w-12 h-12 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">¡Configuración Completa!</h2>
          <p className="text-slate-300 max-w-md mx-auto mb-8">
            Tu sistema está listo. Puedes empezar a registrar productos, realizar ventas y gestionar tu negocio.
          </p>
          
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
            <a
              href="/pos"
              className="p-4 bg-purple-600 hover:bg-purple-700 rounded-xl text-white font-medium transition-colors"
            >
              Ir al POS
            </a>
            <a
              href="/products"
              className="p-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-colors"
            >
              Ver Productos
            </a>
          </div>
        </div>
      )
    }
  ];

  // ==================== RENDER ====================

  const containerClasses = showAsModal
    ? 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'
    : 'min-h-screen bg-slate-900 flex items-center justify-center p-4';

  return (
    <div className={containerClasses}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-700">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{steps[currentStep].title}</h2>
              <p className="text-sm text-slate-400">{steps[currentStep].description}</p>
            </div>
            <span className="text-sm text-slate-500">
              {currentStep + 1} / {steps.length}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {steps[currentStep].content}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          
          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? 'bg-purple-500 w-6'
                    : idx < currentStep
                    ? 'bg-green-500'
                    : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
          
          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={onClose || (() => window.location.href = '/dashboard')}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Comenzar
            </button>
          )}
        </div>
      </div>

      {/* Modal QR */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold text-white mb-4">Código QR de Configuración</h3>
            
            <div className="bg-white p-4 rounded-xl mb-4 inline-block">
              <img 
                src={generateQRCode(qrData, 200)} 
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
            
            <p className="text-sm text-slate-400 mb-4">
              Los empleados pueden escanear este código para acceder rápidamente a la app.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={handleDownloadQR}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg"
              >
                <HiOutlineDownload className="w-5 h-5" />
                Descargar
              </button>
              <button
                onClick={() => setShowQRModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== EXPORTAR COMO MODAL ====================

export function OnboardingModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return <Onboarding showAsModal onClose={onClose} />;
}
