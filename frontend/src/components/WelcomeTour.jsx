import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getBusinessConfig } from "../config/businessConfig";

const TOUR_KEY = "genesis_tour_seen";

const WelcomeTourContext = createContext({
  openTour: () => {},
  closeTour: () => {}
});

export const useWelcomeTour = () => useContext(WelcomeTourContext);

const buildTarget = (el, id) => {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    id,
    rect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    }
  };
};

function WelcomeTour({ onComplete }) {
  const [step, setStep] = useState(0);
  const [targets, setTargets] = useState([]);
  const businessType = getBusinessConfig().businessType;
  const normalizedBusinessType = businessType && String(businessType).trim()
    ? businessType
    : "cualquier negocio";

  const slides = useMemo(() => ([
    {
      title: "Bienvenido al Mando de GENESIS 🚀",
      subtitle: "Tu nuevo centro de control",
      description: `Tienes un superpoder empresarial en tus manos. En minutos dominarás tu operación en ${normalizedBusinessType}.`,
      hero: "✨"
    },
    {
      title: "Navegación clara 🧭",
      subtitle: "Ubica todo en segundos",
      description: "El menú principal está a la izquierda y la Configuración arriba a la derecha.",
      hero: "🕹️"
    },
    {
      title: "Munición necesaria 📂",
      subtitle: "Prepárate con",
      checklist: [
        "Logo de tu negocio",
        "Excel de clientes",
        "Inventario actualizado"
      ],
      hero: "📦"
    },
    {
      title: "Acción ⚡",
      subtitle: "Listo para despegar",
      description: "Empieza a operar con confianza desde hoy.",
      hero: "🚀",
      cta: "Iniciar Operaciones"
    }
  ]), [normalizedBusinessType]);

  const goNext = () => {
    if (step >= slides.length - 1) {
      localStorage.setItem(TOUR_KEY, "true");
      onComplete?.();
      return;
    }
    setStep((prev) => prev + 1);
  };

  const skipTour = () => {
    localStorage.setItem(TOUR_KEY, "true");
    onComplete?.();
  };

  useEffect(() => {
    if (step !== 1) {
      setTargets([]);
      return;
    }
    const updateTargets = () => {
      const sidebar = document.querySelector('[data-tour="sidebar"]');
      const navbar = document.querySelector('[data-tour="navbar"]');
      const settings = document.querySelector('[data-tour="sidebar-settings"]');
      const nextTargets = [
        buildTarget(sidebar, "sidebar"),
        buildTarget(navbar, "navbar"),
        buildTarget(settings, "settings")
      ].filter(Boolean);
      setTargets(nextTargets);
    };
    updateTargets();
    window.addEventListener("resize", updateTargets);
    return () => window.removeEventListener("resize", updateTargets);
  }, [step]);

  const slide = slides[step];
  const sidebarTarget = targets.find((t) => t.id === "sidebar");
  const navbarTarget = targets.find((t) => t.id === "navbar");
  const settingsTarget = targets.find((t) => t.id === "settings");

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />

      {targets.map((t) => (
        <div
          key={t.id}
          className="absolute border border-violet-400/50 rounded-2xl shadow-[0_0_40px_rgba(139,92,246,0.35)] pointer-events-none animate-in fade-in duration-300"
          style={{
            top: Math.max(t.rect.top - 6, 6),
            left: Math.max(t.rect.left - 6, 6),
            width: t.rect.width + 12,
            height: t.rect.height + 12
          }}
        />
      ))}

      {step === 1 && targets.length > 0 && (
        <>
          {sidebarTarget && (
            <div
              className="absolute hidden md:block text-xs text-slate-200 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 shadow-lg animate-in fade-in slide-in-from-left-2"
              style={{
                top: Math.max(sidebarTarget.rect.top + 24, 24),
                left: Math.min(sidebarTarget.rect.right + 16, window.innerWidth - 220)
              }}
            >
              Menú principal a la izquierda
            </div>
          )}
          {settingsTarget && (
            <div
              className="absolute hidden md:block text-xs text-slate-200 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 shadow-lg animate-in fade-in slide-in-from-left-2"
              style={{
                top: Math.max(settingsTarget.rect.top - 8, 8),
                left: Math.min(settingsTarget.rect.right + 12, window.innerWidth - 220)
              }}
            >
              Configuración dentro del menú
            </div>
          )}
          {navbarTarget && (
            <div
              className="absolute hidden md:block text-xs text-slate-200 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 shadow-lg animate-in fade-in slide-in-from-top-2"
              style={{ top: Math.max(navbarTarget.rect.top + 8, 8), right: 24 }}
            >
              Estado y controles arriba
            </div>
          )}
        </>
      )}

      <div className="relative z-[71] h-full flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-slate-900/70 border border-slate-700/60 rounded-3xl shadow-2xl backdrop-blur-xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-widest text-slate-400">
              Tour {step + 1} / {slides.length}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={skipTour} className="text-xs text-slate-400 hover:text-white">
                Omitir
              </button>
              <button
                onClick={skipTour}
                className="w-7 h-7 rounded-full border border-slate-700/70 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
                aria-label="Cerrar tour"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-lg">
              {slide.hero}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">{slide.title}</h3>
              <p className="text-sm text-slate-400">{slide.subtitle}</p>
            </div>
          </div>

          {slide.description && (
            <p className="mt-5 text-sm text-slate-300 leading-relaxed">
              {slide.description}
            </p>
          )}

          {slide.checklist && (
            <ul className="mt-5 space-y-2 text-sm text-slate-200">
              {slide.checklist.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {slides.map((_, idx) => (
                <span
                  key={`dot-${idx}`}
                  className={`h-1.5 w-6 rounded-full transition-all ${
                    idx === step ? "bg-violet-500" : "bg-slate-700"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={goNext}
              className={`px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-lg transition-all ${
                step === slides.length - 1
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-violet-600 hover:bg-violet-500"
              }`}
            >
              {slide.cta || "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WelcomeTourProvider({ children }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem(TOUR_KEY);
    if (!hasSeen) {
      const timeout = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, []);

  const openTour = ({ force = false } = {}) => {
    if (force) {
      setOpen(true);
      return;
    }
    const hasSeen = localStorage.getItem(TOUR_KEY);
    if (!hasSeen) setOpen(true);
  };

  const closeTour = () => setOpen(false);

  return (
    <WelcomeTourContext.Provider value={{ openTour, closeTour }}>
      {children}
      {open && (
        <WelcomeTour
          onComplete={() => {
            localStorage.setItem(TOUR_KEY, "true");
            setOpen(false);
          }}
        />
      )}
    </WelcomeTourContext.Provider>
  );
}

export { WelcomeTour };
