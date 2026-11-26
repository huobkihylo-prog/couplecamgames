import { useMemo, useState, type MutableRefObject } from 'react';
import { Hand, Music, Play, ScanFace, Search, Sparkles, X } from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  GameId,
  HubCategory,
  TrackerStatus,
} from '../types/duoplay';
import { useI18n } from '../i18n/LanguageContext';
import { CameraFeedTile } from './CameraFeedTile';

const CARD_LAUGH_SRC = '/src/assets/images/hub_card_laugh_1795451799128.jpg';
const CARD_STARE_SRC = '/src/assets/images/hub_card_stare_duel_1795529674561.jpg';
const CARD_MIAM_SRC = '/src/assets/images/hub_card_miam_mania_1795529675741.jpg';
const CARD_FUNAMBULES_SRC = '/src/assets/images/hub_card_funambules_1795451798892.jpg';
const CARD_NINJA_SRC = '/src/assets/images/hub_card_ninja_fruits_1795518758103.jpg';
const CARD_HOCKEY_SRC = '/src/assets/images/hub_card_air_hockey_1795518756217.jpg';
const CARD_WHISPER_SRC = '/src/assets/images/hub_card_whisper_secrets_1795600847414.jpg';
const CARD_SLINGSHOT_SRC = '/src/assets/images/hub_card_slingshot_duo_1795617880651.jpg';
const CARD_XO_SRC = '/src/assets/images/hub_card_xo_neon_1795617881759.jpg';
const CARD_PARCHISI_SRC = '/src/assets/images/hub_card_parchisi_duo_1795619566495.jpg';
const CARD_MUSIC_QUIZ_SRC = '/src/assets/images/hub_card_music_quiz_1795704850089.jpg';
const CARD_FREEZE_DANCE_SRC = '/src/assets/images/hub_card_freeze_dance_1795704850507.jpg';

type SensorKind = 'face' | 'hands' | 'face-hands' | 'music';

interface HubGameCardConfig {
  id: GameId;
  emoji: string;
  imageSrc: string;
  sensor: SensorKind;
  categories: Exclude<HubCategory, 'all'>[];
}

export interface HubFloatingReaction {
  id: number;
  emoji: '❤️' | '😂' | '🔥';
  offsetX: number;
}

const HUB_CATEGORY_IDS: HubCategory[] = [
  'all',
  'drole',
  'action',
  'aventure',
  'romantique',
  'amusant',
  'sensuel',
  'musique',
];

/** The 6 exact Bento pastel card tints cycled dynamically across all games */
const PASTEL_BENTO_TONES = [
  { bg: '#EFE9FB', border: '#E1D6F6', badgeBg: '#FFFFFF' }, // Lavande
  { bg: '#E6F6EF', border: '#CDECE0', badgeBg: '#FFFFFF' }, // Menthe
  { bg: '#E6F3FC', border: '#CCE5F7', badgeBg: '#FFFFFF' }, // Bleu ciel
  { bg: '#FEF6DC', border: '#F6E7B4', badgeBg: '#FFFFFF' }, // Jaune beurre
  { bg: '#FDEEE7', border: '#F7DCD0', badgeBg: '#FFFFFF' }, // Pêche
  { bg: '#FCEAF0', border: '#F5D5E0', badgeBg: '#FFFFFF' }, // Rose poudré
] as const;

