import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  HiOutlineMicrophone, 
  HiOutlinePaperAirplane, 
  HiOutlineX,
  HiOutlineChip,
  HiOutlineSparkles,
  HiOutlineCamera
} from "react-icons/hi";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { useCameraVision } from "../../hooks/useCameraVision";
import { useVoiceSynthesis } from "../../hooks/useVoiceSynthesis";
import { useRauli } from "../../context/RauliContext";
import { RAULI_SYSTEM_PROMPT, getRauliContext } from "../../config/rauliPersonality";
import { executeAction } from "./actions";
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

const ASSISTANT_MODES = [
  "Operaciones",
  "Caja",
  "Inventario",
  "Produccion",
  "Compras",
  "Marketing",
  "Gerencia"
];

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

const QUICK_PROMPTS = [
  { label: "Abrir POS", text: "Abrir POS" },
  { label: "Ventas de hoy", text: "Ventas de hoy" },
  { label: "Stock harina", text: "Stock de harina" },
  { label: "Productos mas vendidos", text: "Productos mas vendidos" },
  { label: "Resumen del dia", text: "Resumen del dia" }
];

const ROUTE_PROMPTS = {
  "/pos": [
    { label: "Cobrar efectivo", text: "Cobrar en efectivo" },
    { label: "Cobrar tarjeta", text: "Cobrar con tarjeta" }
  ],
  "/inventory": [
    { label: "Stock bajo", text: "Stock bajo" },
    { label: "Entrada de lote", text: "Registrar entrada de lote" }
  ],
  "/products": [
    { label: "Crear producto", text: "Crear producto nuevo" },
    { label: "Buscar pan", text: "Buscar producto pan" }
  ],
  "/sales": [
    { label: "Ventas de hoy", text: "Ventas de hoy" }
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

const DEFAULT_PERMISSIONS = {
  canNavigate: true,
  canQuery: true,
  canCreate: true,
  canUpdate: true,
  canDelete: false,
  canAnalyze: true,
  allowedRoutes: [
    "/dashboard",
    "/pos",
    "/sales",
    "/products",
    "/inventory",
    "/customers",
    "/reports"
  ]
};

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
    actions.push({ execute: () => navigate("/purchases"), description: "Ir a compras" });
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
export default function RauliAssistant() {
  const navigate = useNavigate();
  const { isOnline, pendingCount, lastSyncAt } = useRauli();

  // Estados
  const [profiles, setProfiles] = useState(() => {
    const stored = getProfiles();
    if (stored?.length) return stored;
    return [
      { id: "owner", name: "Dueño", role: "Admin", permissions: OWNER_PERMISSIONS },
      { id: "cajero", name: "Cajero", role: "Caja", permissions: {
        ...DEFAULT_PERMISSIONS,
        canDelete: false,
        allowedRoutes: ["/dashboard", "/pos", "/sales", "/customers", "/cash"]
      }},
      { id: "inventario", name: "Inventario", role: "Stock", permissions: {
        ...DEFAULT_PERMISSIONS,
        allowedRoutes: ["/dashboard", "/inventory", "/products", "/reports"]
      }},
      { id: "produccion", name: "Produccion", role: "Horno", permissions: {
        ...DEFAULT_PERMISSIONS,
        allowedRoutes: ["/dashboard", "/produccion", "/inventory", "/products"]
      }},
      { id: "gerencia", name: "Gerencia", role: "Supervisor", permissions: {
        ...DEFAULT_PERMISSIONS,
        canDelete: false,
        allowedRoutes: ["/dashboard", "/sales", "/reports", "/expenses", "/products", "/inventory"]
      }}
    ];
  });
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
    if (typeof window === "undefined") return false;
    return localStorage.getItem(getProfileStorageKey(getActiveProfileId(), "voice")) === "true";
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
    rate: 1,
    pitch: 1,
    volume: 0.85
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

  // Auto-scroll al último mensaje
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const trimmed = messages.slice(-50).map((msg) => ({
      ...msg,
      timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString()
    }));
    localStorage.setItem(getProfileStorageKey(activeProfileId, "chat"), JSON.stringify(trimmed));
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(getProfileStorageKey(activeProfileId, "mode"), assistantMode);
  }, [assistantMode]);

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
      if (!navigator.storage?.estimate) return;
      const estimate = await navigator.storage.estimate();
      if (!mounted) return;
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota ? (used / quota) * 100 : 0;
      setStorageInfo({ used, quota, percentage });
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

      if (!navigator.onLine) {
        response = getBasicResponse(text);
        actions = extractBasicActions(text, navigate);
      } else {
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
        }

        if (actions.length === 0) {
          actions = extractActions(response);
          if (actions.length === 0) {
            actions = extractBasicActions(text, navigate);
          }
        }
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
      
      // Respuesta de fallback
      const fallbackMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: "Entendido. ¿Puedes ser más específico? Por ejemplo:\n- 'Ve a inventario'\n- 'Muestra ventas'\n- 'Abre contabilidad'\n- 'Ver productos'",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, navigate, rauliContext]);

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

  const handleVoiceToggle = useCallback(() => {
    if (voiceInput.isListening) {
      voiceInput.stopListening();
      setShowVoiceInput(false);
      
      // Si hay transcript, enviarlo
      if (voiceInput.transcript) {
        requestVoiceConfirm(voiceInput.transcript);
      }
    } else {
      voiceInput.startListening();
      setShowVoiceInput(true);
    }
  }, [voiceInput, requestVoiceConfirm]);

  useEffect(() => {
    voiceInput.onComplete((fullText) => {
      if (!fullText) return;
      voiceInput.stopListening();
      setShowVoiceInput(false);
      requestVoiceConfirm(fullText);
    });
  }, [voiceInput, requestVoiceConfirm]);

  // Actualizar input con transcript
  useEffect(() => {
    if (voiceInput.transcript && voiceInput.isListening && !voiceConfirmOpen) {
      setInputText(voiceInput.transcript);
    }
  }, [voiceInput.transcript, voiceInput.isListening, voiceConfirmOpen]);

  // Detener voz cuando termina
  useEffect(() => {
    if (!voiceInput.isListening && showVoiceInput && voiceInput.transcript && !voiceConfirmRequestedRef.current) {
      setShowVoiceInput(false);
      requestVoiceConfirm(voiceInput.transcript);
    }
  }, [voiceInput.isListening, showVoiceInput, voiceInput.transcript, requestVoiceConfirm]);

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

  const handleQuickPrompt = useCallback((text) => {
    if (handleSendMessageRef.current) {
      handleSendMessageRef.current(text);
    }
  }, []);

  const currentRoutePrompts = ROUTE_PROMPTS[window.location.pathname] || [];

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

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
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
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-slate-900/70 via-slate-900/40 to-slate-900/70 border-b border-white/10 backdrop-blur-md overflow-hidden">
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <HiOutlineChip className="w-7 h-7 text-white" />
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
        <div className="flex-1 min-w-[220px] max-w-full">
          <h2 className="text-white font-bold text-lg">RAULI Assistant</h2>
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
                Storage: {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.quota)} ({Math.round(storageInfo.percentage)}%)
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
                St: {Math.round(storageInfo.percentage)}%
              </span>
            </div>
          </div>
        </div>

        {/* Perfil activo */}
        <div className="hidden md:flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <select
            value={activeProfileId}
            onChange={(e) => handleProfileChange(e.target.value)}
            className="bg-white/10 border border-white/10 text-slate-200 text-xs rounded-lg px-2 py-1 max-w-full"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} · {profile.role}
              </option>
            ))}
          </select>
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

      {/* Modos de trabajo */}
      <div className="px-6 py-3 bg-slate-900/40 border-b border-white/10">
        <div className="flex flex-wrap gap-2">
          {ASSISTANT_MODES.map((mode) => (
            <motion.button
              key={mode}
              type="button"
              onClick={() => setAssistantMode(mode)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                assistantMode === mode
                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/30"
                  : "bg-white/10 text-slate-300 hover:bg-white/15"
              }`}
            >
              {mode}
            </motion.button>
          ))}
        </div>
        {locationEnabled && (
          <div className="mt-2 text-[11px] text-slate-400">
            {locationStatus || "Ubicacion activa"}
            {locationData?.lat && (
              <span className="ml-2">
                {locationData.lat}, {locationData.lng} ±{locationData.accuracy}m
              </span>
            )}
            {locationHistory.length > 0 && (
              <span className="ml-2">
                Historial: {locationHistory.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mensajes */}
      <div className="relative flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.08),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(217,70,239,0.08),transparent_40%),radial-gradient(circle_at_30%_80%,rgba(99,102,241,0.08),transparent_45%)]" />
        </motion.div>
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

      {/* Input */}
      <div className="px-6 py-4 bg-slate-900/50 border-t border-white/10 backdrop-blur-md">
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_PROMPTS.map((prompt) => (
            <motion.button
              key={prompt.label}
              type="button"
              onClick={() => handleQuickPrompt(prompt.text)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="px-3 py-1.5 rounded-full text-xs text-slate-200 bg-white/10 hover:bg-white/15 transition"
            >
              {prompt.label}
            </motion.button>
          ))}
          {currentRoutePrompts.map((prompt) => (
            <motion.button
              key={prompt.label}
              type="button"
              onClick={() => handleQuickPrompt(prompt.text)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="px-3 py-1.5 rounded-full text-xs text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 transition"
            >
              {prompt.label}
            </motion.button>
          ))}
        </div>
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
                      transition={{ duration: 0.6, delay: idx * 0.02, ease: "easeOut" }}
                    />
                  ))}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {/* Botón de voz */}
          <motion.button
            type="button"
            onClick={handleVoiceToggle}
            disabled={isProcessing}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative group p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              voiceInput.isListening
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                : 'bg-white/10 hover:bg-white/15 text-slate-200'
            }`}
          >
            <span className="absolute inset-0 rounded-xl bg-cyan-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <HiOutlineMicrophone className="relative z-10 w-5 h-5" />
          </motion.button>

          {/* Botón de cámara */}
          <motion.button
            type="button"
            onClick={handleCameraToggle}
            disabled={isProcessing || isAnalyzingImage}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative group p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              showCameraInput
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white/10 hover:bg-white/15 text-slate-200'
            }`}
          >
            <span className="absolute inset-0 rounded-xl bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <HiOutlineCamera className="relative z-10 w-5 h-5" />
          </motion.button>

          {/* Input de texto */}
          <div className="flex-1">
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
