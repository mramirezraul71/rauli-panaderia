import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  HiOutlineMicrophone, 
  HiOutlinePaperAirplane, 
  HiOutlineX,
  HiOutlineChip,
  HiOutlineSparkles,
  HiOutlineCamera,
  HiOutlinePencil,
  HiOutlineCog
} from "react-icons/hi";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { useCameraVision } from "../../hooks/useCameraVision";
import { useVoiceSynthesis } from "../../hooks/useVoiceSynthesis";
import { useRauli } from "../../context/RauliContext";
import { RAULI_SYSTEM_PROMPT, getRauliContext } from "../../config/rauliPersonality";
import { executeAction } from "./actions";
import { DEFAULT_PROFILES as DEFAULT_PROFILES_IMPORT, DEFAULT_PERMISSIONS } from "./permissions";
import AIEngine from "../../services/AIEngine";

const createToneDataUrl = (frequency, durationSeconds, volume = 0.18) => {
  const sampleRate = 8000;
  const samples = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const headerSize = 44;
  const buffer = new Uint8Array(headerSize + samples);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      buffer[offset + i] = value.charCodeAt(i);
    }
  };

  const writeUint32 = (offset, value) => {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >> 8) & 0xff;
    buffer[offset + 2] = (value >> 16) & 0xff;
    buffer[offset + 3] = (value >> 24) & 0xff;
  };

  const writeUint16 = (offset, value) => {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >> 8) & 0xff;
  };

  writeString(0, "RIFF");
  writeUint32(4, 36 + samples);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  writeUint32(16, 16);
  writeUint16(20, 1);
  writeUint16(22, 1);
  writeUint32(24, sampleRate);
  writeUint32(28, sampleRate);
  writeUint16(32, 1);
  writeUint16(34, 8);
  writeString(36, "data");
  writeUint32(40, samples);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
    buffer[headerSize + i] = 128 + Math.round(127 * volume * sample);
  }

  let binary = "";
  for (let i = 0; i < buffer.length; i += 1) {
    binary += String.fromCharCode(buffer[i]);
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
};

const tryPlaySound = (audioRef) => {
  if (!audioRef.current) return;
  audioRef.current.currentTime = 0;
  audioRef.current.play().catch(() => {});
};

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const MODE_TO_ROUTE = {
  Operaciones: "/",
  Caja: "/cash",
  Inventario: "/inventory",
  Produccion: "/produccion",
  Compras: "/compras",
  Marketing: "/marketing",
  Gerencia: "/gerencia"
};

const SEND_BURST_OFFSETS = [
  { x: -22, y: -14 },
  { x: -8, y: -24 },
  { x: 12, y: -20 },
  { x: 24, y: -6 },
  { x: 16, y: 12 },
  { x: -4, y: 18 },
  { x: -20, y: 8 }
];

const RECEIVE_WAVE_STYLES = [
  "bg-cyan-400/40",
  "bg-violet-400/40",
  "bg-fuchsia-400/30"
];

// Características Inteligentes - Acciones Rápidas Profesionales
const SMART_ACTIONS = {
  navigation: [
    { 
      label: "🏪 POS", 
      text: "Abrir punto de venta para cobrar", 
      route: "/pos",
      description: "Caja rápida para ventas"
    },
    { 
      label: "📦 Inventario", 
      text: "Ver inventario actual y stock", 
      route: "/inventory",
      description: "Control de productos"
    },
    { 
      label: "📊 Ventas", 
      text: "Mostrar reporte de ventas de hoy", 
      route: "/sales",
      description: "Análisis de ventas"
    },
    { 
      label: "🛍️ Productos", 
      text: "Gestionar catálogo de productos", 
      route: "/products",
      description: "Catálogo completo"
    }
  ],
  reports: [
    { 
      label: "💰 Cierre del día", 
      text: "Generar resumen del cierre de caja del día", 
      action: "daily_report",
      description: "Reporte diario completo"
    },
    { 
      label: "📈 Análisis", 
      text: "Mostrar análisis de rendimiento", 
      action: "performance_analysis",
      description: "Métricas clave"
    },
    { 
      label: "🎯 Metas", 
      text: "Ver cumplimiento de metas", 
      action: "goals_tracking",
      description: "Seguimiento de objetivos"
    }
  ],
  operations: [
    { 
      label: "⚡ Venta rápida", 
      text: "Iniciar venta rápida", 
      action: "quick_sale",
      description: "Venta express"
    },
    { 
      label: "🔍 Buscar producto", 
      text: "Buscar producto por nombre o código", 
      action: "search_product",
      description: "Búsqueda inteligente"
    },
    { 
      label: "📋 Inventario bajo", 
      text: "Ver productos con bajo stock", 
      action: "low_stock",
      description: "Alertas de stock"
    }
  ]
};

// Prompts contextuales por ruta
const ROUTE_CONTEXT_ACTIONS = {
  "/pos": [
    { label: "💳 Cobrar", text: "Iniciar cobro en efectivo", action: "cash_payment" },
    { label: "💱 Tarjeta", text: "Procesar pago con tarjeta", action: "card_payment" },
    { label: "🧾 Ticket", text: "Imprimir último ticket", action: "print_receipt" }
  ],
  "/inventory": [
    { label: "📥 Entrada", text: "Registrar entrada de mercancía", action: "stock_in" },
    { label: "📤 Salida", text: "Registrar salida de producto", action: "stock_out" },
    { label: "🔢 Conteo", text: "Iniciar conteo de inventario", action: "stock_count" }
  ],
  "/products": [
    { label: "➕ Nuevo", text: "Crear nuevo producto", action: "new_product" },
    { label: "✏️ Editar", text: "Editar producto existente", action: "edit_product" },
    { label: "📷 Foto", text: "Agregar foto a producto", action: "product_photo" }
  ],
  "/sales": [
    { label: "📅 Hoy", text: "Ver ventas de hoy", action: "today_sales" },
    { label: "📉 Descuentos", text: "Ver descuentos aplicados", action: "discounts_report" },
    { label: "👥 Clientes", text: "Ver clientes frecuentes", action: "frequent_customers" }
  ]
};

const STORAGE_KEYS = {
  profiles: "rauli_profiles",
  activeProfile: "rauli_active_profile"
};

const getProfiles = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profiles);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
};

const saveProfiles = (profiles) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.profiles, JSON.stringify(profiles));
};

const getActiveProfileId = () => {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem(STORAGE_KEYS.activeProfile) || "default";
};

const setActiveProfileId = (id) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.activeProfile, id);
};

const getProfileStorageKey = (profileId, suffix) => `rauli_profile_${profileId}_${suffix}`;

const OWNER_PERMISSIONS = {
  canNavigate: true,
  canQuery: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  canAnalyze: true,
  allowedRoutes: [
    "/dashboard",
    "/pos",
    "/sales",
    "/products",
    "/inventory",
    "/customers",
    "/credits",
    "/reports",
    "/settings",
    "/expenses",
    "/cash",
    "/quality",
    "/support",
    "/produccion",
    "/employees",
    "/accounting",
    "/accounting-advanced",
    "/analytics-advanced",
    "/shrinkage",
    "/config-productos",
    "/control-tower"
  ]
};

const ALL_ROUTES = OWNER_PERMISSIONS.allowedRoutes;

const normalizeRoute = (route) => {
  if (!route) return "";
  return route.startsWith("/") ? route : `/${route}`;
};

const isActionAllowed = (action, permissions) => {
  if (!action) return true;
  const type = action.type;
  if (type === "navigate") {
    const route = normalizeRoute(action.target || action.route || action.path);
    return permissions.allowedRoutes.includes(route);
  }
  if (type === "create") return permissions.canCreate;
  if (type === "update") return permissions.canUpdate;
  if (type === "delete") return permissions.canDelete;
  if (type === "query") return permissions.canQuery;
  if (type === "analyze") return permissions.canAnalyze;
  return true;
};

const getStoredMessages = (profileId) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getProfileStorageKey(profileId, "chat"));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    return data.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
    }));
  } catch {
    return null;
  }
};