const HUB_GAMES: HubGameCardConfig[] = [
  {
    id: 'laugh',
    emoji: '😂',
    imageSrc: CARD_LAUGH_SRC,
    sensor: 'face',
    categories: ['drole', 'amusant'],
  },
  {
    id: 'stare-duel',
    emoji: '👀',
    imageSrc: CARD_STARE_SRC,
    sensor: 'face',
    categories: ['drole', 'romantique', 'amusant'],
  },
  {
    id: 'miam-mania',
    emoji: '🍕',
    imageSrc: CARD_MIAM_SRC,
    sensor: 'face',
    categories: ['drole', 'amusant'],
  },
  {
    id: 'funambules',
    emoji: '🧭',
    imageSrc: CARD_FUNAMBULES_SRC,
    sensor: 'face',
    categories: ['aventure', 'romantique'],
  },
  {
    id: 'ninja-fruits',
    emoji: '🍉',
    imageSrc: CARD_NINJA_SRC,
    sensor: 'hands',
    categories: ['action', 'amusant'],
  },
  {
    id: 'air-hockey',
    emoji: '🏒',
    imageSrc: CARD_HOCKEY_SRC,
    sensor: 'hands',
    categories: ['action', 'drole', 'amusant'],
  },
  {
    id: 'whisper-secrets',
    emoji: '🔥',
    imageSrc: CARD_WHISPER_SRC,
    sensor: 'face',
    categories: ['sensuel', 'romantique'],
  },
  {
    id: 'slingshot-duo',
    emoji: '🎯',
    imageSrc: CARD_SLINGSHOT_SRC,
    sensor: 'hands',
    categories: ['action'],
  },
  {
    id: 'xo-neon',
    emoji: '⭕',
    imageSrc: CARD_XO_SRC,
    sensor: 'hands',
    categories: ['amusant'],
  },
  {
    id: 'parchisi-duo',
    emoji: '🎲',
    imageSrc: CARD_PARCHISI_SRC,
    sensor: 'hands',
    categories: ['amusant'],
  },
  {
    id: 'music-quiz',
    emoji: '⚡',
    imageSrc: CARD_MUSIC_QUIZ_SRC,
    sensor: 'music',
    categories: ['musique'],
  },
  {
    id: 'freeze-dance',
    emoji: '🥶',
    imageSrc: CARD_FREEZE_DANCE_SRC,
    sensor: 'music',
    categories: ['musique'],
  },
];

interface HubViewProps {
  activeCategory: HubCategory;
  onCategoryChange: (cat: HubCategory) => void;
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micMuted: boolean;
  trackerStatus: TrackerStatus;
  localMetricsRef: MutableRefObject<FaceMetrics>;
  partnerMetricsRef: MutableRefObject<FaceMetrics>;
  laughMatchCount: number;
  stareBestSec: number;
  miamBestScore: number;
  funambulesBestM: number;
  ninjaBestScore: number;
  airHockeyWins: number;
  whisperBestHeat: number;
  slingshotBestScore: number;
  xoNeonWins: number;
  parchisiWins: number;
  musicQuizBestScore: number;
  freezeDanceWins: number;
  floatingReactions: HubFloatingReaction[];
  onSendReaction: (emoji: '❤️' | '😂' | '🔥') => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSelectGame: (game: GameId) => void;
}

