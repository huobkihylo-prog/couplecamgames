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
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#FAF7F2]/75 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white border border-[#EAE4DC] shadow-[0_8px_32px_rgba(31,36,45,0.1)] rounded-3xl px-6 py-5 max-w-xs w-full text-center space-y-3"
          >
            <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  background:
                    'conic-gradient(from 0deg, #FF6B57, #7C5CFC, #F59E0B, transparent 78%)',
                  maskImage: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)',
                  WebkitMaskImage:
                    'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)',
                }}
              />
              <Sparkles className="w-6 h-6 text-[#FF6B57]" />
            </div>
            <div className="space-y-1">
              <p
                className="text-base font-bold text-[#1F242D]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t.loadingDetectionTitle}
              </p>
              <p className="text-xs text-[#6B7280]">{t.loadingDetectionSub}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