const getStoredLocation = (profileId) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getProfileStorageKey(profileId, "location"));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
};

const storeLocation = (profileId, location) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(getProfileStorageKey(profileId, "location"), JSON.stringify(location));
};

const getStoredLocationHistory = (profileId) => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getProfileStorageKey(profileId, "location_history"));
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const storeLocationHistory = (profileId, location, limit = 20) => {
  if (typeof window === "undefined") return;
  const history = getStoredLocationHistory(profileId);
  const next = [location, ...history].slice(0, limit);
  localStorage.setItem(getProfileStorageKey(profileId, "location_history"), JSON.stringify(next));
};

const getStoredFace = (profileId) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getProfileStorageKey(profileId, "face"));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

const storeFace = (profileId, vector) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(getProfileStorageKey(profileId, "face"), JSON.stringify(vector));
};

const toGrayscaleVector = (imageData, size = 16) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = size;
  canvas.height = size;
  ctx.putImageData(imageData, 0, 0);
  const data = ctx.getImageData(0, 0, size, size).data;
  const vector = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    vector.push((r + g + b) / (3 * 255));
  }
  return vector;
};

const compareVectors = (a, b) => {
  if (!a || !b || a.length !== b.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum / a.length);
};

const buildFaceVector = async (dataUrl) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  let crop = { x: 0, y: 0, w: img.width, h: img.height };
  if ("FaceDetector" in window) {
    try {
      const detector = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: true });
      const faces = await detector.detect(img);
      if (faces?.[0]) {
        const { x, y, width, height } = faces[0].boundingBox;
        crop = { x, y, w: width, h: height };
      }
    } catch {}
  } else {
    const size = Math.min(img.width, img.height);
    crop = { x: (img.width - size) / 2, y: (img.height - size) / 2, w: size, h: size };
  }

  const faceCanvas = document.createElement("canvas");
  const faceCtx = faceCanvas.getContext("2d");
  faceCanvas.width = 32;
  faceCanvas.height = 32;
  faceCtx.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, 32, 32);
  const faceData = faceCtx.getImageData(0, 0, 16, 16);
  return toGrayscaleVector(faceData, 16);
};

const normalizeAction = (action) => {
  if (!action || typeof action !== "object") return null;
  const type = action.type || action.action;
  if (!type) return null;
  if (type === "speak") {
    return { type: "speak", text: action.text || action.message || "" };
  }
  return {
    type,
    target: action.target || action.route || action.path,
    params: action.params || action.data || null,
    description: action.description
  };
};

const parseStructuredAction = (text) => {
  if (!text || typeof text !== "string") return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed.actions)) {
      const actions = parsed.actions.map(normalizeAction).filter(Boolean);
      return { actions, responseText: parsed.text || parsed.message || "" };
    }
    const single = normalizeAction(parsed);
    if (!single) return null;
    return { actions: [single], responseText: parsed.text || parsed.message || "" };
  } catch {
    return null;
  }
};

/**
 * Obtener respuesta programada básica (sin Gemini)
 */
function getBasicResponse(text) {
  const lowerText = text.toLowerCase();
  
  // Saludos
  if (/^(hola|buenos|hi|hey|saludos)/i.test(lowerText)) {
    return "¡Hola! Soy RAULI, tu asistente de la panadería. Puedo ayudarte con inventario, ventas, productos y caja. ¿Qué necesitas ahora?";
  }
  
  // Ayuda
  if (/ayuda|help|qué puedes/i.test(lowerText)) {
    return "Puedo ayudarte con:\n\n✅ **Navegación rápida:**\n- 'Abrir POS'\n- 'Ve a inventario'\n- 'Muestra productos'\n- 'Ir a ventas'\n\n✅ **Operación diaria:**\n- 'Stock de pan'\n- 'Ventas de hoy'\n- 'Productos más vendidos'\n\n💡 **IA avanzada:** activa Gemini en Configuración si quieres respuestas inteligentes.";
  }
  
  // Navegación
  if (/inventario|stock|almacen|harina|azucar|mantequilla|levadura/i.test(lowerText)) {
    return "✅ Te llevo a Inventario.";
  }
  if (/ventas|vender|pedidos|ordenes|cobrar|caja|pos/i.test(lowerText)) {
    return "✅ Te llevo a Ventas.";
  }
  if (/productos?|artículos?|items?|pan|dulce|pastel|torta|bizcocho|panetela/i.test(lowerText)) {
    return "✅ Te llevo a Productos.";
  }
  if (/contabilidad|contable|cuentas|asientos/i.test(lowerText)) {
    return "✅ Te llevo a Contabilidad.";
  }
  if (/compras|proveedores|adquisiciones/i.test(lowerText)) {
    return "✅ Te llevo a Compras.";
  }
  if (/reportes?|informes?|estadísticas/i.test(lowerText)) {
    return "✅ Te llevo a Reportes.";
  }
  if (/configuración|config|ajustes|settings/i.test(lowerText)) {
    return "✅ Te llevo a Configuración.";
  }
  if (/dashboard|inicio|home|panel/i.test(lowerText)) {
    return "✅ Te llevo al Dashboard.";
  }
  
  // Estado
  if (/estado|status|cómo está/i.test(lowerText)) {
    return "📊 **Estado del sistema:**\n- ✅ App: OK\n- ✅ Datos locales: OK\n- ⚠️ IA avanzada: depende de Gemini\n\nTodo listo para operar la panadería.";
  }
  
  // Respuesta genérica
  return "Entendido. Prueba con:\n- 'Abrir POS'\n- 'Ve a inventario'\n- 'Muestra productos'\n- 'Ventas de hoy'\n\n¿A dónde quieres ir?";
}

/**
 * Extraer acciones básicas del texto (sin Gemini)
 */
function extractBasicActions(text, navigate) {
  const lowerText = text.toLowerCase();
  const actions = [];
  
  if (/inventario|stock|almacen|harina|azucar|mantequilla|levadura/i.test(lowerText)) {
    actions.push({ execute: () => navigate("/inventory"), description: "Ir a inventario" });
  } else if (/pos|caja|cobrar|vender|ventas|pedido|orden/i.test(lowerText)) {
    actions.push({ execute: () => navigate("/pos"), description: "Abrir POS" });
  } else if (/ventas|vender|pedidos|ordenes/i.test(lowerText)) {
    actions.push({ execute: () => navigate("/sales"), description: "Ir a ventas" });
  } else if (/productos?|artículos?|items?|pan|dulce|pastel|torta|bizcocho|panetela/i.test(lowerText)) {
    actions.push({ execute: () => navigate("/products"), description: "Ir a productos" });
  } else if (/contabilidad|contable|cuentas|asientos/i.test(lowerText)) {
    actions.push({ execute: () => navigate("/accounting"), description: "Ir a contabilidad" });
  } else if (/compras|proveedores|adquisiciones/i.test(lowerText)) {
    actions.push({ execute: () => navigate("/compras"), description: "Ir a compras" });
  } else if (/reportes?|informes?|estadísticas/i.test(lowerText)) {
    actions.push({ execute: () => navigate("/reports"), description: "Ir a reportes" });
  } else if (/configuración|config|ajustes|settings/i.test(lowerText)) {
    actions.push({ execute: () => navigate("/settings"), description: "Ir a configuración" });
  } else if (/dashboard|inicio|home|panel/i.test(lowerText)) {
    actions.push({ execute: () => navigate("/dashboard"), description: "Ir al dashboard" });
  }
  
  return actions;
}

/**
 * RAULI ASSISTANT - Asistente Inteligente Conversacional
 * 
 * Características:
 * - Input por voz o texto
 * - Respuestas escritas (sin síntesis de voz)
 * - Integración con Gemini AI (opcional)
 * - Modo básico sin IA
 * - Capacidad de ejecutar acciones en el ERP
 * - Interfaz tipo Copilot/ChatGPT
 */
const ROUTE_TO_MODE = Object.fromEntries(
  Object.entries(MODE_TO_ROUTE).map(([k, v]) => [v, k])
);

