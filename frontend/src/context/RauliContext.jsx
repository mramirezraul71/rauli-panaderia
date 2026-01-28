import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCommandCenter } from "./CommandCenterContext";

const QUEUE_STORAGE_KEY = "genesis_rauli_command_queue";

const loadQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistQueue = (queue) => {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {}
};

const createId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const RauliContext = createContext({
  isOnline: true,
  isProcessing: false,
  pendingCount: 0,
  lastSyncAt: null,
  enqueueCommand: () => {},
  executeAction: () => {},
  registerAction: () => () => {},
  flushQueue: () => {}
});

export const useRauli = () => useContext(RauliContext);

export function RauliProvider({ children }) {
  const navigate = useNavigate();
  const { emit } = useCommandCenter();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queue, setQueue] = useState(() => loadQueue());
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const actionsRef = useRef(new Map());
  const queueRef = useRef(queue);

  useEffect(() => {
    queueRef.current = queue;
    persistQueue(queue);
  }, [queue]);

  const registerAction = useCallback((type, handler) => {
    if (!type || typeof handler !== "function") return () => {};
    actionsRef.current.set(type, handler);
    return () => actionsRef.current.delete(type);
  }, []);

  const executeAction = useCallback(async (action) => {
    if (!action) return;
    const type = action.type || action.action;
    const handler = actionsRef.current.get(type);
    if (handler) return handler(action.payload ?? action);
  }, []);

  const handleEntry = useCallback(
    async (entry) => {
      if (entry?.action) {
        await executeAction(entry.action);
        return;
      }
      if (entry?.type) {
        await executeAction(entry);
        return;
      }
      window.dispatchEvent(new CustomEvent("rauli:command", { detail: entry || {} }));
    },
    [executeAction]
  );

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = [...queueRef.current];
    if (pending.length === 0) return;
    setIsProcessing(true);
    for (const entry of pending) {
      await handleEntry(entry);
    }
    setQueue([]);
    setLastSyncAt(new Date().toISOString());
    setIsProcessing(false);
  }, [handleEntry]);

  const enqueueCommand = useCallback(
    (payload) => {
      const entry = {
        id: createId(),
        createdAt: new Date().toISOString(),
        status: "queued",
        ...payload
      };
      setQueue((prev) => {
        const next = [...prev, entry].slice(-120);
        return next;
      });
      if (navigator.onLine) {
        window.setTimeout(() => flushQueue(), 0);
      }
      return entry;
    },
    [flushQueue]
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushQueue]);

  useEffect(() => {
    const offNav = registerAction("NAVIGATE", ({ to }) => to && navigate(to));
    const offOpen = registerAction("OPEN_MODAL", ({ modal, payload }) => modal && emit(modal, payload));
    const offNavOpen = registerAction("NAVIGATE_AND_OPEN", ({ to, modal, payload, delay }) => {
      if (to) navigate(to);
      if (modal) {
        const wait = typeof delay === "number" ? delay : 320;
        window.setTimeout(() => emit(modal, payload), wait);
      }
    });
    const offMaps = registerAction("MAPS_TO", ({ to }) => to && navigate(to));
    const offCreate = registerAction("CREATE_USER", (payload) => emit("create-user", payload));
    const offCheck = registerAction("CHECK_INVENTORY", (payload) => emit("check-inventory", payload));
    return () => {
      offNav();
      offOpen();
      offNavOpen();
      offMaps();
      offCreate();
      offCheck();
    };
  }, [emit, navigate, registerAction]);

  const value = useMemo(
    () => ({
      isOnline,
      isProcessing,
      pendingCount: queue.length,
      lastSyncAt,
      enqueueCommand,
      executeAction,
      registerAction,
      flushQueue
    }),
    [enqueueCommand, executeAction, flushQueue, isOnline, isProcessing, lastSyncAt, queue.length, registerAction]
  );

  return <RauliContext.Provider value={value}>{children}</RauliContext.Provider>;
}
