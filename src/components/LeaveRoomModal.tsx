import { LogOut } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';

interface LeaveRoomModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Cream & Soft Pastel in-app confirmation modal for leaving a room.
 * Replaces native browser `window.confirm` so players never leave accidentally.
 */
export function LeaveRoomModal({ open, onCancel, onConfirm }: LeaveRoomModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-room-modal-title"
      data-testid="leave-room-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F242D]/40 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white border border-[#EAE4DC] shadow-[0_20px_54px_rgba(31,36,45,0.20)] p-6 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] flex items-center justify-center">
          <LogOut className="w-5 h-5" />
        </div>

        <div className="space-y-1.5">
          <h2 id="leave-room-modal-title" className="text-lg font-extrabold text-[#1F242D]">
            {t.leaveConfirmTitle}
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed">
            {t.leaveConfirmBody}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            data-testid="leave-room-cancel-btn"
            onClick={onCancel}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl text-sm font-bold bg-[#FAF7F2] hover:bg-[#F1ECE3] text-[#1F242D] border border-[#EAE4DC] transition-colors cursor-pointer"
          >
            {t.leaveConfirmCancel}
          </button>
          <button
            type="button"
            data-testid="leave-room-confirm-btn"
            onClick={onConfirm}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl text-sm font-extrabold bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-sm transition-colors cursor-pointer"
          >
            {t.leaveConfirmConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