export default function RauliAssistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline, pendingCount, lastSyncAt } = useRauli();

  // Estados
  const [profiles, setProfiles] = useState(() => {
    const stored = getProfiles();
    if (stored?.length) return stored;
    return DEFAULT_PROFILES_IMPORT;
  });
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "", role: "" });
  const [activeProfileId, setActiveProfileIdState] = useState(() => getActiveProfileId());
  const [messages, setMessages] = useState(() => {
    const stored = getStoredMessages(getActiveProfileId());
    if (stored?.length) return stored;
    return [
      {
        id: 1,
        role: "assistant",
        content: "¡Hola! Soy RAULI, tu asistente de la panadería. Puedo ayudarte con ventas, inventario, productos y caja.\n\n**Comandos rápidos:**\n- 'Abrir POS'\n- 'Ve a inventario'\n- 'Muestra productos'\n- 'Ventas de hoy'\n\n💡 *Si quieres respuestas inteligentes, activa Gemini en Configuración.*\n\n¿En qué puedo ayudarte?",
        timestamp: new Date()
      }
    ];
  });
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [showCameraInput, setShowCameraInput] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceMode, setFaceMode] = useState("scan");
  const [faceError, setFaceError] = useState("");
  const [autoFaceEnabled, setAutoFaceEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(getProfileStorageKey(getActiveProfileId(), "auto_face")) === "true";
  });
  const [faceCaptureStage, setFaceCaptureStage] = useState(0);
  const [faceFirstVector, setFaceFirstVector] = useState(null);
  const [assistantMode, setAssistantMode] = useState(() => {
    if (typeof window === "undefined") return "Operaciones";
    return localStorage.getItem(getProfileStorageKey(getActiveProfileId(), "mode")) || "Operaciones";
  });
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(getProfileStorageKey(getActiveProfileId(), "voice"));
    return stored === null ? true : stored === "true";
  });
  const [voiceRecognitionEnabled, setVoiceRecognitionEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(getProfileStorageKey(getActiveProfileId(), "voice_recognition")) === "true";
  });
  const [locationEnabled, setLocationEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(getProfileStorageKey(getActiveProfileId(), "location_enabled")) === "true";
  });
  const [locationStatus, setLocationStatus] = useState("");
  const [locationData, setLocationData] = useState(() => getStoredLocation(getActiveProfileId()));
  const [locationHistory, setLocationHistory] = useState(() => getStoredLocationHistory(getActiveProfileId()));
  const [showLocationHistory, setShowLocationHistory] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [sendBursts, setSendBursts] = useState([]);
  const [receiveWaves, setReceiveWaves] = useState([]);
  const [storageInfo, setStorageInfo] = useState({ used: 0, quota: 0, percentage: 0 });
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [voiceConfirmOpen, setVoiceConfirmOpen] = useState(false);
  const [voiceConfirmText, setVoiceConfirmText] = useState("");

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const handleSendMessageRef = useRef(null);
  const sendSoundRef = useRef(null);
  const receiveSoundRef = useRef(null);
  const voiceConfirmRequestedRef = useRef(false);

  // Hooks
  const voiceInput = useVoiceInput({
    lang: "es-ES",
    continuous: true,
    autoSend: true
  });

  const voiceSynthesis = useVoiceSynthesis({
    lang: "es-ES",
    rate: 1.12,
    pitch: 1,
    volume: 0.9
  });

  const cameraVision = useCameraVision({
    facingMode: "environment",
    resolution: "hd"
  });

  // Context dinámico para RAULI
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const activePermissions = activeProfile?.permissions || DEFAULT_PERMISSIONS;
  const rauliContext = RAULI_SYSTEM_PROMPT + "\n\n" + getRauliContext({
    currentRoute: window.location.pathname,
    userName: activeProfile?.name || "Jefe",
    companyName: "RAULI",
    isOnline,
    pendingCount
  }) + `\n\nModo actual: ${assistantMode}.`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    sendSoundRef.current = new Audio(createToneDataUrl(640, 0.035));
    receiveSoundRef.current = new Audio(createToneDataUrl(520, 0.045));
    sendSoundRef.current.volume = 0.2;
    receiveSoundRef.current.volume = 0.18;
  }, []);

  // Estados para gestión profesional de mensajes (temporalmente desactivado)
  // const [messagesPerPage] = useState(10);
  // const [currentPage, setCurrentPage] = useState(1);
  // const [showMessageOptions, setShowMessageOptions] = useState(false);
  // const [autoCleanup, setAutoCleanup] = useState(() => {
  //   if (typeof window === "undefined") return true;
  //   return localStorage.getItem(getProfileStorageKey(activeProfileId, "auto_cleanup")) !== "false";
  // });

  // // Sistema inteligente de limpieza de mensajes (temporalmente desactivado)
  // const cleanupMessages = useCallback((messagesToClean) => {
  //   if (!messagesToClean || !Array.isArray(messagesToClean)) return [];
  //   const cleaned = [...messagesToClean];
  //   const toRemove = [];
    
  //   // Eliminar mensajes duplicados consecutivos
  //   for (let i = cleaned.length - 1; i > 0; i--) {
  //     if (cleaned[i] && cleaned[i-1] && 
  //         cleaned[i].role === cleaned[i-1].role && 
  //         cleaned[i].content === cleaned[i-1].content) {
  //       toRemove.push(i);
  //     }
  //   }
    
  //   // Eliminar mensajes de sistema redundantes
  //   for (let i = cleaned.length - 1; i >= 0; i--) {
  //     const msg = cleaned[i];
  //     if (msg && msg.role === 'assistant' && msg.content && 
  //         (msg.content.includes('Entendido. Prueba con:') || 
  //          msg.content.includes('Configura una API Key'))) {
  //       // Mantener solo el último de este tipo
  //       const laterSameType = cleaned.slice(i + 1).find(m => 
  //         m && m.role === 'assistant' && m.content &&
  //         (m.content.includes('Entendido. Prueba con:') || 
  //          m.content.includes('Configura una API Key'))
  //       );
  //       if (laterSameType) {
  //         toRemove.push(i);
  //       }
  //     }
  //   }
    
  //   // Eliminar en orden inverso para no afectar índices
  //   toRemove.sort((a, b) => b - a).forEach(index => cleaned.splice(index, 1));
    
  //   return cleaned;
  // }, []);

  // // Mensajes paginados y limpios con seguridad (temporalmente desactivado)
  // const cleanedMessages = useMemo(() => {
  //   if (!messages || !Array.isArray(messages)) return [];
  //   const cleaned = autoCleanup ? cleanupMessages(messages) : messages;
  //   return cleaned || [];
  // }, [messages, autoCleanup, cleanupMessages]);

  // const paginatedMessages = useMemo(() => {
  //   if (!cleanedMessages || cleanedMessages.length === 0) return [];
  //   const startIndex = (currentPage - 1) * messagesPerPage;
  //   const endIndex = startIndex + messagesPerPage;
  //   return cleanedMessages.slice(startIndex, endIndex);
  // }, [cleanedMessages, currentPage, messagesPerPage]);

  // const totalPages = Math.max(1, Math.ceil((cleanedMessages?.length || 0) / messagesPerPage));

  // // Auto-scroll solo en última página (temporalmente desactivado)
  // const scrollToBottom = useCallback(() => {
  //   if (currentPage === totalPages) {
  //     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  //   }
  // }, [currentPage, totalPages]);

  // Auto-scroll simple
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!messages || !Array.isArray(messages)) return;
    
    const trimmed = messages.slice(-50).map((msg) => ({
      ...msg,
      timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString()
    }));
    localStorage.setItem(getProfileStorageKey(activeProfileId, "chat"), JSON.stringify(trimmed));
  }, [messages.length, activeProfileId]);

  // useEffect(() => {
  //   if (typeof window === "undefined") return;
  //   localStorage.setItem(getProfileStorageKey(activeProfileId, "auto_cleanup"), String(autoCleanup));
  // }, [autoCleanup]);

  // // Ir a última página cuando llega nuevo mensaje
  // useEffect(() => {
  //   const newTotalPages = Math.ceil(cleanedMessages.length / messagesPerPage);
  //   if (newTotalPages > totalPages) {
  //     setCurrentPage(newTotalPages);
  //   }
  // }, [cleanedMessages.length, messagesPerPage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(getProfileStorageKey(activeProfileId, "mode"), assistantMode);
  }, [assistantMode]);

  // Sincronizar modo con la ruta actual (p.ej. si se navega desde el sidebar)
  useEffect(() => {
    const mode = ROUTE_TO_MODE[location.pathname];
    if (mode && mode !== assistantMode) setAssistantMode(mode);
  }, [location.pathname, assistantMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(getProfileStorageKey(activeProfileId, "voice"), String(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(getProfileStorageKey(activeProfileId, "voice_recognition"), String(voiceRecognitionEnabled));
  }, [voiceRecognitionEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(getProfileStorageKey(activeProfileId, "auto_face"), String(autoFaceEnabled));
  }, [autoFaceEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(getProfileStorageKey(activeProfileId, "location_enabled"), String(locationEnabled));
  }, [locationEnabled]);

  useEffect(() => {
    if (!voiceRecognitionEnabled) {
      voiceInput.stopListening();
      return;
    }
    if (!voiceInput.isListening) {
      voiceInput.startListening();
    }
  }, [voiceRecognitionEnabled, voiceInput]);

  useEffect(() => {
    saveProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    if (!profiles.find((p) => p.id === activeProfileId)) {
      handleProfileChange(profiles[0]?.id || "default");
    }
  }, [profiles]);

  useEffect(() => {
    if (!autoFaceEnabled) return;
    const hasFace = profiles.some((profile) => getStoredFace(profile.id));
    if (!hasFace) return;
    setFaceMode("scan");
    setFaceCaptureStage(0);
    setFaceFirstVector(null);
    setShowFaceModal(true);
  }, [autoFaceEnabled, profiles]);

  useEffect(() => {
    if (!locationEnabled) {
      setLocationStatus("");
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus("Ubicacion no soportada");
      return;
    }

    setLocationStatus("Detectando ubicacion...");
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy || 0),
          timestamp: new Date().toISOString()
        };
        setLocationData(next);
        storeLocation(activeProfileId, next);
        storeLocationHistory(activeProfileId, next);
        setLocationHistory(getStoredLocationHistory(activeProfileId));
        setLocationStatus("Ubicacion activa");
      },
      (err) => {
        setLocationStatus(err.message || "Error de ubicacion");
      },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [locationEnabled, activeProfileId]);

  useEffect(() => {
    if (showCameraInput || showFaceModal) {
      cameraVision.startCamera();
    } else {
      cameraVision.stopCamera();
    }
  }, [showCameraInput, showFaceModal, cameraVision]);

  useEffect(() => {
    let mounted = true;
    const loadStorage = async () => {
      if (!navigator.storage?.estimate) {
        setStorageLoaded(true);
        return;
      }
      const estimate = await navigator.storage.estimate();
      if (!mounted) return;
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota ? (used / quota) * 100 : 0;
      setStorageInfo({ used, quota, percentage });
      setStorageLoaded(true);
    };
    loadStorage();
    const interval = window.setInterval(loadStorage, 60000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const triggerSendBurst = useCallback(() => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setSendBursts((prev) => [...prev, { id }]);
    setTimeout(() => {
      setSendBursts((prev) => prev.filter((burst) => burst.id !== id));
    }, 700);
  }, []);

  const triggerReceiveWave = useCallback(() => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setReceiveWaves((prev) => [...prev, { id }]);
    setTimeout(() => {
      setReceiveWaves((prev) => prev.filter((wave) => wave.id !== id));
    }, 900);
  }, []);

  // Procesar mensaje
  const handleSendMessage = useCallback(async (text) => {
    if (!text.trim() || isProcessing) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsProcessing(true);
    triggerSendBurst();
    tryPlaySound(sendSoundRef);

    try {
      let response = "";
      let actions = [];

      // Ruta rápida: comandos conocidos sin esperar IA (respuesta instantánea)
      const basicActions = extractBasicActions(text, navigate);
      const isBasicCommand = basicActions.length > 0 || /^(hola|buenos|hi|hey|saludos|ayuda|help|qué puedes|estado|status)/i.test(text.trim());
      if (isBasicCommand && basicActions.length >= 0) {
        response = getBasicResponse(text);
        actions = basicActions.length > 0 ? basicActions : [];
        if (response) {
          // Respuesta inmediata sin llamar IA
        }
      }

      if (!response && navigator.onLine) {
        const aiResult = await AIEngine.processText(text, rauliContext);
        response = aiResult?.text || "";

        const structured = parseStructuredAction(response);
        if (structured?.actions?.length) {
          actions = structured.actions;
          if (structured.responseText) {
            response = structured.responseText;
          }
        }

        if (!response || /configura una api key/i.test(response)) {
          response = getBasicResponse(text);
          if (actions.length === 0) actions = extractBasicActions(text, navigate);
        }

        if (actions.length === 0) {
          actions = extractActions(response);
          if (actions.length === 0) {
            actions = extractBasicActions(text, navigate);
          }
        }
      }

      if (!response && !navigator.onLine) {
        response = getBasicResponse(text);
        actions = extractBasicActions(text, navigate);
      }
      
      // Ejecutar acciones si hay
      if (actions.length > 0) {
        for (const action of actions) {
          if (!isActionAllowed(action, activePermissions)) {
            response = "No tienes permiso para ejecutar esa acción.";
            continue;
          }
          if (action.type === "speak" && action.text) {
            response = action.text;
            continue;
          }
          if (action.execute) {
            action.execute();
          } else {
            await executeAction(action, navigate);
          }
        }
      }

      // Agregar respuesta del asistente
      const assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: response,
        timestamp: new Date(),
        actions: actions.length > 0 ? actions : undefined
      };

      setMessages(prev => [...prev, assistantMessage]);
      triggerReceiveWave();
      tryPlaySound(receiveSoundRef);
      if (voiceEnabled) {
        voiceSynthesis.speak(response);
      }

    } catch (error) {
      console.error("Error procesando mensaje:", error);
      
      const fallbackText = "Entendido. Prueba con: Abrir POS, Ve a inventario, Ventas de hoy.";
      const fallbackMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: fallbackText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, fallbackMessage]);
      if (voiceEnabled) voiceSynthesis.speak(fallbackText);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, navigate, rauliContext, voiceEnabled, voiceSynthesis, activePermissions]);

  // Manejar envío de texto
  const handleTextSubmit = useCallback((e) => {
    e.preventDefault();
    handleSendMessage(inputText);
  }, [inputText, handleSendMessage]);

  // Actualizar ref de handleSendMessage
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // Manejar input de voz
  const requestVoiceConfirm = useCallback((text) => {
    const cleaned = String(text || "").trim();
    if (!cleaned || voiceConfirmOpen) return;
    voiceConfirmRequestedRef.current = true;
    setVoiceConfirmText(cleaned);
    setVoiceConfirmOpen(true);
  }, [voiceConfirmOpen]);

  const handleVoiceConfirmSend = useCallback(() => {
    const text = voiceConfirmText.trim();
    if (text && handleSendMessageRef.current) {
      handleSendMessageRef.current(text);
    }
    voiceConfirmRequestedRef.current = false;
    setVoiceConfirmOpen(false);
    setVoiceConfirmText("");
  }, [voiceConfirmText]);

  const handleVoiceConfirmEdit = useCallback(() => {
    setInputText(voiceConfirmText);
    voiceConfirmRequestedRef.current = false;
    setVoiceConfirmOpen(false);
    setVoiceConfirmText("");
    inputRef.current?.focus();
  }, [voiceConfirmText]);

  const handleVoiceConfirmCancel = useCallback(() => {
    voiceConfirmRequestedRef.current = false;
    setVoiceConfirmOpen(false);
    setVoiceConfirmText("");
  }, []);

  const sendFromVoice = useCallback((text) => {
    const cleaned = String(text || "").trim();
    if (!cleaned || !handleSendMessageRef.current) return;
    handleSendMessageRef.current(cleaned);
    setInputText("");
  }, []);

  const handleVoiceToggle = useCallback(() => {
    if (voiceInput.isListening) {
      voiceInput.stopListening();
      setShowVoiceInput(false);
      if (voiceInput.transcript) sendFromVoice(voiceInput.transcript);
    } else {
      voiceInput.startListening();
      setShowVoiceInput(true);
    }
  }, [voiceInput, sendFromVoice]);

  useEffect(() => {
    voiceInput.onComplete((fullText) => {
      if (!fullText) return;
      voiceInput.stopListening();
      setShowVoiceInput(false);
      sendFromVoice(fullText);
    });
  }, [voiceInput, sendFromVoice]);

  useEffect(() => {
    if (voiceInput.transcript && voiceInput.isListening && !voiceConfirmOpen) {
      setInputText(voiceInput.transcript);
    }
  }, [voiceInput.transcript, voiceInput.isListening, voiceConfirmOpen]);

  useEffect(() => {
    if (!voiceInput.isListening && showVoiceInput && voiceInput.transcript && !voiceConfirmRequestedRef.current) {
      setShowVoiceInput(false);
      sendFromVoice(voiceInput.transcript);
    }
  }, [voiceInput.isListening, showVoiceInput, voiceInput.transcript, sendFromVoice]);

  const handleProfileChange = useCallback((profileId) => {
    setActiveProfileIdState(profileId);
    setActiveProfileId(profileId);
    const storedMessages = getStoredMessages(profileId);
    setMessages(storedMessages?.length ? storedMessages : [
      {
        id: 1,
        role: "assistant",
        content: `Hola ${profiles.find((p) => p.id === profileId)?.name || "Jefe"}, ¿en qué te ayudo hoy?`,
        timestamp: new Date()
      }
    ]);
    setAssistantMode(localStorage.getItem(getProfileStorageKey(profileId, "mode")) || "Operaciones");
    setVoiceEnabled(localStorage.getItem(getProfileStorageKey(profileId, "voice")) === "true");
    setVoiceRecognitionEnabled(localStorage.getItem(getProfileStorageKey(profileId, "voice_recognition")) === "true");
    setLocationEnabled(localStorage.getItem(getProfileStorageKey(profileId, "location_enabled")) === "true");
    setLocationData(getStoredLocation(profileId));
    setLocationHistory(getStoredLocationHistory(profileId));
  }, [profiles]);

  const handleCameraToggle = useCallback(() => {
    setShowCameraInput((prev) => !prev);
  }, []);

  const handleCapturePhoto = useCallback(async () => {
    const imageData = cameraVision.capturePhoto();
    if (!imageData) return;

    setIsAnalyzingImage(true);
    setShowCameraInput(false);

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: "📷 Imagen capturada para análisis.",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    tryPlaySound(sendSoundRef);

    try {
      const response = await AIEngine.processVision(imageData.dataUrl, rauliContext);
      const assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: response?.text || "No pude analizar la imagen.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      tryPlaySound(receiveSoundRef);
    } catch (error) {
      console.error("Error analizando imagen:", error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: "No pude analizar la imagen. Intenta nuevamente.",
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsAnalyzingImage(false);
      cameraVision.clearCapturedImage();
    }
  }, [cameraVision, rauliContext]);

  const handleFaceAction = useCallback(async () => {
    setFaceError("");
    const imageData = cameraVision.capturePhoto();
    if (!imageData) {
      setFaceError("No se pudo capturar imagen.");
      return;
    }
    try {
      const vector = await buildFaceVector(imageData.dataUrl);
      if (!vector?.length) {
        setFaceError("No se pudo detectar el rostro.");
        return;
      }

      if (faceMode === "enroll") {
        storeFace(activeProfileId, vector);
        setShowFaceModal(false);
        setFaceError("");
        setFaceCaptureStage(0);
        setFaceFirstVector(null);
        return;
      }

      if (faceCaptureStage === 0) {
        setFaceFirstVector(vector);
        setFaceCaptureStage(1);
        setFaceError("Ahora mueve un poco la cabeza y captura de nuevo.");
        return;
      }

      const livenessScore = compareVectors(faceFirstVector, vector);
      if (livenessScore < 0.02) {
        setFaceError("No detecte movimiento. Intenta otra vez.");
        setFaceCaptureStage(0);
        setFaceFirstVector(null);
        return;
      }

      let bestMatch = null;
      let bestScore = 1;
      for (const profile of profiles) {
        const stored = getStoredFace(profile.id);
        if (!stored) continue;
        const score = compareVectors(vector, stored);
        if (score < bestScore) {
          bestScore = score;
          bestMatch = profile;
        }
      }

      if (bestMatch && bestScore < 0.35) {
        handleProfileChange(bestMatch.id);
        setShowFaceModal(false);
        setFaceError("");
        setFaceCaptureStage(0);
        setFaceFirstVector(null);
      } else {
        setFaceError("No reconoci el rostro. Intenta de nuevo.");
        setFaceCaptureStage(0);
        setFaceFirstVector(null);
      }
    } catch (err) {
      setFaceError("Error al procesar reconocimiento.");
    }
  }, [cameraVision, faceMode, profiles, activeProfileId, handleProfileChange, faceCaptureStage, faceFirstVector]);

  // Manejo profesional de acciones inteligentes
  const handleSmartAction = useCallback((action, event) => {
    event?.preventDefault();
    event?.stopPropagation();
    
    console.log('=== SMART ACTION TRIGGERED ===');
    console.log('Action:', action);
    console.log('handleSendMessageRef.current:', !!handleSendMessageRef.current);
    
    // 1. Enviar mensaje siempre (esto garantiza respuesta del asistente)
    if (action.text && handleSendMessageRef.current) {
      console.log('✅ Sending message:', action.text);
      handleSendMessageRef.current(action.text);
    } else {
      console.log('❌ Cannot send message - missing text or ref');
    }
    
    // 2. Navegación si tiene ruta diferente a la actual
    if (action.route && action.route !== window.location.pathname) {
      console.log('✅ Navigating to:', action.route);
      navigate(action.route);
    } else if (action.route) {
      console.log('ℹ️ Already on route:', action.route);
    }
    
    // 3. Actualizar input con referencia
    if (action.text) {
      console.log('✅ Updating input with:', action.text);
      setInputText(action.text);
    }
    
    console.log('=== SMART ACTION COMPLETED ===');
  }, [navigate]);

  const currentRouteActions = ROUTE_CONTEXT_ACTIONS[window.location.pathname] || [];

  const handleAddProfile = useCallback(() => {
    const name = prompt("Nombre del asistente/personal:");
    if (!name) return;
    const role = prompt("Rol (ej: Cajero, Inventario, Gerencia):") || "Operador";
    const id = `p_${Date.now().toString(36)}`;
    const next = [...profiles, { id, name, role, permissions: DEFAULT_PERMISSIONS }];
    setProfiles(next);
    handleProfileChange(id);
  }, [profiles, handleProfileChange]);

  const updateProfilePermissions = useCallback((profileId, changes) => {
    setProfiles((prev) => prev.map((profile) => (
      profile.id === profileId
        ? { ...profile, permissions: { ...profile.permissions, ...changes } }
        : profile
    )));
  }, []);

  const handleUpdateProfileNameRole = useCallback((profileId, { name, role }) => {
    setProfiles((prev) => prev.map((p) =>
      p.id === profileId ? { ...p, name: (name || p.name).trim(), role: (role ?? p.role).trim() } : p
    ));
    setEditingProfileId(null);
    setEditDraft({ name: "", role: "" });
  }, []);

  const handleStartEditProfile = useCallback((profile) => {
    setEditingProfileId(profile.id);
    setEditDraft({ name: profile.name, role: profile.role });
  }, []);

  const handleSaveEditProfile = useCallback(() => {
    if (!editingProfileId) return;
    const name = (editDraft.name || "").trim();
    const role = (editDraft.role || "").trim();
    if (name) handleUpdateProfileNameRole(editingProfileId, { name, role: role || "Operador" });
  }, [editingProfileId, editDraft, handleUpdateProfileNameRole]);

  const handleAddRoleInModal = useCallback(() => {
    const id = `p_${Date.now().toString(36)}`;
    const next = [...profiles, { id, name: "Nuevo rol", role: "Operador", permissions: DEFAULT_PERMISSIONS }];
    setProfiles(next);
    handleProfileChange(id);
    setEditingProfileId(id);
    setEditDraft({ name: "Nuevo rol", role: "Operador" });
  }, [profiles, handleProfileChange]);

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-2 sm:p-3">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.08)_1px,transparent_0)] bg-[length:18px_18px]" />
      </div>

      <motion.div
        className="relative flex flex-col h-full rounded-[28px] bg-white/5 border border-white/10 shadow-2xl shadow-black/40 backdrop-blur-xl overflow-hidden"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div
          className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-violet-500/10 via-cyan-500/5 to-fuchsia-500/10"
          animate={{ opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-900/70 via-slate-900/40 to-slate-900/70 border-b border-white/10 backdrop-blur-md overflow-hidden">
        <motion.div
          className="pointer-events-none absolute -inset-y-4 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-md"
          animate={{ x: ["-60%", "160%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Logo Robot */}
        <motion.div
          className="relative"
          animate={{
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-2xl bg-violet-500/30 blur-xl"
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.95, 1.1, 0.95] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <HiOutlineChip className="w-6 h-6 text-white" />
          </div>
          
          {/* Sparkle de IA */}
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.8, 1, 0.8]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <HiOutlineSparkles className="w-2.5 h-2.5 text-white" />
          </motion.div>
        </motion.div>

        {/* Título */}
        <div className="flex-1 min-w-[180px] max-w-full">
          <h2 className="text-white font-bold text-base">RAULI Assistant</h2>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-slate-400 text-xs">Asistente Inteligente con IA</p>
            <div className="hidden md:flex flex-wrap items-center gap-2">
              <span
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                  isOnline
                    ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/30"
                    : "bg-red-500/10 text-red-200 border-red-500/30"
                }`}
              >
                <span className="flex items-end gap-0.5">
                  <span className={`h-1 w-0.5 rounded-full ${isOnline ? "bg-emerald-300" : "bg-red-300/50"}`} />
                  <span className={`h-1.5 w-0.5 rounded-full ${isOnline ? "bg-emerald-300" : "bg-red-300/50"}`} />
                  <span className={`h-2 w-0.5 rounded-full ${isOnline ? "bg-emerald-300" : "bg-red-300/50"}`} />
                  <span className={`h-2.5 w-0.5 rounded-full ${isOnline ? "bg-emerald-300" : "bg-red-300/50"}`} />
                </span>
                {isOnline ? "ONLINE" : "OFFLINE"}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-200 border-slate-700/60">
                Cola: {pendingCount}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-200 border-slate-700/60">
                Sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : "N/A"}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-200 border-slate-700/60">
                Storage: {storageLoaded ? `${formatBytes(storageInfo.used)} / ${formatBytes(storageInfo.quota)} (${Math.round(storageInfo.percentage)}%)` : "…"}
              </span>
            </div>
            <div className="flex md:hidden items-center gap-2">
              <span
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                  isOnline
                    ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/30"
                    : "bg-red-500/10 text-red-200 border-red-500/30"
                }`}
              >
                <span className="flex items-end gap-0.5">
                  <span className={`h-1 w-0.5 rounded-full ${isOnline ? "bg-emerald-300" : "bg-red-300/50"}`} />
                  <span className={`h-1.5 w-0.5 rounded-full ${isOnline ? "bg-emerald-300" : "bg-red-300/50"}`} />
                  <span className={`h-2 w-0.5 rounded-full ${isOnline ? "bg-emerald-300" : "bg-red-300/50"}`} />
                  <span className={`h-2.5 w-0.5 rounded-full ${isOnline ? "bg-emerald-300" : "bg-red-300/50"}`} />
                </span>
                {isOnline ? "ON" : "OFF"}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-200 border-slate-700/60">
                Q: {pendingCount}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-200 border-slate-700/60">
                S: {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : "N/A"}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-200 border-slate-700/60">
                St: {storageLoaded ? `${Math.round(storageInfo.percentage)}%` : "…"}
              </span>
            </div>
          </div>
        </div>

        {/* Perfil activo */}
        <div className="hidden md:flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <select
            value={activeProfileId}
            onChange={(e) => handleProfileChange(e.target.value)}
            className="bg-white/10 border border-white/10 text-white text-xs rounded-lg px-2 py-1 max-w-full"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id} className="bg-slate-800 text-white">
                {profile.name} · {profile.role}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowRolesModal(true)}
            className="px-2 py-1 text-xs rounded-lg bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
            title="Editar nombres de roles y añadir nuevos"
          >
            Editar roles
          </button>
          <button
            type="button"
            onClick={handleAddProfile}
            className="px-2 py-1 text-xs rounded-lg bg-white/10 text-slate-200 hover:bg-white/20"
          >
            + Perfil
          </button>
          <button
            type="button"
            onClick={() => setAutoFaceEnabled((prev) => !prev)}
            className={`px-2 py-1 text-xs rounded-lg transition ${
              autoFaceEnabled ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-slate-200"
            }`}
          >
            Auto Face {autoFaceEnabled ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => setShowPermissionsModal(true)}
            className="px-2 py-1 text-xs rounded-lg bg-white/10 text-slate-200 hover:bg-white/20"
          >
            Permisos
          </button>
          <button
            type="button"
            onClick={() => setLocationEnabled((prev) => !prev)}
            className={`px-2 py-1 text-xs rounded-lg transition ${
              locationEnabled ? "bg-blue-500/20 text-blue-200" : "bg-white/10 text-slate-200"
            }`}
          >
            GPS {locationEnabled ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => setShowLocationHistory(true)}
            className="px-2 py-1 text-xs rounded-lg bg-white/10 text-slate-200 hover:bg-white/20"
          >
            Historial
          </button>
          <button
            type="button"
            onClick={() => {
              setFaceMode("scan");
              setShowFaceModal(true);
            }}
            className="px-2 py-1 text-xs rounded-lg bg-white/10 text-slate-200 hover:bg-white/20"
          >
            Face ID
          </button>
          <button
            type="button"
            onClick={() => {
              setFaceMode("enroll");
              setShowFaceModal(true);
            }}
            className="px-2 py-1 text-xs rounded-lg bg-white/10 text-slate-200 hover:bg-white/20"
          >
            Enrolar
          </button>
        </div>

        {/* Estado */}
        <div className="flex items-center gap-2 w-full xl:w-auto">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-xs text-slate-400">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Toggle voz */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setVoiceEnabled((prev) => !prev)}
          className={`ml-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            voiceEnabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-300"
          }`}
        >
          Voz {voiceEnabled ? "ON" : "OFF"}
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setVoiceRecognitionEnabled((prev) => !prev)}
          className={`ml-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            voiceRecognitionEnabled ? "bg-cyan-500/20 text-cyan-200" : "bg-white/10 text-slate-300"
          }`}
        >
          Escucha {voiceRecognitionEnabled ? "ON" : "OFF"}
        </motion.button>
      </div>

      {/* Navegación: usar menú lateral (Operaciones, Caja, Inventario, etc.) */}
      {locationEnabled && (
        <div className="px-4 py-2 text-[11px] text-slate-400 border-b border-white/10">
          {locationStatus || "Ubicacion activa"}
          {locationData?.lat && (
            <span className="ml-2">
              {locationData.lat}, {locationData.lng} ±{locationData.accuracy}m
            </span>
          )}
        </div>
      )}

      {/* Mensajes (temporalmente sin paginación) */}
      <div className="relative flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.08),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(217,70,239,0.08),transparent_40%),radial-gradient(circle_at_30%_80%,rgba(99,102,241,0.08),transparent_45%)]" />
        </motion.div>
        
        {/* Ondas de recepción */}
        <div className="pointer-events-none absolute left-4 bottom-6 h-20 w-20">
          <AnimatePresence>
            {receiveWaves.map((wave) => (
              <motion.div
                key={wave.id}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: [0, 0.8, 0], scale: [0.4, 1.2, 1.8] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                {RECEIVE_WAVE_STYLES.map((style, idx) => (
                  <div
                    key={`${wave.id}-${idx}`}
                    className={`absolute inset-0 rounded-full border border-white/10 ${style}`}
                  />
                ))}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Mensajes */}
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`relative max-w-[80%] rounded-2xl px-4 py-3 shadow-lg ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-violet-500/20'
                    : message.isError
                    ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                    : 'bg-white/10 border border-white/10 text-slate-100 backdrop-blur-md'
                }`}
              >
                {message.role === "assistant" && !message.isError && (
                  <motion.div
                    className="absolute left-3 right-3 top-1 h-0.5 rounded-full bg-gradient-to-r from-cyan-400/0 via-cyan-300/80 to-fuchsia-400/0"
                    animate={{ opacity: [0.2, 0.8, 0.2] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                
                {/* Acciones ejecutadas */}
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-2">Acciones ejecutadas:</p>
                    <div className="space-y-1">
                      {message.actions.map((action, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-cyan-400">
                          <HiOutlineSparkles className="w-3 h-3" />
                          <span>{action.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-300/80 mt-2">
                  {message.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Indicador de procesando */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <motion.div
                  className="flex gap-1"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="w-2 h-2 bg-violet-400 rounded-full" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full" />
                  <div className="w-2 h-2 bg-fuchsia-400 rounded-full" />
                </motion.div>
                <span className="text-sm text-slate-400">Pensando...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input de voz (modal) */}
      <AnimatePresence>
        {showVoiceInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => {
              voiceInput.stopListening();
              setShowVoiceInput(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700 max-w-md w-full mx-4"
            >
              <div className="text-center">
                {/* Animación de micrófono */}
                <motion.div
                  className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-6"
                  animate={{
                    scale: [1, 1.1, 1],
                    boxShadow: [
                      '0 0 20px rgba(6, 182, 212, 0.3)',
                      '0 0 40px rgba(6, 182, 212, 0.6)',
                      '0 0 20px rgba(6, 182, 212, 0.3)'
                    ]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <HiOutlineMicrophone className="w-12 h-12 text-white" />
                </motion.div>

                <p className="text-white font-semibold text-lg mb-2">Escuchando...</p>
                <p className="text-slate-400 text-sm mb-4">Habla ahora o haz click para cancelar</p>

                {/* Transcript en tiempo real */}
                {voiceInput.transcript && (
                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                    <p className="text-slate-200 text-sm">
                      {voiceInput.transcript}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input de cámara (modal) */}
      <AnimatePresence>
        {showCameraInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowCameraInput(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900/90 rounded-3xl p-6 shadow-2xl border border-white/10 max-w-2xl w-full mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Cámara</h3>
                <button
                  type="button"
                  className="text-slate-400 hover:text-white transition"
                  onClick={() => setShowCameraInput(false)}
                >
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                <video ref={cameraVision.videoRef} className="w-full h-80 object-cover" muted />
              </div>

              {cameraVision.error && (
                <p className="text-red-300 text-sm mt-3">{cameraVision.error}</p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={cameraVision.switchCamera}
                  className="text-xs text-slate-300 hover:text-white transition"
                  disabled={!cameraVision.isActive}
                >
                  Cambiar cámara
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCapturePhoto}
                  disabled={!cameraVision.isActive}
                  className="px-5 py-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Capturar y analizar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Face ID */}
      <AnimatePresence>
        {showFaceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowFaceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900/90 rounded-3xl p-6 shadow-2xl border border-white/10 max-w-lg w-full mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">
                  {faceMode === "enroll" ? "Enrolar rostro" : "Reconocer rostro"}
                </h3>
                <button
                  type="button"
                  className="text-slate-400 hover:text-white transition"
                  onClick={() => setShowFaceModal(false)}
                >
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                <video ref={cameraVision.videoRef} className="w-full h-64 object-cover" muted />
              </div>

              <p className="text-xs text-slate-400 mt-3">
                {faceMode === "enroll"
                  ? "Enrolar: mira al frente con buena luz."
                  : faceCaptureStage === 0
                  ? "Paso 1: mira al frente."
                  : "Paso 2: mueve un poco la cabeza y captura de nuevo."}
              </p>

              {faceError && (
                <p className="text-red-300 text-sm mt-3">{faceError}</p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowFaceModal(false)}
                  className="text-xs text-slate-300 hover:text-white transition"
                >
                  Cancelar
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleFaceAction}
                  disabled={!cameraVision.isActive}
                  className="px-5 py-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {faceMode === "enroll" ? "Guardar rostro" : "Reconocer"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Historial de Ubicacion */}
      <AnimatePresence>
        {showLocationHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowLocationHistory(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900/95 rounded-3xl p-6 shadow-2xl border border-white/10 max-w-xl w-full mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Historial de ubicación</h3>
                <button
                  type="button"
                  className="text-slate-400 hover:text-white transition"
                  onClick={() => setShowLocationHistory(false)}
                >
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>

              {locationHistory.length === 0 ? (
                <p className="text-sm text-slate-400">Sin datos todavía.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2 text-sm text-slate-300">
                  {locationHistory.map((loc, idx) => (
                    <div key={`${loc.timestamp}-${idx}`} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <span>
                        {loc.lat}, {loc.lng}
                      </span>
                      <span className="text-xs text-slate-400">
                        ±{loc.accuracy}m · {new Date(loc.timestamp).toLocaleString("es-CU")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Permisos por Perfil */}
      <AnimatePresence>
        {showPermissionsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowPermissionsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900/95 rounded-3xl p-6 shadow-2xl border border-white/10 max-w-2xl w-full mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Permisos por usuario</h3>
                <button
                  type="button"
                  className="text-slate-400 hover:text-white transition"
                  onClick={() => setShowPermissionsModal(false)}
                >
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {profiles.map((profile) => {
                  const perms = profile.permissions || DEFAULT_PERMISSIONS;
                  return (
                    <div key={profile.id} className="border border-white/10 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm text-white font-medium">{profile.name}</p>
                          <p className="text-xs text-slate-400">{profile.role}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-300 mb-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={perms.canNavigate}
                            onChange={(e) => updateProfilePermissions(profile.id, { canNavigate: e.target.checked })}
                          />
                          Navegar
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={perms.canQuery}
                            onChange={(e) => updateProfilePermissions(profile.id, { canQuery: e.target.checked })}
                          />
                          Consultar
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={perms.canCreate}
                            onChange={(e) => updateProfilePermissions(profile.id, { canCreate: e.target.checked })}
                          />
                          Crear
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={perms.canUpdate}
                            onChange={(e) => updateProfilePermissions(profile.id, { canUpdate: e.target.checked })}
                          />
                          Editar
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={perms.canDelete}
                            onChange={(e) => updateProfilePermissions(profile.id, { canDelete: e.target.checked })}
                          />
                          Eliminar
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={perms.canAnalyze}
                            onChange={(e) => updateProfilePermissions(profile.id, { canAnalyze: e.target.checked })}
                          />
                          Analizar
                        </label>
                      </div>

                      <div className="text-xs text-slate-400 mb-2">Acceso por pantalla:</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-300">
                        {ALL_ROUTES.map((route) => (
                          <label key={route} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={perms.allowedRoutes?.includes(route)}
                              onChange={(e) => {
                                const next = new Set(perms.allowedRoutes || []);
                                if (e.target.checked) next.add(route);
                                else next.delete(route);
                                updateProfilePermissions(profile.id, { allowedRoutes: Array.from(next) });
                              }}
                            />
                            {route}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Gestionar roles (editar nombre/subtítulo y añadir nuevos) */}
      <AnimatePresence>
        {showRolesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => { setShowRolesModal(false); setEditingProfileId(null); setEditDraft({ name: "", role: "" }); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900/95 rounded-3xl p-6 shadow-2xl border border-white/10 max-w-md w-full mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Gestionar roles</h3>
                <button
                  type="button"
                  className="text-slate-400 hover:text-white transition"
                  onClick={() => { setShowRolesModal(false); setEditingProfileId(null); setEditDraft({ name: "", role: "" }); }}
                >
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-4">Edita el nombre y el subtítulo de cada rol. Los cambios se guardan automáticamente. Puedes añadir nuevos roles para próximas incorporaciones.</p>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {profiles.map((profile) => (
                  <div key={profile.id} className="border border-white/10 rounded-xl p-3">
                    {editingProfileId === profile.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                          placeholder="Nombre (ej: Dueño, Cajero)"
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                        />
                        <input
                          type="text"
                          value={editDraft.role}
                          onChange={(e) => setEditDraft((d) => ({ ...d, role: e.target.value }))}
                          placeholder="Subtítulo (ej: Admin, Caja)"
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveEditProfile}
                            className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingProfileId(null); setEditDraft({ name: "", role: "" }); }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-white font-medium">{profile.name}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-sm text-slate-300">{profile.role}</span>
                        <button
                          type="button"
                          onClick={() => handleStartEditProfile(profile)}
                          className="p-1.5 rounded-lg bg-white/10 text-slate-400 hover:text-white hover:bg-white/20"
                          title="Editar nombre y rol"
                        >
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleAddRoleInModal}
                  className="w-full px-4 py-2 text-sm rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium"
                >
                  + Añadir rol (próximas incorporaciones)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmación de voz */}
      <AnimatePresence>
        {voiceConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={handleVoiceConfirmCancel}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900/95 rounded-3xl p-6 shadow-2xl border border-white/10 max-w-xl w-full mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Confirmación por voz</h3>
                <button
                  type="button"
                  className="text-slate-400 hover:text-white transition"
                  onClick={handleVoiceConfirmCancel}
                >
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-slate-300 mb-3">
                Esto fue reconocido por voz. Confirma o edita antes de ejecutar:
              </p>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 text-slate-100 text-sm whitespace-pre-wrap">
                {voiceConfirmText}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleVoiceConfirmSend}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg"
                >
                  Confirmar y enviar
                </button>
                <button
                  onClick={handleVoiceConfirmEdit}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg"
                >
                  Editar texto
                </button>
                <button
                  onClick={handleVoiceConfirmCancel}
                  className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel de Características Inteligentes */}
      <div className="px-4 py-3 bg-slate-900/50 border-t border-white/10 backdrop-blur-md flex-shrink-0">
        {/* Navegación Rápida */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Navegación</span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {console.log('🔘 Rendering navigation actions:', SMART_ACTIONS.navigation)}
            {SMART_ACTIONS.navigation.map((action) => (
              <motion.button
                key={action.label}
                type="button"
                onClick={(e) => {
                  console.log('🔘 Navigation button clicked:', action.label);
                  handleSmartAction(action, e);
                }}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="group relative px-3 py-2 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:border-violet-500/30 hover:from-violet-500/10 hover:to-violet-600/5 transition-all duration-200"
                title={action.description}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">{action.label.split(' ')[0]}</span>
                  <span className="text-xs text-slate-300 group-hover:text-violet-300 transition-colors">
                    {action.label.split(' ').slice(1).join(' ')}
                  </span>
                </div>
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-500/0 to-cyan-500/0 group-hover:from-violet-500/10 group-hover:to-cyan-500/5 transition-all duration-300" />
              </motion.button>
            ))}
          </div>
        </div>

        {/* Reportes y Análisis */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reportes</span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
          </div>
          <div className="flex flex-wrap gap-2">
            {console.log('📊 Rendering report actions:', SMART_ACTIONS.reports)}
            {SMART_ACTIONS.reports.map((action) => (
              <motion.button
                key={action.label}
                type="button"
                onClick={(e) => {
                  console.log('📊 Report button clicked:', action.label);
                  handleSmartAction(action, e);
                }}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-400/40 hover:from-emerald-500/20 hover:to-teal-500/15 transition-all duration-200"
                title={action.description}
              >
                <span className="text-xs font-medium text-emerald-200">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Operaciones Rápidas */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operaciones</span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
          </div>
          <div className="flex flex-wrap gap-2">
            {console.log('⚡ Rendering operation actions:', SMART_ACTIONS.operations)}
            {SMART_ACTIONS.operations.map((action) => (
              <motion.button
                key={action.label}
                type="button"
                onClick={(e) => {
                  console.log('⚡ Operation button clicked:', action.label);
                  handleSmartAction(action, e);
                }}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-400/40 hover:from-amber-500/20 hover:to-orange-500/15 transition-all duration-200"
                title={action.description}
              >
                <span className="text-xs font-medium text-amber-200">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Acciones Contextuales por Ruta */}
        {currentRouteActions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Acciones Actuales</span>
              <div className="flex-1 h-px bg-gradient-to-r from-violet-700/50 to-transparent" />
            </div>
            <div className="flex flex-wrap gap-2">
              {currentRouteActions.map((action) => (
                <motion.button
                  key={action.label}
                  type="button"
                  onClick={(e) => handleSmartAction(action, e)}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-400/30 hover:border-violet-300/50 hover:from-violet-500/30 hover:to-purple-500/25 transition-all duration-200"
                  title={action.description}
                >
                  <span className="text-xs font-medium text-violet-100">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input de texto */}
      <div className="px-4 py-2.5 bg-slate-900/50 border-t border-white/10 backdrop-blur-md flex-shrink-0">
        <form onSubmit={handleTextSubmit} className="relative flex items-end gap-3">
          <div className="pointer-events-none absolute right-2 bottom-2 h-16 w-16">
            <AnimatePresence>
              {sendBursts.map((burst) => (
                <motion.div key={burst.id} className="absolute inset-0">
                  {SEND_BURST_OFFSETS.map((offset, idx) => (
                    <motion.span
                      key={`${burst.id}-${idx}`}
                      className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-200/90 shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                      animate={{
                        x: offset.x,
                        y: offset.y,
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0]
                      }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  ))}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSubmit(e);
                }
              }}
              placeholder="Escribe o habla tu pregunta..."
              disabled={isProcessing}
              rows={1}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>

          {/* Botón enviar */}
          <motion.button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative group p-3 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white transition-all shadow-lg shadow-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="absolute inset-0 rounded-xl bg-violet-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <HiOutlinePaperAirplane className="relative z-10 w-5 h-5" />
          </motion.button>
        </form>

        <p className="text-xs text-slate-500 mt-2 text-center">
          Presiona Enter para enviar, Shift+Enter para nueva línea
        </p>
      </div>
      </motion.div>
    </div>
  );
}

// Función auxiliar para extraer acciones del texto de respuesta
function extractActions(text) {
  const actions = [];
  
  // Detectar comandos de navegación
  const navPatterns = {
    inventario: /(?:ir a|abrir|navegar a|acceder a|mostrar) (?:el |la )?inventario/i,
    ventas: /(?:ir a|abrir|navegar a|acceder a|mostrar) (?:el |la |las )?ventas?/i,
    compras: /(?:ir a|abrir|navegar a|acceder a|mostrar) (?:el |la |las )?compras?/i,
    contabilidad: /(?:ir a|abrir|navegar a|acceder a|mostrar) (?:el |la )?contabilidad/i,
    clientes: /(?:ir a|abrir|navegar a|acceder a|mostrar) (?:el |la |los )?clientes?/i,
    dashboard: /(?:ir a|abrir|navegar a|acceder a|mostrar) (?:el |la )?dashboard|panel|inicio/i
  };

  for (const [route, pattern] of Object.entries(navPatterns)) {
    if (pattern.test(text)) {
      actions.push({
        type: 'navigate',
        target: route,
        description: `Navegando a ${route}`
      });
    }
  }

  return actions;
}
