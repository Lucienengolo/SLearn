import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { isOfflineModeEnabled, setOfflineModeEnabled as persistOfflineModeEnabled } from '../lib/offlineMode';

type OfflineContextType = {
  isOnline: boolean;
  offlineModeEnabled: boolean;
  setOfflineModeEnabled: (enabled: boolean) => void;
};

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

// Tracks two independent things (founder request, 2026-08-01):
// - isOnline: real browser connectivity, via navigator.onLine + the
//   'online'/'offline' window events. Nobody opts into this -- it's just
//   observed.
// - offlineModeEnabled: the user's own opt-in preference (persisted via
//   lib/offlineMode.ts, device-local). The banner and any action-gating
//   only kick in when BOTH are true -- a user who never turned this on
//   sees no behavior change at all if their connection drops.
export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [offlineModeEnabled, setOfflineModeEnabledState] = useState(() => isOfflineModeEnabled());

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

  const setOfflineModeEnabled = (enabled: boolean) => {
    persistOfflineModeEnabled(enabled);
    setOfflineModeEnabledState(enabled);
  };

  return (
    <OfflineContext.Provider value={{ isOnline, offlineModeEnabled, setOfflineModeEnabled }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOfflineStatus() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOfflineStatus must be used within an OfflineProvider');
  }
  return context;
}
