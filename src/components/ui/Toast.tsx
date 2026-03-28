import * as React from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const addToast = React.useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    [],
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 sm:max-w-sm z-50 flex flex-col gap-3" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

interface ToastProps extends ToastItem {
  onClose: () => void;
}

function Toast({ type, message, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = React.useState(false);

  const handleClose = React.useCallback(() => {
    setIsExiting(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
  };

  const styles: Record<ToastType, { bg: string; icon: string; border: string }> = {
    success: {
      bg: "bg-success/10",
      icon: "text-success",
      border: "border-success/20",
    },
    error: {
      bg: "bg-error/10",
      icon: "text-error",
      border: "border-error/20",
    },
    info: {
      bg: "bg-primary/10",
      icon: "text-primary",
      border: "border-primary/20",
    },
    warning: {
      bg: "bg-warning/10",
      icon: "text-warning",
      border: "border-warning/20",
    },
  };

  const { bg, icon, border } = styles[type];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-lg backdrop-blur-sm",
        "transition-all duration-200",
        isExiting
          ? "opacity-0 translate-x-4"
          : "animate-in slide-in-from-right-full",
        bg,
        border,
      )}
    >
      <span className={cn(icon, "shrink-0")}>{icons[type]}</span>
      <p className="flex-1 text-sm font-medium text-foreground">{message}</p>
      <button
        onClick={handleClose}
        className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors shrink-0"
        aria-label="Close"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