export function HubView({
  activeCategory,
  onCategoryChange,
  localName,
  partnerName,
  connectionMode,
  localStream,
  remoteStream,
  cameraEnabled,
  micMuted,
  trackerStatus,
  localMetricsRef,
  partnerMetricsRef,
  laughMatchCount,
  stareBestSec,
  miamBestScore,
  funambulesBestM,
  ninjaBestScore,
  airHockeyWins,
  whisperBestHeat,
  slingshotBestScore,
  xoNeonWins,
  parchisiWins,
  musicQuizBestScore,
  freezeDanceWins,
  floatingReactions,
  onSendReaction,
  onVideoRef,
  onRequestCamera,
  onSelectGame,
}: HubViewProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const isSolo = connectionMode === 'solo';

  // Aggregate session wins/records for the compact central peach pill
  const totalWins = laughMatchCount + airHockeyWins + xoNeonWins + parchisiWins + freezeDanceWins;
  const totalHighlights =
    (stareBestSec > 0 ? 1 : 0) +
    (miamBestScore > 0 ? 1 : 0) +
    (funambulesBestM > 0 ? 1 : 0) +
    (ninjaBestScore > 0 ? 1 : 0) +
    (whisperBestHeat > 16 ? 1 : 0) +
    (slingshotBestScore > 0 ? 1 : 0) +
    (musicQuizBestScore > 0 ? 1 : 0);

  const sessionScoreLabel =
    totalWins > 0
      ? `🏆 ${totalWins} ${totalWins > 1 ? 'victoires' : 'victoire'}`
      : totalHighlights > 0
        ? `✨ ${totalHighlights} ${totalHighlights > 1 ? 'records' : 'record'}`
        : `💕 ${HUB_GAMES.length} jeux`;

  const visibleGames = useMemo(() => {
    const byCat =
      activeCategory === 'all'
        ? HUB_GAMES
        : HUB_GAMES.filter((g) => g.categories.includes(activeCategory));

    const q = searchQuery.trim().toLowerCase();
    if (!q) return byCat;

    return byCat.filter((g) => {
      const copy = t.games[g.id];
      return (
        copy.title.toLowerCase().includes(q) ||
        copy.shortDesc.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchQuery, t.games]);

  const featuredParcheesi = visibleGames.find((g) => g.id === 'parchisi-duo');
  const showFeaturedCard = Boolean(featuredParcheesi) && searchQuery.trim().length === 0 && (activeCategory === 'all' || activeCategory === 'amusant');
  const bentoGames = showFeaturedCard
    ? visibleGames.filter((g) => g.id !== 'parchisi-duo')
    : visibleGames;

  const sensorLabel = (sensor: SensorKind) =>
    sensor === 'face'
      ? t.sensorFace
      : sensor === 'hands'
        ? t.sensorHands
        : sensor === 'music'
          ? t.categories.musique.replace(/^🎵\s*/, '')
          : t.sensorFaceHands;

  return (
    <div
      data-hub-theme={activeCategory}
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#FAF7F2] text-[#1F242D]"
    >
      {/* 1. FIXED TOP ZONE: Duo Cameras + Central Peach Session Pill & 3 Mini Reactions */}
      <section
        aria-label="Room cameras"
        className="shrink-0 w-full max-w-6xl mx-auto px-3.5 sm:px-6 pt-3 pb-2 space-y-2"
      >
        <div className="relative max-w-2xl mx-auto grid grid-cols-2 gap-2.5 sm:gap-3.5">
          <CameraFeedTile
            name={localName}
            subtitle={
              localStream && trackerStatus === 'ready'
                ? t.camReady
                : trackerStatus === 'loading'
                  ? t.camLoading
                  : undefined
            }
            stream={localStream}
            isLocal
            cameraEnabled={cameraEnabled}
            micMuted={micMuted}
            trackerStatus={trackerStatus}
            showTrackingReadout
            metricsRef={localMetricsRef}
            onVideoRef={onVideoRef}
            onRequestCamera={onRequestCamera}
            frameClassName="h-[135px] sm:h-[175px]"
          />

          <CameraFeedTile
            name={partnerName}
            subtitle={isSolo ? t.partnerAiSub : t.partnerLiveSub}
            stream={remoteStream}
            isAi={isSolo}
            metricsRef={partnerMetricsRef}
            frameClassName="h-[135px] sm:h-[175px]"
          />

          {/* Floating emoji reactions burst over cameras */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden flex items-end justify-center pb-4"
          >
            {floatingReactions.map((r) => (
              <span
                key={r.id}
                style={{ marginLeft: `${r.offsetX}px` }}
                className="animate-reaction-float absolute text-2xl sm:text-3xl drop-shadow-sm select-none"
              >
                {r.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* Central Pastel Peach Pill (Session Score) + 3 Mini Reaction Buttons */}
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-2">
          <div
            data-testid="hub-session-score-pill"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE8E2] border border-[#FFD6CC] text-xs font-extrabold text-[#1F242D] tabular-nums shadow-xs"
          >
            <span>{sessionScoreLabel}</span>
          </div>

          <div className="inline-flex items-center gap-1">
            {(['❤️', '😂', '🔥'] as const).map((emoji) => (
              <button
                key={emoji}
                type="button"
                data-testid={`hub-reaction-${emoji}`}
                onClick={() => onSendReaction(emoji)}
                aria-label={`Envoyer ${emoji}`}
                className="w-8 h-8 rounded-full bg-white border border-[#EAE4DC] hover:border-[#FF6B57]/45 hover:bg-[#FFFDF9] flex items-center justify-center text-sm shadow-xs transition-transform active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. FIXED NAVIGATION BAR: Dynamic Category Tabs + Compact Search Field */}
      <section className="shrink-0 w-full max-w-6xl mx-auto px-3.5 sm:px-6 pb-2.5 space-y-2 border-b border-[#EAE4DC]/80">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Category Pills — Horizontal scroll on mobile with clean touch rhythm, wraps cleanly on desktop */}
          <div
            role="tablist"
            aria-label="Filter games by mood"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0"
          >
            {HUB_CATEGORY_IDS.map((catId) => {
              const active = activeCategory === catId;
              return (
                <button
                  key={catId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-category={catId}
                  onClick={() => onCategoryChange(catId)}
                  className={`min-h-[36px] px-3 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-bold transition-all whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#FF6B57] text-white shadow-[0_4px_12px_rgba(255,107,87,0.3)]'
                      : 'bg-white text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FFFDF9] hover:border-[#FF6B57]/40'
                  }`}
                >
                  {t.categories[catId]}
                </button>
              );
            })}
          </div>

          {/* Compact White Search Input */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]"
              aria-hidden="true"
            />
            <input
              type="search"
              data-testid="hub-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un jeu..."
              className="w-full min-h-[38px] ps-8.5 pe-8 py-1.5 rounded-full bg-white border border-[#EAE4DC] text-xs sm:text-sm font-medium text-[#1F242D] placeholder-[#6B7280] focus:border-[#FF6B57] focus:ring-2 focus:ring-[#FF6B57]/15 focus:outline-none transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer la recherche"
                className="absolute end-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#1F242D] hover:bg-[#FAF7F2]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. SCROLLABLE GAMES ZONE: Featured Parcheesi + Bento Pastel Grid */}
      <main className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-6 pt-3 pb-6">
        <div className="max-w-6xl mx-auto space-y-3.5">
          {/* Featured Card « ✨ À LA UNE » — Official Parcheesi */}
          {showFeaturedCard && featuredParcheesi && (
            <button
              type="button"
              data-game-card="parchisi-duo"
              data-testid="hub-featured-parcheesi"
              onClick={() => onSelectGame('parchisi-duo')}
              className="group w-full text-start rounded-3xl overflow-hidden bg-gradient-to-br from-[#FFFDF7] to-[#FEF4DC] border border-[#F3E3BE] shadow-[0_4px_20px_rgba(31,36,45,0.06)] hover:shadow-[0_8px_28px_rgba(31,36,45,0.1)] transition-all p-3.5 sm:p-4 flex items-center gap-3.5 sm:gap-5 active:scale-[0.99]"
            >
              <div className="relative w-20 h-20 sm:w-28 sm:h-24 rounded-2xl overflow-hidden border border-[#F3E3BE] shrink-0 bg-white shadow-xs">
                <img
                  src={featuredParcheesi.imageSrc}
                  alt={t.games['parchisi-duo'].title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 start-1.5 w-7 h-7 rounded-xl bg-white/92 border border-[#EAE4DC] flex items-center justify-center text-sm shadow-xs"
                >
                  {featuredParcheesi.emoji}
                </span>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/90 border border-[#F3E3BE] text-[10px] sm:text-[11px] font-extrabold tracking-wide text-[#B45309] uppercase">
                  <Sparkles className="w-3 h-3 text-[#F59E0B]" />
                  À LA UNE
                </span>
                <h2 className="text-base sm:text-xl font-extrabold text-[#1F242D] truncate">
                  {t.games['parchisi-duo'].title}
                </h2>
                <p className="text-xs sm:text-sm text-[#6B7280] line-clamp-2 leading-snug">
                  {t.games['parchisi-duo'].shortDesc}
                </p>
              </div>

              <span className="shrink-0 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-full bg-[#FF6B57] group-hover:bg-[#F25743] text-white text-xs sm:text-sm font-extrabold shadow-[0_6px_16px_rgba(255,107,87,0.34)] transition-all whitespace-nowrap">
                <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                <span>Jouer</span>
              </span>
            </button>
          )}

          {/* Pastel Bento Grid — 2 columns mobile, 3-4 columns desktop */}
          {bentoGames.length > 0 ? (
            <div
              data-testid="hub-bento-grid"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3.5 items-stretch"
            >
              {bentoGames.map((game, idx) => {
                const copy = t.games[game.id];
                const tone = PASTEL_BENTO_TONES[idx % PASTEL_BENTO_TONES.length];
                return (
                  <button
                    key={game.id}
                    type="button"
                    data-game-card={game.id}
                    onClick={() => onSelectGame(game.id)}
                    style={{
                      backgroundColor: tone.bg,
                      borderColor: tone.border,
                    }}
                    className="group text-start rounded-2xl overflow-hidden border shadow-[0_4px_16px_rgba(31,36,45,0.05)] hover:shadow-[0_8px_24px_rgba(31,36,45,0.09)] hover:-translate-y-0.5 active:scale-95 transition-all duration-200 flex flex-col p-2.5 sm:p-3 gap-2.5"
                  >
                    {/* Compact visual cover with floating emoji + sensor pill */}
                    <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-white/70 border border-white/80">
                      <img
                        src={game.imageSrc}
                        alt={copy.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute top-2 start-2 w-8 h-8 rounded-xl bg-white/92 backdrop-blur-sm border border-[#EAE4DC] flex items-center justify-center text-base shadow-xs"
                      >
                        {game.emoji}
                      </span>

                      <span className="absolute bottom-1.5 end-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm border border-[#EAE4DC] text-[10px] font-bold text-[#1F242D] shadow-xs">
                        {game.sensor === 'face' ? (
                          <ScanFace className="w-3 h-3 text-[#FF6B57] shrink-0" />
                        ) : game.sensor === 'hands' ? (
                          <Hand className="w-3 h-3 text-[#7C5CFC] shrink-0" />
                        ) : game.sensor === 'music' ? (
                          <Music className="w-3 h-3 text-[#0EA5E9] shrink-0" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-[#FF6B57] shrink-0" />
                        )}
                        <span className="hidden sm:inline">{sensorLabel(game.sensor)}</span>
                      </span>
                    </div>

                    {/* Title + crisp 1-line subtitle */}
                    <div className="flex-1 flex flex-col justify-between gap-1.5 px-0.5">
                      <div className="space-y-0.5">
                        <h3 className="text-sm sm:text-base font-extrabold text-[#1F242D] leading-snug line-clamp-1">
                          {copy.title}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-[#6B7280] line-clamp-2 leading-snug">
                          {copy.shortDesc}
                        </p>
                      </div>

                      <div className="pt-1 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#FF6B57] group-hover:translate-x-0.5 transition-transform">
                          <Play className="w-3 h-3 fill-current" />
                          <span>{t.launchShort}</span>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : !showFeaturedCard ? (
            <div className="rounded-3xl bg-white border border-[#EAE4DC] p-8 text-center space-y-2 shadow-xs">
              <p className="text-base font-bold text-[#1F242D]">Aucun jeu trouvé</p>
              <p className="text-xs text-[#6B7280]">Essaie un autre mot-clé ou une autre catégorie.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  onCategoryChange('all');
                }}
                className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#FF6B57] text-white text-xs font-bold hover:bg-[#F25743]"
              >
                Afficher tous les jeux
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
