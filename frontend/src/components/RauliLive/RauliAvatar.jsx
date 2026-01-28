import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * RAULI Avatar - Personaje Femenino Animado
 * Gestos: idle, listening, thinking, speaking, happy, concerned
 */
export default function RauliAvatar({ gesture = "idle", isListening = false, isSpeaking = false }) {
  const [blinkState, setBlinkState] = useState(false);

  // Parpadeo automático cada 3-5 segundos
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkState(true);
      setTimeout(() => setBlinkState(false), 150);
    }, Math.random() * 2000 + 3000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Animaciones basadas en gesto
  const animations = {
    idle: {
      y: [0, -5, 0],
      rotate: [0, -2, 0, 2, 0],
      transition: {
        y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: 8, repeat: Infinity, ease: "easeInOut" }
      }
    },
    listening: {
      rotate: -10,
      scale: 1.05,
      transition: { duration: 0.3 }
    },
    thinking: {
      rotate: 15,
      y: -10,
      transition: { duration: 0.5 }
    },
    speaking: {
      scale: [1, 1.02, 1],
      transition: { duration: 0.5, repeat: Infinity }
    },
    happy: {
      y: [-20, 0],
      rotate: [0, 5, -5, 0],
      transition: { duration: 0.6, ease: "easeOut" }
    },
    concerned: {
      y: [0, -5, 0],
      rotate: [0, -5, 0],
      transition: { duration: 0.8 }
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Avatar Container */}
      <motion.div
        className="relative"
        animate={animations[gesture] || animations.idle}
      >
        {/* SVG Avatar Femenino PROFESIONAL */}
        <svg
          width="320"
          height="380"
          viewBox="0 0 320 380"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-2xl"
        >
          {/* Fondo/Aura Mejorado */}
          <motion.ellipse
            cx="160"
            cy="340"
            rx="120"
            ry="20"
            fill="url(#auraGradient)"
            opacity={isListening ? 0.7 : 0.2}
            animate={isListening ? {
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.7, 0.2]
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Hombros y Torso Elegante */}
          <motion.g>
            <path
              d="M160 200 L110 240 Q105 245, 105 252 L105 350 C105 355, 110 360, 115 360 L205 360 C210 360, 215 355, 215 350 L215 252 Q215 245, 210 240 L160 200Z"
              fill="url(#bodyGradientPro)"
              opacity="0.95"
            />
            {/* Detalles de vestimenta */}
            <path
              d="M130 240 Q160 250, 190 240"
              stroke="url(#accentGradient)"
              strokeWidth="2"
              opacity="0.3"
              fill="none"
            />
          </motion.g>

          {/* Cuello Refinado */}
          <path
            d="M140 175 Q135 180, 135 190 L135 200 C135 205, 140 208, 160 208 C180 208, 185 205, 185 200 L185 190 Q185 180, 180 175 Z"
            fill="#ffd0b8"
            opacity="0.98"
          />

          {/* Cabeza con Forma Natural */}
          <g filter="url(#softGlow)">
            <ellipse
              cx="160"
              cy="130"
              rx="50"
              ry="58"
              fill="url(#skinGradient)"
            />
            {/* Contorno sutil */}
            <ellipse
              cx="160"
              cy="130"
              rx="50"
              ry="58"
              fill="none"
              stroke="#e8c3a8"
              strokeWidth="0.5"
              opacity="0.3"
            />
          </g>

          {/* Cabello Estilizado Profesional */}
          <g>
            {/* Capa base cabello */}
            <motion.path
              d="M110 100 Q90 80, 92 58 Q95 35, 115 25 Q135 18, 160 18 Q185 18, 205 25 Q225 35, 228 58 Q230 80, 210 100 Q200 115, 185 125 Q170 132, 160 133 Q150 132, 135 125 Q120 115, 110 100Z"
              fill="url(#hairGradient)"
            />
            {/* Detalles y brillo */}
            <path
              d="M130 40 Q140 35, 150 38"
              stroke="#6a6a6a"
              strokeWidth="2"
              opacity="0.15"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M170 42 Q180 38, 188 43"
              stroke="#6a6a6a"
              strokeWidth="2"
              opacity="0.15"
              fill="none"
              strokeLinecap="round"
            />
            {/* Flequillo */}
            <motion.path
              d="M120 85 Q130 75, 140 78 M145 76 Q155 73, 165 76 M170 78 Q180 75, 190 85"
              stroke="#3a3a3a"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              animate={gesture === "thinking" ? { y: -2 } : { y: 0 }}
              transition={{ duration: 0.3 }}
            />
          </g>

          {/* Ojos Expresivos Mejorados */}
          <g>
            {/* Ojo Izquierdo */}
            <g>
              {/* Blanco del ojo */}
              <ellipse
                cx="137"
                cy="125"
                rx="12"
                ry={blinkState ? 1 : 13}
                fill="#ffffff"
                opacity="0.95"
              />
              {/* Iris */}
              <motion.ellipse
                cx="137"
                cy={blinkState ? 125 : 127}
                rx={blinkState ? 0 : 9}
                ry={blinkState ? 0 : 9}
                fill="url(#irisGradient)"
                animate={isListening ? {
                  scale: [1, 1.15, 1]
                } : {}}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
              {/* Pupila */}
              <circle cx="137" cy="125" r={blinkState ? 0 : 4} fill="#1a1a1a" />
              {/* Brillo */}
              <circle cx="135" cy="123" r={blinkState ? 0 : 2} fill="#ffffff" opacity="0.8" />
            </g>

            {/* Ojo Derecho */}
            <g>
              <ellipse
                cx="183"
                cy="125"
                rx="12"
                ry={blinkState ? 1 : 13}
                fill="#ffffff"
                opacity="0.95"
              />
              <motion.ellipse
                cx="183"
                cy={blinkState ? 125 : 127}
                rx={blinkState ? 0 : 9}
                ry={blinkState ? 0 : 9}
                fill="url(#irisGradient)"
                animate={isListening ? {
                  scale: [1, 1.15, 1]
                } : {}}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
              <circle cx="183" cy="125" r={blinkState ? 0 : 4} fill="#1a1a1a" />
              <circle cx="181" cy="123" r={blinkState ? 0 : 2} fill="#ffffff" opacity="0.8" />
            </g>
          </g>

          {/* Cejas Expresivas */}
          <motion.g
            animate={gesture === "concerned" ? { y: -4 } : gesture === "happy" ? { y: 2 } : { y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <path 
              d="M120 108 Q130 104, 145 107" 
              stroke="#2a2a2a" 
              strokeWidth="3.5" 
              fill="none" 
              strokeLinecap="round"
              opacity="0.8"
            />
            <path 
              d="M175 107 Q190 104, 200 108" 
              stroke="#2a2a2a" 
              strokeWidth="3.5" 
              fill="none" 
              strokeLinecap="round"
              opacity="0.8"
            />
          </motion.g>

          {/* Nariz Sutil */}
          <g opacity="0.4">
            <path d="M160 138 L158 150 Q160 152, 162 150 Z" fill="#e8c3a8" />
            <ellipse cx="156" cy="151" rx="2" ry="1.5" fill="#d4a88a" opacity="0.3" />
            <ellipse cx="164" cy="151" rx="2" ry="1.5" fill="#d4a88a" opacity="0.3" />
          </g>

          {/* Boca Profesional */}
          <motion.g>
            {isSpeaking ? (
              <motion.g
                animate={{
                  scaleY: [1, 1.1, 0.95, 1.05, 1]
                }}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                <ellipse cx="160" cy="165" rx="12" ry="8" fill="#c85a7c" opacity="0.3" />
                <path
                  d="M145 165 Q160 172, 175 165"
                  stroke="#c85a7c"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </motion.g>
            ) : gesture === "happy" ? (
              <path
                d="M145 163 Q160 173, 175 163"
                stroke="#d97694"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            ) : gesture === "concerned" ? (
              <path
                d="M145 168 Q160 163, 175 168"
                stroke="#c85a7c"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M145 165 Q160 168, 175 165"
                stroke="#d97694"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                opacity="0.8"
              />
            )}
          </motion.g>

          {/* Indicador de Escucha Elegante */}
          {isListening && (
            <motion.g
              animate={{
                opacity: [0.4, 0.9, 0.4],
                scale: [1, 1.08, 1]
              }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <circle cx="105" cy="130" r="18" fill="url(#listenGradient)" opacity="0.5" />
              <circle cx="215" cy="130" r="18" fill="url(#listenGradient)" opacity="0.5" />
              {/* Ondas de sonido */}
              <motion.path
                d="M95 130 Q85 130, 80 130"
                stroke="#06b6d4"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                animate={{ opacity: [0, 0.8, 0], x: [-5, 0, 5] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <motion.path
                d="M225 130 Q235 130, 240 130"
                stroke="#06b6d4"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                animate={{ opacity: [0, 0.8, 0], x: [5, 0, -5] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </motion.g>
          )}

          {/* Gesto Pensativo Mejorado */}
          {gesture === "thinking" && (
            <motion.g
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Mano */}
              <ellipse cx="115" cy="155" rx="18" ry="22" fill="url(#skinGradient)" transform="rotate(-25 115 155)" />
              {/* Dedos */}
              <ellipse cx="108" cy="162" rx="6" ry="8" fill="url(#skinGradient)" transform="rotate(-30 108 162)" />
              <ellipse cx="103" cy="158" rx="5" ry="7" fill="url(#skinGradient)" transform="rotate(-40 103 158)" />
              {/* Sombra */}
              <ellipse cx="118" cy="160" rx="15" ry="18" fill="#000000" opacity="0.1" transform="rotate(-25 118 160)" />
            </motion.g>
          )}

          {/* Sparkles Elegantes para Happy */}
          {gesture === "happy" && (
            <motion.g
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0], rotate: [0, 180, 360] }}
              transition={{ duration: 1, repeat: 2 }}
            >
              <path d="M100 70 L102 76 L108 78 L102 80 L100 86 L98 80 L92 78 L98 76 Z" fill="#ffd700" />
              <path d="M220 85 L221 89 L225 90 L221 91 L220 95 L219 91 L215 90 L219 89 Z" fill="#ffd700" />
              <path d="M160 50 L161 54 L165 55 L161 56 L160 60 L159 56 L155 55 L159 54 Z" fill="#ffd700" />
            </motion.g>
          )}

          {/* Gradientes Profesionales */}
          <defs>
            {/* Cuerpo elegante */}
            <linearGradient id="bodyGradientPro" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b7fd6" />
              <stop offset="50%" stopColor="#7b68c4" />
              <stop offset="100%" stopColor="#6b5ab2" />
            </linearGradient>

            {/* Gradiente de acento */}
            <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
            
            {/* Piel natural */}
            <radialGradient id="skinGradient" cx="50%" cy="40%">
              <stop offset="0%" stopColor="#ffddc7" />
              <stop offset="70%" stopColor="#ffd0b8" />
              <stop offset="100%" stopColor="#f5c4a8" />
            </radialGradient>

            {/* Cabello con profundidad */}
            <linearGradient id="hairGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#5a5a5a" />
              <stop offset="50%" stopColor="#4a4a4a" />
              <stop offset="100%" stopColor="#3a3a3a" />
            </linearGradient>

            {/* Iris con profundidad */}
            <radialGradient id="irisGradient" cx="40%" cy="40%">
              <stop offset="0%" stopColor="#7c8fd9" />
              <stop offset="60%" stopColor="#5c6bc0" />
              <stop offset="100%" stopColor="#4a5a9e" />
            </radialGradient>
            
            {/* Aura suave */}
            <radialGradient id="auraGradient">
              <stop offset="0%" stopColor="#8b7fd6" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#7b68c4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#6b5ab2" stopOpacity="0" />
            </radialGradient>

            {/* Indicador de escucha */}
            <radialGradient id="listenGradient">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
            </radialGradient>

            {/* Efecto glow suave */}
            <filter id="softGlow">
              <feGaussianBlur stdDeviation="1" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
        </svg>

        {/* Indicador de volumen elegante */}
        {isSpeaking && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            {[...Array(7)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1.5 bg-gradient-to-t from-violet-400 via-purple-400 to-fuchsia-400 rounded-full shadow-lg shadow-violet-500/50"
                style={{
                  filter: 'drop-shadow(0 0 3px rgba(167, 139, 250, 0.5))'
                }}
                animate={{
                  height: [12, 24 + i * 4, 12],
                  opacity: [0.6, 1, 0.6]
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
