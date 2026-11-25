import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, Sparkles } from 'lucide-react';

export interface AppToast {
  id: number;
  message: string;
  tone?: 'success' | 'info' | 'accent';
}

interface ToastStackProps {
  toasts: AppToast[];
}

export function ToastStack({ toasts }: ToastStackProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 inset-x-3 sm:inset-x-auto sm:end-5 sm:bottom-5 z-50 flex flex-col items-center sm:items-end gap-2"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            data-testid="app-toast"
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto max-w-sm w-full sm:w-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#1A1533]/92 backdrop-blur-xl border border-white/20 text-white text-sm font-medium shadow-xl shadow-[#7C3AED]/25"
          >
            {toast.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
            ) : toast.tone === 'accent' ? (
              <Sparkles className="w-4 h-4 text-[#FF4D8D] shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-[#38BDF8] shrink-0" />
            )}
            <span className="leading-snug">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
