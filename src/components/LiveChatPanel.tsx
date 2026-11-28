import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import type { QuickReactionEmoji, RoomChatMessage, RoomRole } from '../types/duoplay';
import { useI18n } from '../i18n/LanguageContext';

interface LiveChatPanelProps {
  messages: RoomChatMessage[];
  localRole: RoomRole;
  onSendMessage: (text: string) => Promise<void> | void;
  onSendReaction: (emoji: QuickReactionEmoji) => Promise<void> | void;
  variant?: 'inline' | 'drawer';
  onClose?: () => void;
}

const REACTIONS: QuickReactionEmoji[] = ['❤️', '😂', '🔥'];

export function LiveChatPanel({
  messages,
  localRole,
  onSendMessage,
  onSendReaction,
  variant = 'inline',
  onClose,
}: LiveChatPanelProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setDraft('');
    try {
      await onSendMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  const panelBody = (
    <div
      data-testid={variant === 'drawer' ? 'live-chat-drawer' : 'live-chat-panel'}
      className={`flex flex-col bg-white border border-[#EAE4DC] ${
        variant === 'drawer'
          ? 'h-full w-full max-w-sm rounded-s-3xl shadow-[0_20px_50px_rgba(31,36,45,0.22)]'
          : 'rounded-3xl shadow-[0_4px_20px_rgba(31,36,45,0.06)] h-[320px] sm:h-[360px]'
      } overflow-hidden`}
    >
      {/* Header + Quick Reactions */}
      <div className="shrink-0 px-4 py-3 border-b border-[#EAE4DC] bg-[#FFFDF9] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-full bg-[#FFE8E2] text-[#FF6B57] flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4" />
          </span>
          <h3 className="text-sm font-extrabold text-[#1F242D] truncate">{t.chatTitle}</h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              data-testid={`quick-reaction-${emoji === '❤️' ? 'heart' : emoji === '😂' ? 'laugh' : 'fire'}`}
              onClick={() => void onSendReaction(emoji)}
              aria-label={`Reaction ${emoji}`}
              className="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-[#FFE8E2] active:scale-90 border border-[#EAE4DC] text-sm flex items-center justify-center transition-all cursor-pointer"
            >
              {emoji}
            </button>
          ))}

          {variant === 'drawer' && onClose && (
            <button
              type="button"
              data-testid="close-chat-drawer"
              onClick={onClose}
              aria-label="Fermer le chat"
              className="ms-1 w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-[#F1ECE3] border border-[#EAE4DC] text-[#6B7280] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        data-testid="chat-messages-list"
        className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 space-y-2.5 bg-[#FAF7F2]/60"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-4">
            <p className="text-xs sm:text-sm font-medium text-[#6B7280]">{t.chatEmpty}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender === localRole;
            if (msg.kind === 'reaction') {
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#EAE4DC] shadow-xs text-xs font-semibold text-[#6B7280]">
                    <span className="truncate max-w-[100px]">{msg.senderName}</span>
                    <span className="text-base leading-none">{msg.text}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] font-bold text-[#6B7280] px-1.5 mb-0.5">
                  {msg.senderName}
                </span>
                <div
                  className={`max-w-[84%] px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-medium leading-snug break-words shadow-xs ${
                    isMine
                      ? 'bg-[#FF6B57] text-white rounded-ee-sm'
                      : 'bg-white text-[#1F242D] border border-[#EAE4DC] rounded-es-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 p-2.5 border-t border-[#EAE4DC] bg-white flex items-center gap-2"
      >
        <input
          type="text"
          data-testid="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={280}
          placeholder={t.chatPlaceholder}
          aria-label={t.chatPlaceholder}
          className="flex-1 min-w-0 min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC] text-xs sm:text-sm font-medium text-[#1F242D] placeholder-[#9CA3AF] focus:bg-white focus:border-[#FF6B57] focus:ring-2 focus:ring-[#FF6B57]/20 focus:outline-none transition-all"
        />
        <button
          type="submit"
          data-testid="chat-send-btn"
          disabled={!draft.trim() || sending}
          aria-label={t.chatSendBtn}
          className="min-h-[42px] px-3.5 rounded-xl bg-[#FF6B57] hover:bg-[#F25743] disabled:opacity-45 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{t.chatSendBtn}</span>
        </button>
      </form>
    </div>
  );

  if (variant === 'drawer') {
    return (
      <div
        className="fixed inset-0 z-50 flex justify-end bg-[#1F242D]/30 backdrop-blur-[2px]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        {panelBody}
      </div>
    );
  }

  return panelBody;
}
