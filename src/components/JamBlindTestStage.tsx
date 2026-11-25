import { useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Disc3,
  Eye,
  Lightbulb,
  Loader2,
  Mic,
  Pause,
  Play,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { JamBlindTrack, JamPlaybackRate, JamState } from '../types/duoplay';
import { searchItunesSongsJsonp, type ItunesTrackResult } from '../services/itunesJsonp';
import { buildInitialsHint, computeMysteryBlurPx } from '../game/coupleJamLogic';

interface JamBlindTestStageProps {
  state: JamState;
  isDj: boolean;
  isSolo?: boolean;
  isPlayingAudio: boolean;
  audioAutoplayBlocked: boolean;
  cameraAirPlayEnabled: boolean;
  onUnlockAudio: () => void;
  onPrivatePreviewToggle: (track: ItunesTrackResult) => void;
  privatePreviewTrackId: number | null;
  onLaunchBlindTrack: (track: JamBlindTrack) => void;
  onSubmitGuess: (guess: string) => void;
  onTriggerBuzzer: () => void;
  onUseHintArtist: () => void;
  onUseHintUnblur: () => void;
  onDjTogglePause: () => void;
  onDjMarkCorrect: () => void;
  onDjRevealNow: () => void;
  onNextRound: () => void;
}

const SPEED_OPTIONS: { value: JamPlaybackRate; label: string }[] = [
  { value: 0.8, label: '🐢 0.8x' },
  { value: 1, label: '🎵 1x' },
  { value: 1.35, label: '⚡ 1.35x' },
];

const EQ_BARS = Array.from({ length: 24 }, (_, idx) => idx);

export function JamBlindTestStage({
  state,
  isDj,
  isSolo = false,
  isPlayingAudio,
  audioAutoplayBlocked,
  cameraAirPlayEnabled,
  onUnlockAudio,
  onPrivatePreviewToggle,
  privatePreviewTrackId,
  onLaunchBlindTrack,
  onSubmitGuess,
  onTriggerBuzzer,
  onUseHintArtist,
  onUseHintUnblur,
  onDjTogglePause,
  onDjMarkCorrect,
  onDjRevealNow,
  onNextRound,
}: JamBlindTestStageProps) {
  const [djTab, setDjTab] = useState<'itunes' | 'free'>('itunes');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<ItunesTrackResult[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<ItunesTrackResult | null>(null);
  const [playbackRate, setPlaybackRate] = useState<JamPlaybackRate>(1);

  // Mode Libre (Micro/Phone/Hum)
  const [freeTitle, setFreeTitle] = useState('');
  const [freeArtist, setFreeArtist] = useState('');

  // Guesser input
  const [guessInput, setGuessInput] = useState('');

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    onUnlockAudio();
    setSearchLoading(true);
    setSearchError(null);
    try {
      const tracks = await searchItunesSongsJsonp(q, 10);
      setResults(tracks);
      if (tracks.length === 0) {
        setSearchError('Aucun extrait trouvé — essaie un autre titre ou passe en Mode Libre !');
      }
    } catch {
      setSearchError('Connexion iTunes lente ou indisponible — réessaie ou utilise le Mode Libre 🎙️.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleLaunchSelectedItunes = () => {
    if (!selectedTrack) return;
    onUnlockAudio();
    onLaunchBlindTrack({
      source: 'itunes',
      previewUrl: selectedTrack.previewUrl,
      artworkUrl: selectedTrack.artworkUrlHiRes || selectedTrack.artworkUrl,
      trackName: selectedTrack.trackName,
      artistName: selectedTrack.artistName,
      playbackRate,
      duration: 30,
    });
  };

  const handleLaunchFree = (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeTitle.trim()) return;
    onUnlockAudio();
    onLaunchBlindTrack({
      source: 'free',
      trackName: freeTitle.trim(),
      artistName: freeArtist.trim() || 'Mode Libre',
      playbackRate: 1,
      duration: 30,
    });
  };

  const handleGuessForm = (e: React.FormEvent) => {
    e.preventDefault();
    const text = guessInput.trim();
    if (!text) return;
    onSubmitGuess(text);
    setGuessInput('');
  };

  // --- 1. PREP PHASE ---
  if (state.phase === 'PREP') {
    if (!isDj) {
      return (
        <div className="flex-1 min-h-0 rounded-3xl border border-white/15 bg-[#140E2E]/90 p-5 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-[#7C3AED]/25 border border-[#C084FC]/50 flex items-center justify-center animate-pulse">
            <Disc3 className="w-8 h-8 text-[#FACC15]" />
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">
            Le DJ prépare la prochaine pépite…
          </h3>
          <p className="text-xs sm:text-sm text-white/75 max-w-sm">
            Garde tes oreilles grandes ouvertes ! Dès que l’extrait démarre, buzze ou tape le titre / l’artiste le plus vite possible.
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 rounded-3xl border border-white/15 bg-[#140E2E]/92 p-3 sm:p-4 flex flex-col gap-2.5 overflow-hidden">
        {/* 2 Simple DJ Tabs */}
        <div className="grid grid-cols-2 gap-2 shrink-0" role="tablist" aria-label="Source Blind Test">
          <button
            type="button"
            role="tab"
            aria-selected={djTab === 'itunes'}
            onClick={() => setDjTab('itunes')}
            className={`min-h-[42px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border transition-all flex items-center justify-center gap-1.5 ${
              djTab === 'itunes'
                ? 'bg-gradient-to-r from-[#7C3AED] to-[#FF4D8D] text-white border-white/35 shadow-lg'
                : 'bg-white/8 text-white/80 border-white/15 hover:bg-white/14'
            }`}
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="truncate">Recherche Universelle</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={djTab === 'free'}
            onClick={() => setDjTab('free')}
            className={`min-h-[42px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border transition-all flex items-center justify-center gap-1.5 ${
              djTab === 'free'
                ? 'bg-gradient-to-r from-[#FACC15] to-[#FB923C] text-[#140E2E] border-white/35 shadow-lg'
                : 'bg-white/8 text-white/80 border-white/15 hover:bg-white/14'
            }`}
          >
            <Mic className="w-4 h-4 shrink-0" />
            <span className="truncate">Mode Libre (Micro)</span>
          </button>
        </div>

        {/* TAB 1: iTunes JSONP Search */}
        {djTab === 'itunes' ? (
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            <form onSubmit={handleSearch} className="flex gap-2 shrink-0">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Artiste ou titre (Pop, Rap, Raï, Chaabi, Films…)"
                aria-label="Rechercher une musique sur iTunes"
                className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-2xl bg-[#0D0920] border border-white/20 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-[#22D3EE]"
              />
              <button
                type="submit"
                disabled={searchLoading || !searchQuery.trim()}
                className="min-h-[44px] px-4 rounded-2xl bg-[#22D3EE] text-[#100B24] font-black text-xs sm:text-sm hover:brightness-110 disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
              >
                {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Chercher</span>
              </button>
            </form>

            {searchError && (
              <p className="text-xs font-semibold text-[#FACC15] px-1 shrink-0">{searchError}</p>
            )}

            {/* Results list (scrolls cleanly inside container without scrolling whole page) */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
              {results.length === 0 && !searchLoading && (
                <div className="h-full flex flex-col items-center justify-center text-center text-xs text-white/60 px-3 py-4 gap-2">
                  <p>Tape n’importe quel artiste ou chanson du monde et teste-la en privé avant de lancer !</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {['Stromae', 'Cheb Khaled', 'Dua Lipa', 'Aya Nakamura', 'Gims'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setSearchQuery(chip);
                          void searchItunesSongsJsonp(chip, 10)
                            .then((list) => {
                              setResults(list);
                              setSearchError(list.length === 0 ? 'Aucun extrait trouvé.' : null);
                            })
                            .catch(() => setSearchError('Connexion iTunes indisponible.'));
                        }}
                        className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 text-xs font-bold border border-white/15"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.map((track) => {
                const isSelected = selectedTrack?.trackId === track.trackId;
                const isPreviewing = privatePreviewTrackId === track.trackId;
                return (
                  <div
                    key={track.trackId}
                    className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-[#7C3AED]/30 border-[#FACC15]'
                        : 'bg-white/6 border-white/12 hover:bg-white/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedTrack(track)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-start"
                    >
                      {track.artworkUrl ? (
                        <img
                          src={track.artworkUrl}
                          alt={track.trackName}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/15"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-[#7C3AED]/40 flex items-center justify-center shrink-0">
                          <Disc3 className="w-5 h-5 text-[#FACC15]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-extrabold text-white truncate">{track.trackName}</p>
                        <p className="text-[11px] text-white/70 truncate">{track.artistName}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onPrivatePreviewToggle(track)}
                      aria-label={`Écouter seul ${track.trackName}`}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-[11px] font-bold border shrink-0 inline-flex items-center gap-1 ${
                        isPreviewing
                          ? 'bg-[#FACC15] text-[#140E2E] border-white'
                          : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                      }`}
                    >
                      {isPreviewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isPreviewing ? 'Stop' : 'Écouter seul'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Speed modifier & Launch CTA */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/10">
              <div className="flex items-center gap-1">
                {SPEED_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlaybackRate(opt.value)}
                    className={`min-h-[38px] px-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                      playbackRate === opt.value
                        ? 'bg-[#FACC15] text-[#140E2E] border-white'
                        : 'bg-white/8 text-white/85 border-white/15 hover:bg-white/16'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!selectedTrack}
                onClick={handleLaunchSelectedItunes}
                className="min-h-[44px] flex-1 sm:flex-none px-5 rounded-2xl bg-gradient-to-r from-[#FF4D8D] via-[#7C3AED] to-[#22D3EE] text-white font-black text-xs sm:text-sm shadow-lg disabled:opacity-45 hover:brightness-110 transition-all"
              >
                🚀 Lancer l’extrait (30s)
              </button>
            </div>
          </div>
        ) : (
          /* TAB 2: Free Mode (Phone / Mic / Hum) */
          <form onSubmit={handleLaunchFree} className="flex-1 min-h-0 flex flex-col justify-between gap-3 py-1">
            <div className="space-y-2.5">
              <p className="text-xs text-white/80 bg-white/8 border border-white/15 rounded-2xl p-2.5">
                🎙️ Ton micro reste ouvert : passe un morceau sur ton téléphone, chante ou fredonne pendant 30 s !
              </p>
              <div className="space-y-1">
                <label htmlFor="jam-free-title" className="text-xs font-bold text-white/80">
                  Titre secret du morceau *
                </label>
                <input
                  id="jam-free-title"
                  type="text"
                  value={freeTitle}
                  onChange={(e) => setFreeTitle(e.target.value)}
                  placeholder="Ex. Papaoutai, Didi, Bohemian Rhapsody…"
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#0D0920] border border-white/20 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-[#FACC15]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="jam-free-artist" className="text-xs font-bold text-white/80">
                  Artiste (optionnel)
                </label>
                <input
                  id="jam-free-artist"
                  type="text"
                  value={freeArtist}
                  onChange={(e) => setFreeArtist(e.target.value)}
                  placeholder="Ex. Stromae, Cheb Khaled…"
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#0D0920] border border-white/20 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-[#FACC15]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!freeTitle.trim()}
              className="min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-[#FACC15] to-[#FF4D8D] text-[#140E2E] font-black text-sm shadow-lg disabled:opacity-45 hover:brightness-105"
            >
              🎙️ Lancer le chrono 30 s
            </button>
          </form>
        )}
      </div>
    );
  }

  // --- 2. REVEAL PHASE ---
  if (state.phase === 'REVEAL' && state.outcome) {
    const { outcome } = state;
    return (
      <div
        data-testid="jam-blindtest-reveal"
        className="flex-1 min-h-0 rounded-3xl border border-[#FACC15]/45 bg-[#150F32]/95 p-4 sm:p-5 flex flex-col items-center justify-center text-center gap-3 overflow-hidden"
      >
        {/* Crystal-clear unblurred album cover */}
        <div className="relative">
          {outcome.revealArtworkUrl ? (
            <img
              src={outcome.revealArtworkUrl}
              alt={outcome.revealTitle}
              referrerPolicy="no-referrer"
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover border-2 border-[#FACC15] shadow-[0_0_36px_rgba(250,204,21,0.45)] transition-all duration-700"
            />
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-[#7C3AED] via-[#FF4D8D] to-[#FACC15] flex items-center justify-center shadow-[0_0_36px_rgba(255,77,141,0.45)]">
              <Disc3 className="w-12 h-12 text-white" />
            </div>
          )}
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-0.5 rounded-full text-xs font-black bg-[#FACC15] text-[#140E2E] shadow-md">
            {outcome.guessed
              ? `+${outcome.pointsAwarded} pt${outcome.pointsAwarded > 1 ? 's' : ''}${outcome.fastBonus ? ' · ⚡ Éclair' : ''}`
              : '0 pt · Gage Musical !'}
          </span>
        </div>

        <div className="space-y-0.5 mt-1">
          <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">{outcome.revealTitle}</h3>
          {outcome.revealArtist && (
            <p className="text-sm font-bold text-[#22D3EE]">{outcome.revealArtist}</p>
          )}
        </div>

        {outcome.dareText && (
          <div className="w-full max-w-md rounded-2xl bg-[#FF4D8D]/18 border border-[#FF4D8D]/50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white">
            🎭 Gage : {outcome.dareText}
          </div>
        )}

        <button
          type="button"
          data-testid="jam-next-round-btn"
          onClick={onNextRound}
          className="min-h-[46px] px-6 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#FF4D8D] to-[#FACC15] text-white font-black text-sm shadow-lg hover:brightness-110 transition-all"
        >
          {state.totalRounds > 0 && state.round >= state.totalRounds
            ? '🏆 Voir le classement final'
            : '➡️ Manche suivante'}
        </button>
      </div>
    );
  }

  // --- 3. PLAYING / BUZZER PHASE ---
  const blurPx = computeMysteryBlurPx(
    state.timeLeftSec,
    state.roundDurationSec,
    state.hintUnblurUsed,
    false,
  );
  const track = state.blindTrack;
  const equalizerActive = isPlayingAudio && !state.isPaused && state.phase === 'PLAYING';

  // DJ View during playback
  if (isDj) {
    return (
      <div className="flex-1 min-h-0 rounded-3xl border border-white/15 bg-[#140E2E]/92 p-4 flex flex-col items-center justify-between text-center gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold text-[#FACC15]">🎧 Contrôle DJ · Morceau secret</p>
          <h3 className="text-lg sm:text-2xl font-black text-white">{track?.trackName || state.secretTitle}</h3>
          <p className="text-sm font-semibold text-[#22D3EE]">{track?.artistName || state.secretArtist}</p>
          {track && track.playbackRate !== 1 && (
            <p className="text-xs font-bold text-[#FF4D8D]">
              Vitesse : {track.playbackRate === 1.35 ? '⚡ Speed-Up 1.35x' : '🐢 Slowed 0.8x'}
            </p>
          )}
        </div>

        {/* Big Countdown & Buzzer Banner */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-4xl sm:text-5xl font-black tabular-nums text-white">
            {Math.ceil(state.timeLeftSec)}s
          </div>
          {state.phase === 'BUZZER' && (
            <div className="px-4 py-1.5 rounded-2xl bg-[#FF4D8D] text-white font-black text-xs sm:text-sm animate-pulse">
              🚨 BUZZER ! Pause réponse ({Math.ceil(state.buzzerLeftSec)}s)
            </div>
          )}
        </div>

        {/* DJ Action Controls */}
        <div className="w-full max-w-md grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onDjTogglePause}
            className="min-h-[46px] px-2.5 rounded-2xl bg-white/12 border border-white/20 text-white text-xs sm:text-sm font-extrabold hover:bg-white/20 inline-flex items-center justify-center gap-1"
          >
            {state.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{state.isPaused ? 'Reprendre' : 'Pause'}</span>
          </button>
          <button
            type="button"
            onClick={onDjMarkCorrect}
            className="min-h-[46px] px-2.5 rounded-2xl bg-[#10B981] text-[#071A13] text-xs sm:text-sm font-black hover:brightness-110 inline-flex items-center justify-center gap-1"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Trouvé !</span>
          </button>
          <button
            type="button"
            onClick={onDjRevealNow}
            className="min-h-[46px] px-2.5 rounded-2xl bg-[#FACC15]/20 border border-[#FACC15]/50 text-[#FACC15] text-xs sm:text-sm font-extrabold hover:bg-[#FACC15]/30 inline-flex items-center justify-center gap-1"
          >
            <Eye className="w-4 h-4" />
            <span>Révéler</span>
          </button>
        </div>
      </div>
    );
  }

  // Guesser View (Title & Artist strictly hidden!)
  return (
    <div
      data-testid="jam-blindtest-guesser"
      className="flex-1 min-h-0 rounded-3xl border border-white/15 bg-[#140E2E]/92 p-3 sm:p-4 flex flex-col items-center justify-between gap-2.5 overflow-hidden"
    >
      {/* Mobile Autoplay Rescue Button */}
      {audioAutoplayBlocked && (
        <button
          type="button"
          data-testid="jam-enable-sound-btn"
          onClick={onUnlockAudio}
          className="w-full max-w-sm min-h-[44px] px-4 rounded-2xl bg-[#FACC15] text-[#140E2E] font-black text-sm shadow-lg animate-bounce inline-flex items-center justify-center gap-2 shrink-0"
        >
          <Volume2 className="w-5 h-5" />
          <span>🔊 Activer le son</span>
        </button>
      )}

      {/* Top Guesser Kicker */}
      <div className="shrink-0 text-center space-y-0.5 pt-1">
        <p className="text-xs sm:text-sm font-black text-[#22D3EE]">
          🎧 Écoute l’extrait et devine le titre ou l’artiste !
        </p>
        <p className="text-[11px] font-semibold text-white/65">
          Trouvé en moins de 10 s = +3 pts ⚡ Éclair
        </p>
      </div>

      {/* Mystery Blurred Cover + Circular Neon Equalizer + Countdown */}
      <div className="relative flex items-center justify-center my-auto">
        {/* Circular Animated Neon Equalizer Ring (CSS/SVG driven strictly by isPlaying, zero createMediaElementSource) */}
        <div
          aria-hidden="true"
          className="relative w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center"
        >
          {EQ_BARS.map((idx) => {
            const deg = (idx / EQ_BARS.length) * 360;
            const barH = equalizerActive ? 16 + ((idx * 7) % 18) : 7;
            const color =
              idx % 3 === 0 ? '#22D3EE' : idx % 3 === 1 ? '#FF4D8D' : '#FACC15';
            return (
              <span
                key={idx}
                className={equalizerActive ? 'animate-pulse' : ''}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: '4px',
                  height: `${barH}px`,
                  borderRadius: '999px',
                  backgroundColor: color,
                  transformOrigin: 'center bottom',
                  transform: `translate(-50%, -100%) rotate(${deg}deg) translateY(-84px)`,
                  animationDelay: `${(idx % 6) * 110}ms`,
                  animationDuration: '480ms',
                  opacity: equalizerActive ? 0.95 : 0.35,
                }}
              />
            );
          })}

          {/* Blurred Mystery Cover Container */}
          <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-full overflow-hidden border-2 border-white/35 bg-[#1F1545] shadow-[0_0_36px_rgba(124,58,237,0.6)] flex items-center justify-center">
            {track?.artworkUrl ? (
              <img
                src={track.artworkUrl}
                alt="Pochette mystère"
                referrerPolicy="no-referrer"
                style={{ filter: `blur(${blurPx}px)`, transform: 'scale(1.18)' }}
                className="w-full h-full object-cover transition-all duration-500"
              />
            ) : (
              <Disc3 className={`w-16 h-16 text-[#FACC15]/80 ${equalizerActive ? 'animate-spin' : ''}`} />
            )}

            {/* Center Countdown Overlay */}
            <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center">
              <span className="text-3xl sm:text-4xl font-black text-white tabular-nums drop-shadow">
                {Math.ceil(state.timeLeftSec)}s
              </span>
              {track?.playbackRate && track.playbackRate !== 1 && (
                <span className="text-[11px] font-black text-[#FACC15]">
                  {track.playbackRate === 1.35 ? '⚡ 1.35x' : '🐢 0.8x'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hints revealed (if purchased) */}
      {state.hintArtistUsed && (
        <div className="px-3 py-1.5 rounded-xl bg-[#FACC15]/18 border border-[#FACC15]/45 text-xs font-extrabold text-[#FACC15] shrink-0">
          💡 Indice : {state.secretArtist ? `Artiste: ${state.secretArtist}` : `Initiales: ${buildInitialsHint(state.secretTitle)}`}
        </div>
      )}

      {/* Buzzer Banner OR Big BUZZER button + Hints */}
      <div className="w-full max-w-md space-y-2 shrink-0">
        {state.phase === 'BUZZER' ? (
          <div className="w-full py-2.5 px-3 rounded-2xl bg-[#FF4D8D] text-white font-black text-xs sm:text-sm text-center animate-pulse">
            🚨 BUZZER ! Musique en pause ({Math.ceil(state.buzzerLeftSec)}s) — Donne ta réponse !
          </div>
        ) : (
          <button
            type="button"
            data-testid="jam-buzzer-btn"
            onClick={onTriggerBuzzer}
            className="w-full min-h-[48px] px-4 rounded-2xl bg-gradient-to-r from-[#EF4444] via-[#FF4D8D] to-[#F97316] text-white font-black text-sm sm:text-base shadow-[0_0_24px_rgba(239,68,68,0.5)] hover:brightness-110 active:scale-97 transition-all inline-flex items-center justify-center gap-2"
          >
            <BellRing className="w-4 h-4" />
            <span>🚨 BUZZER !{cameraAirPlayEnabled ? ' (ou lève la main ✋)' : ''}</span>
          </button>
        )}

        {/* Hint & Solo Reveal Strip */}
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={state.hintArtistUsed}
            onClick={onUseHintArtist}
            title="Montrer l'artiste / initiales (-0,5 pt)"
            className="flex-1 min-h-[40px] px-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20 disabled:opacity-40 inline-flex items-center justify-center gap-1"
          >
            <Lightbulb className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
            <span className="truncate">Artiste</span>
            <span className="text-[10px] text-[#FACC15] shrink-0">-0,5</span>
          </button>
          {track?.artworkUrl && (
            <button
              type="button"
              disabled={state.hintUnblurUsed}
              onClick={onUseHintUnblur}
              title="Réduire le flou de la pochette (-0,5 pt)"
              className="flex-1 min-h-[40px] px-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20 disabled:opacity-40 inline-flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#22D3EE] shrink-0" />
              <span className="truncate">Flou</span>
              <span className="text-[10px] text-[#22D3EE] shrink-0">-0,5</span>
            </button>
          )}
          {isSolo && (
            <button
              type="button"
              data-testid="jam-solo-reveal-btn"
              onClick={onDjRevealNow}
              className="min-h-[40px] px-3 rounded-xl bg-white/10 border border-white/20 text-white/85 text-xs font-bold hover:bg-white/20 inline-flex items-center justify-center gap-1 shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Révéler</span>
            </button>
          )}
        </div>

        {/* Smart Answer Form */}
        <form onSubmit={handleGuessForm} className="flex gap-2">
          <input
            type="text"
            value={guessInput}
            onChange={(e) => setGuessInput(e.target.value)}
            placeholder="Tape le titre ou l'artiste…"
            aria-label="Ta réponse musicale"
            className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-2xl bg-[#0D0920] border border-white/25 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-[#22D3EE]"
          />
          <button
            type="submit"
            disabled={!guessInput.trim()}
            className="min-h-[44px] px-4 rounded-2xl bg-[#22D3EE] text-[#100B24] font-black text-sm hover:brightness-110 disabled:opacity-45 shrink-0"
          >
            Valider
          </button>
        </form>
        {state.lastWrongGuess && (
          <p className="text-[11px] font-bold text-[#FB7185] text-center truncate">
            Presque ! « {state.lastWrongGuess} » n’est pas encore le bon titre — réessaie !
          </p>
        )}
      </div>
    </div>
  );
}
