import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Copy, Link2, Loader2, Play, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ConnectionStatus, GameId } from '../types/duoplay';
import { normalizeRoomCode } from '../services/peerService';
import { buildRoomShareUrl, copyTextToClipboard } from '../utils/clipboard';
import { useI18n } from '../i18n/LanguageContext';
import { DuoLogo } from './DuoLogo';
import { LanguageSwitcher } from './LanguageSwitcher';

const LOBBY_BG_SRC = '/src/assets/images/lobby_backdrop_1795451798465.jpg';

const LOBBY_GAME_ORDER: { id: GameId; num: string }[] = [
  { id: 'laugh', num: '01' },
  { id: 'stare-duel', num: '02' },
  { id: 'miam-mania', num: '03' },
  { id: 'funambules', num: '04' },
  { id: 'ninja-fruits', num: '05' },
  { id: 'air-hockey', num: '06' },
  { id: 'kiss-bounce', num: '07' },
  { id: 'constellations', num: '08' },
];

interface LobbyViewProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  roomCode: string;
  initialJoinCode?: string;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  cameraHint: string | null;
  onCreateRoom: () => void;
  onCancelRoom: () => void;
  onJoinRoom: (code: string) => void;
  onStartSoloMode: () => void;
}

export function LobbyView({
  playerName,
  onPlayerNameChange,
  roomCode,
  initialJoinCode = '',
  connectionStatus,
  statusMessage,
  cameraHint,
  onCreateRoom,
  onCancelRoom,
  onJoinRoom,
  onStartSoloMode,
}: LobbyViewProps) {
  const { t } = useI18n();
  const [joinCodeInput, setJoinCodeInput] = useState(() => normalizeRoomCode(initialJoinCode));
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(() =>
    normalizeRoomCode(initialJoinCode).length === 4 ? 'join' : 'create',
  );
  const [copiedMode, setCopiedMode] = useState<'none' | 'code' | 'link'>('none');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const clean = normalizeRoomCode(initialJoinCode);
    if (clean.length === 4) {
      setJoinCodeInput(clean);
      setActiveTab('join');
    }
  }, [initialJoinCode]);

  const isWaitingHost = connectionStatus === 'creating' || connectionStatus === 'waiting';
  const isJoining = connectionStatus === 'connecting';

  const handleCopyCode = async () => {
    if (!roomCode) return;
    const ok = await copyTextToClipboard(roomCode);
    if (ok) {
      setCopiedMode('code');
      window.setTimeout(() => setCopiedMode((prev) => (prev === 'code' ? 'none' : prev)), 2000);
    }
  };

  const handleCopyShareLink = async () => {
    if (!roomCode) return;
    const shareUrl = buildRoomShareUrl(roomCode);
    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setCopiedMode('link');
      window.setTimeout(() => setCopiedMode((prev) => (prev === 'link' ? 'none' : prev)), 2000);
    }
  };

  const handleCreateSubmit = () => {
    const trimmed = playerName.trim();
    if (!trimmed) {
      setFormError(t.errEnterNameCreate);
      return;
    }
    setFormError(null);
    onCreateRoom();
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = playerName.trim();
    if (!trimmed) {
      setFormError(t.errEnterNameJoin);
      return;
    }
    const cleanCode = normalizeRoomCode(joinCodeInput);
    if (cleanCode.length !== 4) {
      setFormError(t.errInvalidCode);
      return;
    }
    setFormError(null);
    onJoinRoom(cleanCode);
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#0D0F17] flex flex-col justify-center px-4 py-6 sm:px-8">
      {/* Bespoke Parisian twilight parlor illustration backdrop */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <img
          src={LOBBY_BG_SRC}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D0F17]/95 via-[#0D0F17]/78 to-[#0D0F17]/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0F17] via-transparent to-[#0D0F17]/50" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto space-y-6">
        {/* Clean top bar: Logo + Language Switcher */}
        <header className="flex items-center justify-between gap-3">
          <DuoLogo size="lg" />
          <LanguageSwitcher />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left editorial hero column */}
          <section className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-5xl font-semibold leading-[1.12] tracking-tight text-[#F6F2E9]">
                {t.lobbyHeadline}
              </h1>
              <p className="text-base sm:text-lg text-[#CBC4B6] leading-relaxed max-w-xl">
                {t.lobbySubtitlePrefix}
                <strong className="text-[#F6F2E9] font-medium">{t.lobbySubtitleStrong}</strong>
                {t.lobbySubtitleSuffix}
              </p>
            </div>

            <p className="text-xs sm:text-sm text-[#A9A295] pt-1">{t.lobbySpecs}</p>

            {/* Primary instant solo test CTA */}
            <div className="pt-2 space-y-5">
              <div>
                <button
                  type="button"
                  data-start="true"
                  onClick={() => {
                    setFormError(null);
                    onStartSoloMode();
                  }}
                  className="group inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm sm:text-base font-semibold bg-[#E86A58] text-[#0D0F17] hover:bg-[#F08272] transition-all duration-200 shadow-lg shadow-[#E86A58]/20 whitespace-nowrap"
                >
                  <Play className="w-4 h-4 shrink-0" />
                  <span>{t.soloCta}</span>
                  <ArrowRight className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                </button>
                <p className="text-xs text-[#A9A295] mt-2.5">{t.soloHint}</p>
              </div>

              <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-x-4 gap-y-3 max-w-lg text-xs text-[#CBC4B6]">
                {LOBBY_GAME_ORDER.map((item) => {
                  const g = t.games[item.id];
                  return (
                    <div key={item.id} className="min-w-0">
                      <p className="font-semibold text-[#F6F2E9] truncate">
                        {item.num}. {g.title}
                      </p>
                      <p className="text-[#A9A295] mt-0.5 truncate">{g.shortDesc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Right connection card */}
          <section className="lg:col-span-6">
            <div className="rounded-2xl bg-[#141724]/92 border border-white/12 ring-1 ring-inset ring-white/6 p-6 sm:p-8 shadow-2xl">
              <div className="space-y-5">
                {/* Name input */}
                <div>
                  <label
                    htmlFor="couplecam-player-name"
                    className="block text-sm font-medium text-[#F6F2E9] mb-2"
                  >
                    {t.yourNameLabel}
                  </label>
                  <input
                    id="couplecam-player-name"
                    type="text"
                    maxLength={24}
                    value={playerName}
                    onChange={(e) => {
                      onPlayerNameChange(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder={t.yourNamePlaceholder}
                    className="w-full px-4 py-3 rounded-xl bg-[#0D0F17] border border-white/15 text-[#F6F2E9] placeholder-[#6E6A63] text-base focus:border-[#E8B861] focus:outline-none transition-colors duration-150"
                  />
                </div>

                {/* Segmented Host / Guest tabs with fluid sliding highlight */}
                <div
                  className="relative grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0D0F17] border border-white/10"
                  role="tablist"
                  aria-label="Room mode"
                >
                  {(
                    [
                      { id: 'create', label: t.tabCreate },
                      { id: 'join', label: t.tabJoin },
                    ] as const
                  ).map((tab) => {
                    const selected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setFormError(null);
                        }}
                        className={`relative z-10 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
                          selected ? 'text-[#F6F2E9]' : 'text-[#A9A295] hover:text-[#F6F2E9]'
                        }`}
                      >
                        {selected && (
                          <motion.span
                            layoutId="couplecam-lobby-tab"
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-0 -z-10 rounded-lg bg-[#232940] border border-white/10"
                          />
                        )}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab body with fluid crossfade */}
                <AnimatePresence mode="wait" initial={false}>
                  {activeTab === 'create' ? (
                    <motion.div
                      key="tab-create"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-4"
                    >
                      {!isWaitingHost ? (
                        <>
                          <p className="text-sm text-[#CBC4B6] leading-relaxed">{t.createDesc}</p>
                          <button
                            type="button"
                            onClick={handleCreateSubmit}
                            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm sm:text-base font-semibold bg-[#F6F2E9] text-[#0D0F17] hover:bg-white transition-colors duration-150 whitespace-nowrap"
                          >
                            <Users className="w-4 h-4 shrink-0" />
                            <span>{t.createBtn}</span>
                          </button>
                        </>
                      ) : (
                        <div className="space-y-4 pt-1">
                          <div className="rounded-xl bg-[#0D0F17] border border-[#E8B861]/35 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs text-[#A9A295]">{t.shareCodeLabel}</p>
                                <p
                                  dir="ltr"
                                  data-testid="host-room-code"
                                  className="font-mono text-3xl font-bold tracking-[0.22em] text-[#E8B861] tabular-nums mt-0.5"
                                >
                                  {roomCode}
                                </p>
                              </div>
                              <button
                                type="button"
                                data-testid="copy-room-code"
                                onClick={handleCopyCode}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-[#E8B861]/15 text-[#F2CB80] border border-[#E8B861]/35 hover:bg-[#E8B861]/25 transition-colors whitespace-nowrap shrink-0"
                              >
                                {copiedMode === 'code' ? (
                                  <Check className="w-4 h-4 text-[#5CC29F]" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                                <span>{copiedMode === 'code' ? t.codeCopiedBtn : t.copyCodeBtn}</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              data-testid="copy-share-link"
                              onClick={handleCopyShareLink}
                              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium bg-white/6 hover:bg-white/12 text-[#F6F2E9] border border-white/10 transition-colors whitespace-nowrap"
                            >
                              {copiedMode === 'link' ? (
                                <Check className="w-4 h-4 text-[#5CC29F]" />
                              ) : (
                                <Link2 className="w-4 h-4 text-[#E8B861]" />
                              )}
                              <span>
                                {copiedMode === 'link'
                                  ? t.linkCopiedBtn
                                  : `${t.copyLinkBtn} (?room=${roomCode})`}
                              </span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-3 text-sm text-[#CBC4B6]">
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-[#E8B861] shrink-0" />
                              <span>{statusMessage || t.waitingPartner}</span>
                            </span>
                            <button
                              type="button"
                              onClick={onCancelRoom}
                              className="text-xs font-medium text-[#A9A295] hover:text-[#F6F2E9] underline underline-offset-4 whitespace-nowrap shrink-0"
                            >
                              {t.cancelBtn}
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.form
                      key="tab-join"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      onSubmit={handleJoinSubmit}
                      className="space-y-4"
                    >
                      <div>
                        <label
                          htmlFor="couplecam-join-code"
                          className="block text-sm font-medium text-[#CBC4B6] mb-2"
                        >
                          {t.joinCodeLabel}
                        </label>
                        <input
                          id="couplecam-join-code"
                          type="text"
                          dir="ltr"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={120}
                          disabled={isJoining}
                          value={joinCodeInput}
                          onChange={(e) => {
                            setJoinCodeInput(normalizeRoomCode(e.target.value));
                            if (formError) setFormError(null);
                          }}
                          placeholder="4829"
                          className="w-full px-4 py-3 rounded-xl bg-[#0D0F17] border border-white/15 font-mono text-2xl tracking-[0.28em] text-center text-[#F6F2E9] placeholder-[#4B4D5C] tabular-nums focus:border-[#E8B861] focus:outline-none disabled:opacity-60 transition-colors duration-150"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isJoining}
                        className="group w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm sm:text-base font-semibold bg-[#F6F2E9] text-[#0D0F17] hover:bg-white disabled:opacity-60 transition-colors duration-150 whitespace-nowrap"
                      >
                        {isJoining ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span>{t.joiningBtn}</span>
                          </>
                        ) : (
                          <>
                            <span>{t.joinBtn}</span>
                            <ArrowRight className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                          </>
                        )}
                      </button>

                      {isJoining && (
                        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm text-[#CBC4B6] pt-0.5">
                          <span className="truncate">
                            {statusMessage || `${t.joiningBtn} (${roomCode || joinCodeInput})`}
                          </span>
                          <button
                            type="button"
                            onClick={onCancelRoom}
                            className="text-xs font-medium text-[#A9A295] hover:text-[#F6F2E9] underline underline-offset-4 whitespace-nowrap shrink-0"
                          >
                            {t.cancelBtn}
                          </button>
                        </div>
                      )}
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Validation or connection feedback */}
                {(formError ||
                  connectionStatus === 'error' ||
                  (connectionStatus === 'disconnected' && Boolean(statusMessage))) && (
                  <p role="alert" className="text-sm text-[#F08272] pt-1">
                    {formError || statusMessage}
                  </p>
                )}

                {cameraHint && (
                  <p className="text-xs text-[#A9A295] border-t border-white/10 pt-3">
                    {cameraHint}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
