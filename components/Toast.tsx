'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, AlertCircle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'error';
  title: string;
  subtitle?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ duration: 0.2 }}
            onClick={() => onDismiss(toast.id)}
            className="pointer-events-auto cursor-pointer flex items-start gap-3 p-3.5 bg-canvas/95 backdrop-blur-md border border-ink/15 rounded-2xl shadow-card"
          >
            <div className="flex-none p-1.5 rounded-xl bg-surface border border-border/60">
              {toast.type === 'success' && <Check className="w-4 h-4 text-emerald-600" />}
              {toast.type === 'info' && <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs font-medium text-ink tracking-tight">{toast.title}</p>
              {toast.subtitle && (
                <p className="text-[11px] text-muted tracking-tight mt-0.5 truncate">
                  {toast.subtitle}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
