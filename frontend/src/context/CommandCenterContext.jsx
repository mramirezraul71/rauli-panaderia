import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

const CommandCenterContext = createContext({
  emit: () => {},
  on: () => () => {}
});

export const useCommandCenter = () => useContext(CommandCenterContext);

export function CommandCenterProvider({ children }) {
  const emit = useCallback((type, payload) => {
    window.dispatchEvent(new CustomEvent(`command:${type}`, { detail: payload || {} }));
  }, []);

  const on = useCallback((type, handler) => {
    const wrapped = (event) => handler(event.detail || {});
    window.addEventListener(`command:${type}`, wrapped);
    return () => window.removeEventListener(`command:${type}`, wrapped);
  }, []);

  const value = useMemo(() => ({ emit, on }), [emit, on]);

  useEffect(() => {
    return () => {};
  }, []);

  return (
    <CommandCenterContext.Provider value={value}>
      {children}
    </CommandCenterContext.Provider>
  );
}
