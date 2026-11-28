import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import type { PeerMessage, ScreenView } from './types/duoplay';
import { soundFx } from './utils/soundFx';
import { extractRoomCodeFromSearch } from './utils/clipboard';
import { loadPersistedRoomSession } from './utils/roomSessionStorage';
import { LobbyView } from './components/LobbyView';
import { SessionToolbar } from './components/SessionToolbar';
import { RoomMenuView } from './components/RoomMenuView';
import { ParchisiDuoGameView } from './components/ParchisiDuoGameView';
import { LiveChatPanel } from './components/LiveChatPanel';
import { LeaveRoomModal } from './components/LeaveRoomModal';
import { ToastStack, type AppToast } from './components/ToastStack';
import { GameErrorBoundary } from './components/GameErrorBoundary';
import { LanguageProvider, useI18n } from './i18n/LanguageContext';
import { RoomProvider, useRoom } from './context/RoomContext';

export default function App() {
  return (
    <LanguageProvider>
      <RoomProvider>
        <CoupleCamApp />
      </RoomProvider>
    </LanguageProvider>
  );
}

function CoupleCamApp() {
  const { t } = useI18n();
  const {
    roomCode,
    role,
    connectionMode,
    connectionStatus,
    statusMessage,
    inRoom,
    isHost,
    isGuest,
    isAIMode,
    isRestoringSession,
    playerName,
    setPlayerName,
    hostName,
    guestName,
    guestConnected,
    partnerName,
    activeGame,
    diceCount,
    parcheesiWins,
    recordParchisiVictory,
    micMuted,
    micStatus,
    micHint,
    hostHasAudio,
    guestHasAudio,
    hostMicMuted,
    guestMicMuted,
    localSpeaking,
    remoteSpeaking,
    chatMessages,
    unreadChatCount,
    chatOpen,
    setChatOpen,
    floatingReactions,
    sendChatMessage,
    sendQuickReaction,
    createRoom,
    joinRoom,
    cancelRoom,
    leaveRoom,
    startSoloMode,
    startParcheesi,
    returnToRoomMenu,
    setDiceCount,
    toggleMic,
    sendData,
    onData,
  } = useRoom();

  const [initialJoinCode] = useState<string>(() =>
    typeof window !== 'undefined' ? extractRoomCodeFromSearch(window.location.search) : '',
  );
  const [sfxMuted, setSfxMuted] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [toasts, setToasts] = useState<AppToast[]>([]);

  // Active Parcheesi message subscriber + short queue for messages arriving right during mount
  const activeGamePeerHandlerRef = useRef<((msg: PeerMessage) => void) | null>(null);
  const pendingGameMessagesRef = useRef<PeerMessage[]>([]);

  const pushToast = useCallback((message: string, tone: AppToast['tone'] = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
  }, []);

  // Derive the 3 persistent screens directly from RoomContext (RoomProvider NEVER unmounts!)
  const screen: ScreenView = !inRoom
    ? 'lobby'
    : activeGame === 'parcheesi'
      ? 'parcheesi'
      : 'room-menu';

  // Mirror current top-level screen to document.body.dataset.state for testability
  useEffect(() => {
    if (screen === 'lobby') {
      document.body.dataset.state = 'lobby';
    } else if (screen === 'room-menu') {
      document.body.dataset.state = 'room-menu';
    }
  }, [screen]);

  // Toast once when a Duo guest joins the room
  const prevGuestConnectedRef = useRef(guestConnected);
  useEffect(() => {
    const prev = prevGuestConnectedRef.current;
    prevGuestConnectedRef.current = guestConnected;
    if (!isAIMode && inRoom && guestConnected && !prev) {
      soundFx.roundWin();
      pushToast(t.toastPartnerConnected, 'success');
    }
  }, [guestConnected, isAIMode, inRoom, pushToast, t.toastPartnerConnected]);

  // Forward incoming Parcheesi PeerMessages cleanly to ParchisiDuoGameView
  useEffect(() => {
    return onData((msg) => {
      if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
      if (activeGamePeerHandlerRef.current) {
        try {
          activeGamePeerHandlerRef.current(msg);
        } catch (err) {
          console.warn('[Parcheesi App] Safe message handler guard caught error:', err);
        }
      } else {
        pendingGameMessagesRef.current.push(msg);
        if (pendingGameMessagesRef.current.length > 24) {
          pendingGameMessagesRef.current.shift();
        }
      }
    });
  }, [onData]);

  const registerPeerHandler = useCallback((handler: ((msg: PeerMessage) => void) | null) => {
    activeGamePeerHandlerRef.current = handler;
    if (handler && pendingGameMessagesRef.current.length > 0) {
      const queued = pendingGameMessagesRef.current;
      pendingGameMessagesRef.current = [];
      for (const queuedMsg of queued) {
        try {
          handler(queuedMsg);
        } catch (err) {
          console.warn('[Parcheesi App] Buffered message failed safely:', err);
        }
      }
    }
  }, []);

  // Support invite links (?room=XXXX) and fast testing (?autostart=1|parcheesi)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const auto = params.get('autostart');
    if (auto === '1' || auto === 'room-menu') {
      startSoloMode(playerName || 'Alex');
      return;
    }
    if (auto === 'parcheesi' || auto === 'parchisi-duo') {
      startSoloMode(playerName || 'Alex');
      void startParcheesi();
      return;
    }
    if (initialJoinCode.length === 4) {
      const saved = loadPersistedRoomSession();
      if (saved && saved.roomCode === initialJoinCode) {
        // RoomContext auto-reconnect handles restoring the exact room & active game
        return;
      }
      void joinRoom(initialJoinCode, playerName || 'Invité');
    }
    // Run once on root mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateRoom = useCallback(() => {
    soundFx.click();
    void createRoom(playerName);
  }, [createRoom, playerName]);

  const handleJoinRoom = useCallback(
    (code: string) => {
      soundFx.click();
      void joinRoom(code, playerName);
    },
    [joinRoom, playerName],
  );

  const handleStartSoloMode = useCallback(() => {
    soundFx.click();
    startSoloMode(playerName);
    pushToast(t.toastSoloStarted, 'accent');
  }, [playerName, startSoloMode, pushToast, t.toastSoloStarted]);

  const handleStartParcheesi = useCallback(() => {
    soundFx.click();
    pendingGameMessagesRef.current = [];
    void startParcheesi();
  }, [startParcheesi]);

  const handleReturnToRoomMenu = useCallback(() => {
    soundFx.click();
    setChatOpen(false);
    pendingGameMessagesRef.current = [];
    void returnToRoomMenu();
  }, [returnToRoomMenu, setChatOpen]);

  const handleConfirmLeaveRoom = useCallback(() => {
    soundFx.click();
    setLeaveModalOpen(false);
    leaveRoom();
  }, [leaveRoom]);

  const handleToggleSfx = useCallback(() => {
    setSfxMuted((prev) => {
      const next = !prev;
      soundFx.muted = next;
      return next;
    });
  }, []);

  const partnerMicMuted = isHost ? guestMicMuted : hostMicMuted;

  return (
    <MotionConfig reducedMotion="user">
      {/* Subtle non-blocking overlay while restoring saved sessionStorage room on page refresh */}
      {isRestoringSession && !inRoom && (
        <div
          data-testid="reconnecting-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#FAF7F2]/90 backdrop-blur-xs p-4"
        >
          <div className="rounded-3xl bg-white border border-[#EAE4DC] shadow-[0_12px_32px_rgba(31,36,45,0.10)] px-6 py-5 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[#FF6B57]" />
            <span className="text-sm font-extrabold text-[#1F242D]">{t.reconnectingTitle}</span>
          </div>
        </div>
      )}

      {screen === 'lobby' ? (
        <motion.div
          key="lobby-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <LobbyView
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            initialJoinCode={initialJoinCode}
            connectionStatus={connectionStatus}
            statusMessage={statusMessage}
            micMuted={micMuted}
            micStatus={micStatus}
            micHint={micHint}
            sfxMuted={sfxMuted}
            onToggleMic={toggleMic}
            onToggleSfx={handleToggleSfx}
            onCreateRoom={handleCreateRoom}
            onCancelRoom={cancelRoom}
            onJoinRoom={handleJoinRoom}
            onStartSoloMode={handleStartSoloMode}
          />
        </motion.div>
      ) : (
        <div className="h-[100dvh] overflow-hidden flex flex-col bg-[#FAF7F2] text-[#1F242D]">
          <SessionToolbar
            screen={screen}
            connectionMode={connectionMode}
            roomCode={roomCode}
            isHostOrAi={isHost || isAIMode}
            micMuted={micMuted}
            sfxMuted={sfxMuted}
            chatOpen={chatOpen}
            unreadChatCount={unreadChatCount}
            onToggleMic={toggleMic}
            onToggleSfx={handleToggleSfx}
            onToggleChat={() => setChatOpen(!chatOpen)}
            onReturnToRoomMenu={handleReturnToRoomMenu}
            onRequestLeaveRoom={() => setLeaveModalOpen(true)}
            onNotify={pushToast}
          />

          {screen === 'room-menu' && (
            <motion.div
              key="room-menu-screen"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              <RoomMenuView
                roomCode={roomCode}
                isHost={isHost}
                isGuest={isGuest}
                isAIMode={isAIMode}
                localRole={role}
                hostName={hostName}
                guestName={guestName}
                guestConnected={guestConnected}
                diceCount={diceCount}
                parcheesiWins={parcheesiWins}
                micMuted={micMuted}
                micStatus={micStatus}
                micHint={micHint}
                hostHasAudio={hostHasAudio}
                guestHasAudio={guestHasAudio}
                hostMicMuted={hostMicMuted}
                guestMicMuted={guestMicMuted}
                localSpeaking={localSpeaking}
                remoteSpeaking={remoteSpeaking}
                chatMessages={chatMessages}
                floatingReactions={floatingReactions}
                onSetDiceCount={setDiceCount}
                onStartParcheesi={handleStartParcheesi}
                onToggleMic={toggleMic}
                onRequestLeaveRoom={() => setLeaveModalOpen(true)}
                onSendChatMessage={sendChatMessage}
                onSendQuickReaction={sendQuickReaction}
                onNotify={pushToast}
              />
            </motion.div>
          )}

          {screen === 'parcheesi' && (
            <GameErrorBoundary
              resetKey={`${roomCode}-${screen}`}
              canReturnToRoomMenu={isHost || isAIMode}
              onReturnToRoomMenu={handleReturnToRoomMenu}
              title={t.errorBoundaryTitle}
              subtitle={t.errorBoundarySub}
              returnLabel={t.backToRoomMenu}
            >
              <motion.div
                key="parcheesi-screen"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex-1 min-h-0 flex flex-col overflow-hidden"
              >
                <ParchisiDuoGameView
                  localName={playerName}
                  partnerName={partnerName}
                  connectionMode={connectionMode}
                  initialDiceCount={diceCount}
                  onSyncDiceCount={setDiceCount}
                  micMuted={micMuted}
                  partnerMicMuted={partnerMicMuted}
                  localSpeaking={localSpeaking}
                  remoteSpeaking={remoteSpeaking}
                  unreadChatCount={unreadChatCount}
                  onOpenLiveChat={() => setChatOpen(true)}
                  onRecordVictory={recordParchisiVictory}
                  onSendPeerMessage={sendData}
                  registerPeerHandler={registerPeerHandler}
                  onReturnToRoomMenu={handleReturnToRoomMenu}
                />

                {/* Floating Quick Reactions during Parcheesi */}
                {floatingReactions.length > 0 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center overflow-hidden"
                  >
                    <div className="relative w-72 h-36">
                      {floatingReactions.map((r) => (
                        <div
                          key={r.id}
                          style={{ left: `calc(50% + ${r.offsetX}px)` }}
                          className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center animate-bounce"
                        >
                          <span className="text-3xl drop-shadow-sm">{r.emoji}</span>
                          <span className="mt-0.5 px-2 py-0.5 rounded-full bg-white/95 border border-[#EAE4DC] text-[10px] font-bold text-[#1F242D] shadow-xs whitespace-nowrap">
                            {r.senderName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Slide-over Live Chat Drawer inside Parcheesi */}
                {chatOpen && (
                  <LiveChatPanel
                    messages={chatMessages}
                    localRole={role}
                    onSendMessage={sendChatMessage}
                    onSendReaction={sendQuickReaction}
                    variant="drawer"
                    onClose={() => setChatOpen(false)}
                  />
                )}
              </motion.div>
            </GameErrorBoundary>
          )}
        </div>
      )}

      {/* Explicit Leave Room Confirmation Modal (replaces window.confirm) */}
      <LeaveRoomModal
        open={leaveModalOpen}
        onCancel={() => setLeaveModalOpen(false)}
        onConfirm={handleConfirmLeaveRoom}
      />

      <ToastStack toasts={toasts} />
    </MotionConfig>
  );
}
