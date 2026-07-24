import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
type Toast = { id: string; message: string; type: ToastType };

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_STYLES: Record<ToastType, { bg: string; text: string; Icon: typeof CheckCircle }> = {
  success: { bg: 'bg-green-50 border-green-200', text: 'text-green-800', Icon: CheckCircle },
  error: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', Icon: XCircle },
  info: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-800', Icon: Info },
};

const AUTO_DISMISS_MS = 5000;

// Replaces browser alert()/confirm() (found in CourseDetail.tsx and
// InstructorDashboard.tsx) with an in-app, dismissible, non-blocking
// notification -- native dialogs freeze the tab and don't match any app's
// design system, a real "not modern by standards" gap the founder flagged.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:max-w-sm sm:w-full"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              className={`flex items-start gap-2.5 rounded-[10px] border shadow-lg p-3.5 ${style.bg}`}
            >
              <style.Icon size={18} className={`flex-shrink-0 mt-0.5 ${style.text}`} />
              <p className={`flex-1 text-sm ${style.text}`}>{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className={`flex-shrink-0 hover:opacity-70 transition ${style.text}`}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
