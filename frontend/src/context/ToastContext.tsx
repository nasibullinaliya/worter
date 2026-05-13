import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastType = 'error' | 'success' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// Module-level singleton — lets api/client.ts call toast without React context
let _showToast: ((message: string, type?: ToastType) => void) | null = null

export function toast(message: string, type: ToastType = 'error') {
  _showToast?.(message, type)
}

const BG: Record<ToastType, string> = {
  error: 'bg-red-600',
  success: 'bg-green-600',
  info: 'bg-gray-700',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++counter.current
    setToasts((prev) => [...prev.slice(-4), { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  _showToast = showToast

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 w-max max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg toast-slide-up ${BG[t.type]}`}
          >
            <span>{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-1 opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
