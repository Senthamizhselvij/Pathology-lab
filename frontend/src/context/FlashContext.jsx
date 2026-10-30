import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const FlashContext = createContext(null);

/** Replacement for PHP session flash messages: setFlash('success' | 'error' | 'info', text). */
export function FlashProvider({ children }) {
  const [flash, setFlashState] = useState(null);
  const timer = useRef(null);

  const clearFlash = useCallback(() => {
    clearTimeout(timer.current);
    setFlashState(null);
  }, []);

  const setFlash = useCallback((type, message) => {
    clearTimeout(timer.current);
    setFlashState({ type, message, id: Date.now() });
    timer.current = setTimeout(() => setFlashState(null), 5000); // auto-dismiss like the old app
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ flash, setFlash, clearFlash }), [flash, setFlash, clearFlash]);
  return <FlashContext.Provider value={value}>{children}</FlashContext.Provider>;
}

export const useFlash = () => useContext(FlashContext);
