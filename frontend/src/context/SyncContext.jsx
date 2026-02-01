/**
 * SYNC CONTEXT v3.0 - Simplified
 */

import { createContext, useContext, useState, useEffect } from "react";

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const value = {
    isOnline,
    pendingCount,
    isSyncing,
    sync: async () => {
      if (!isOnline) return;
      setIsSyncing(true);
      // Simulate sync
      await new Promise(r => setTimeout(r, 1000));
      setPendingCount(0);
      setIsSyncing(false);
    }
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    // Return default values if not in provider
    return {
      isOnline: navigator.onLine,
      pendingCount: 0,
      isSyncing: false,
      sync: async () => {}
    };
  }
  return context;
}

export default SyncContext;
