import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';

interface MediaPipeLoadingOverlayProps {
  visible: boolean;
}

export function MediaPipeLoadingOverlay({ visible }: MediaPipeLoadingOverlayProps) {
  const { t } = useI18n();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="mediapipe-loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#120E24]/55 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="glass-panel rounded-3xl px-6 py-5 max-w-xs w-full text-center space-y-3"
          >
            <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  background:
                    'conic-gradient(from 0deg, #7C3AED, #FF4D8D, #38BDF8, transparent 78%)',
                  maskImage: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)',
                  WebkitMaskImage:
                    'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)',
                }}
              />
              <Sparkles className="w-6 h-6 text-[#38BDF8]" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                {t.loadingDetectionTitle}
              </p>
              <p className="text-xs text-white/75">{t.loadingDetectionSub}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
