import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  onUndo?: () => void;
}

interface ToastApi {
  /** Mostra um aviso rápido; se onUndo for passado, exibe "Desfazer". */
  show: (message: string, onUndo?: () => void) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DURACAO = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, onUndo?: () => void) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, message, onUndo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), DURACAO);
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="toast pointer-events-auto">
            <span>{t.message}</span>
            {t.onUndo && (
              <button
                className="-my-1 rounded-[var(--radius-sm)] px-2 py-1 font-semibold text-[var(--color-serges-blue-strong)] transition-colors duration-150 hover:bg-[var(--color-serges-blue-tint-soft)]"
                onClick={() => {
                  t.onUndo?.();
                  dismiss(t.id);
                }}
              >
                Desfazer
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
