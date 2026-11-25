import type { MutableRefObject } from 'react';
import { ArrowRight, Hand, ScanFace, Sparkles } from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  GameId,
  HubCategory,
  TrackerStatus,
} from '../types/duoplay';
import { CATEGORY_THEMES } from '../theme/categoryThemes';
import { useI18n } from '../i18n/LanguageContext';
import { CameraFeedTile } from './CameraFeedTile';

const CARD_LAUGH_SRC = '/src/assets/images/hub_card_laugh_1795451799128.jpg';
const CARD_STARE_SRC = '/src/assets/images/hub_card_stare_duel_1795529674561.jpg';
const CARD_MIAM_SRC = '/src/assets/images/hub_card_miam_mania_1795529675741.jpg';
const CARD_FUNAMBULES_SRC = '/src/assets/images/hub_card_funambules_1795451798892.jpg';
const CARD_NINJA_SRC = '/src/assets/images/hub_card_ninja_fruits_1795518758103.jpg';
const CARD_HOCKEY_SRC = '/src/assets/images/hub_card_air_hockey_1795518756217.jpg';
const CARD_KISS_SRC = '/src/assets/images/hub_card_kiss_bounce_1795533030461.jpg';
const CARD_CONSTELLATIONS_SRC = '/src/assets/images/hub_card_constellations_1795533032400.jpg';
const CARD_WHISPER_SRC = '/src/assets/images/hub_card_whisper_secrets_1795600847414.jpg';
const CARD_SLINGSHOT_SRC = '/src/assets/images/hub_card_slingshot_duo_1795617880651.jpg';
const CARD_XO_SRC = '/src/assets/images/hub_card_xo_neon_1795617881759.jpg';
const CARD_PARCHISI_SRC = '/src/assets/images/hub_card_parchisi_duo_1795619566495.jpg';
const CARD_COUPLE_JAM_SRC = '/src/assets/images/hub_card_couple_jam_1795624625924.jpg';

type SensorKind = 'face' | 'hands' | 'face-hands';

interface HubGameCardConfig {
  id: GameId;
  emoji: string;
  imageSrc: string;
  imageClassName: string;
  sensor: SensorKind;
  bannerTint: string;
  categories: Exclude<HubCategory, 'all'>[];
}

const HUB_CATEGORY_IDS: HubCategory[] = [
  'all',
  'drole',
  'action',
  'aventure',
  'romantique',
  'amusant',
  'sensuel',
];

const HUB_GAMES: HubGameCardConfig[] = [
  {
    id: 'laugh',
    emoji: '😂',
    imageSrc: CARD_LAUGH_SRC,
    imageClassName: 'scale-[1.06] group-hover:scale-[1.11]',
    sensor: 'face',
    bannerTint: 'from-[#FACC15]/25 via-transparent to-[#181232]',
    categories: ['drole', 'amusant'],
  },
  {
    id: 'stare-duel',
    emoji: '👀',
    imageSrc: CARD_STARE_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'face',
    bannerTint: 'from-[#FB923C]/25 via-transparent to-[#181232]',
    categories: ['drole', 'romantique', 'amusant'],
  },
  {
    id: 'miam-mania',
    emoji: '🍕',
    imageSrc: CARD_MIAM_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'face',
    bannerTint: 'from-[#EC4899]/25 via-transparent to-[#181232]',
    categories: ['drole', 'amusant'],
  },
  {
    id: 'funambules',
    emoji: '🧭',
    imageSrc: CARD_FUNAMBULES_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'face',
    bannerTint: 'from-[#10B981]/25 via-transparent to-[#181232]',
    categories: ['aventure', 'romantique'],
  },
  {
    id: 'ninja-fruits',
    emoji: '🍉',
    imageSrc: CARD_NINJA_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'hands',
    bannerTint: 'from-[#EF4444]/25 via-transparent to-[#181232]',
    categories: ['action', 'amusant'],
  },
  {
    id: 'air-hockey',
    emoji: '🏒',
    imageSrc: CARD_HOCKEY_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'hands',
    bannerTint: 'from-[#06B6D4]/25 via-transparent to-[#181232]',
    categories: ['action', 'drole', 'amusant'],
  },
  {
    id: 'kiss-bounce',
    emoji: '💋',
    imageSrc: CARD_KISS_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'face-hands',
    bannerTint: 'from-[#F43F5E]/25 via-transparent to-[#181232]',
    categories: ['romantique', 'amusant'],
  },
  {
    id: 'constellations',
    emoji: '✨',
    imageSrc: CARD_CONSTELLATIONS_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'hands',
    bannerTint: 'from-[#C084FC]/25 via-transparent to-[#181232]',
    categories: ['romantique', 'aventure'],
  },
  {
    id: 'whisper-secrets',
    emoji: '🔥',
    imageSrc: CARD_WHISPER_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'face',
    bannerTint: 'from-[#BE123C]/35 via-transparent to-[#181232]',
    categories: ['sensuel', 'romantique'],
  },
  {
    id: 'slingshot-duo',
    emoji: '🎯',
    imageSrc: CARD_SLINGSHOT_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'hands',
    bannerTint: 'from-[#FF4D8D]/28 via-transparent to-[#181232]',
    categories: ['action'],
  },
  {
    id: 'xo-neon',
    emoji: '⭕',
    imageSrc: CARD_XO_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'hands',
    bannerTint: 'from-[#D946EF]/28 via-transparent to-[#181232]',
    categories: ['amusant'],
  },
  {
    id: 'parchisi-duo',
    emoji: '🎲',
    imageSrc: CARD_PARCHISI_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'hands',
    bannerTint: 'from-[#F59E0B]/30 via-transparent to-[#181232]',
    categories: ['amusant'],
  },
  {
    id: 'couple-jam',
    emoji: '🎵',
    imageSrc: CARD_COUPLE_JAM_SRC,
    imageClassName: 'group-hover:scale-[1.05]',
    sensor: 'hands',
    bannerTint: 'from-[#7C3AED]/35 via-transparent to-[#181232]',
    categories: ['amusant'],
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
  kissBestRally: number;
  constellationsCompleted: number;
  whisperBestHeat: number;
  slingshotBestScore: number;
  xoNeonWins: number;
  parchisiWins: number;
  coupleJamBestScore: number;
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
  kissBestRally,
  constellationsCompleted,
  whisperBestHeat,
  slingshotBestScore,
  xoNeonWins,
  parchisiWins,
  coupleJamBestScore,
  onVideoRef,
  onRequestCamera,
  onSelectGame,
}: HubViewProps) {
  const { t } = useI18n();
  const isSolo = connectionMode === 'solo';
  const theme = CATEGORY_THEMES[activeCategory];

  const visibleGames =
    activeCategory === 'all'
      ? HUB_GAMES
      : HUB_GAMES.filter((g) => g.categories.includes(activeCategory));

  const statBits: string[] = [];
  if (laughMatchCount > 0) statBits.push(`${t.games.laugh.title} ×${laughMatchCount}`);
  if (stareBestSec > 0) statBits.push(`${t.games['stare-duel'].title} ${stareBestSec.toFixed(1)}s`);
  if (miamBestScore > 0) statBits.push(`${t.games['miam-mania'].title} ${miamBestScore}`);
  if (funambulesBestM > 0) statBits.push(`${t.games.funambules.title} ${Math.round(funambulesBestM)}m`);
  if (ninjaBestScore > 0) statBits.push(`${t.games['ninja-fruits'].title} ${ninjaBestScore}`);
  if (airHockeyWins > 0) statBits.push(`${t.games['air-hockey'].title} ×${airHockeyWins}`);
  if (kissBestRally > 0) statBits.push(`${t.games['kiss-bounce'].title} ×${kissBestRally}`);
  if (constellationsCompleted > 0) statBits.push(`${t.games.constellations.title} ★${constellationsCompleted}`);
  if (whisperBestHeat > 16) statBits.push(`${t.games['whisper-secrets'].title} 🔥${whisperBestHeat}%`);
  if (slingshotBestScore > 0) statBits.push(`${t.games['slingshot-duo'].title} ${slingshotBestScore}`);
  if (xoNeonWins > 0) statBits.push(`${t.games['xo-neon'].title} ×${xoNeonWins}`);
  if (parchisiWins > 0) statBits.push(`${t.games['parchisi-duo'].title} 👑${parchisiWins}`);
  if (coupleJamBestScore > 0) statBits.push(`${t.games['couple-jam'].title} 🎵${coupleJamBestScore}`);

  const sensorLabel = (sensor: SensorKind) =>
    sensor === 'face'
      ? t.sensorFace
      : sensor === 'hands'
        ? t.sensorHands
        : t.sensorFaceHands;

  return (
    <div
      data-hub-theme={activeCategory}
      className="relative flex-1 w-full transition-all duration-500"
    >
      <main className="relative z-10 w-full max-w-6xl mx-auto px-3.5 sm:px-6 py-3.5 sm:py-5 space-y-4 sm:space-y-5">
        {/* 1. Compact Couple Video Strip — Side-by-side on PC & phones so game cards stay immediately visible */}
        <section
          aria-label="Room cameras"
          className="max-w-xl mx-auto grid grid-cols-2 gap-2.5 sm:gap-3.5"
        >
          <CameraFeedTile
            name={localName}
            subtitle={
              localStream && trackerStatus === 'ready'
                ? t.camReady
                : trackerStatus === 'loading'
                  ? t.camLoading
                  : t.camFallback
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
            compact
          />
          <CameraFeedTile
            name={partnerName}
            subtitle={isSolo ? t.partnerAiSub : t.partnerLiveSub}
            stream={remoteStream}
            isAi={isSolo}
            metricsRef={partnerMetricsRef}
            compact
          />
        </section>

        {/* 2. Dynamic Category Switcher & Game Grid */}
        <section className="space-y-3.5 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {t.hubTitle}
              </h1>
              <p className="text-xs sm:text-sm text-white/80 mt-0.5">{t.hubSubtitle}</p>
            </div>
            <p className="text-xs font-semibold text-white/80 tabular-nums">
              {statBits.length > 0
                ? statBits.join(' · ')
                : activeCategory === 'all'
                  ? t.gamesAvailable
                  : `${visibleGames.length} / ${HUB_GAMES.length} · ${t.categories[activeCategory]}`}
            </p>
          </div>

          {/* Interactive Color-Switching Category Pills — Flex-wrap so ZERO tabs are hidden on mobile! */}
          <div
            role="tablist"
            aria-label="Filter games by mood"
            className="flex flex-wrap items-center gap-2"
          >
            {HUB_CATEGORY_IDS.map((catId) => {
              const active = activeCategory === catId;
              const catTheme = CATEGORY_THEMES[catId];
              return (
                <button
                  key={catId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-category={catId}
                  onClick={() => onCategoryChange(catId)}
                  style={
                    active
                      ? {
                          background: catTheme.primaryGradient,
                          color: catTheme.primaryText,
                          boxShadow: catTheme.glowShadow,
                        }
                      : undefined
                  }
                  className={`relative min-h-[42px] px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                    active
                      ? 'border border-white/40 scale-[1.02]'
                      : 'text-white/90 hover:text-white bg-white/12 hover:bg-white/20 border border-white/20'
                  }`}
                >
                  <span className="relative z-10">{t.categories[catId]}</span>
                </button>
              );
            })}
          </div>

          {/* 3. Readable 2-to-3 Column Pop Arcade Game Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
            {visibleGames.map((game) => {
              const copy = t.games[game.id];
              return (
                <button
                  key={game.id}
                  type="button"
                  data-game-card={game.id}
                  onClick={() => onSelectGame(game.id)}
                  style={{ borderColor: theme.borderColor }}
                  className="group text-start rounded-3xl overflow-hidden bg-[#1A1434]/82 border shadow-xl shadow-black/25 hover:-translate-y-1.5 hover:bg-[#211A40]/90 transition-all duration-300 flex flex-col focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
                >
                  {/* Visual Banner + Floating Emoji Badge + Sensor Tag */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#181232]">
                    <img
                      src={game.imageSrc}
                      alt={copy.title}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-cover transition-transform duration-300 ${game.imageClassName}`}
                    />
                    <div
                      className={`absolute inset-0 bg-gradient-to-t ${game.bannerTint}`}
                      aria-hidden="true"
                    />

                    {/* Top-left expressive emoji badge */}
                    <span
                      aria-hidden="true"
                      className="absolute top-3 start-3 w-10 h-10 rounded-2xl bg-[#120E24]/82 border border-white/25 flex items-center justify-center text-xl shadow-md"
                    >
                      {game.emoji}
                    </span>

                    {/* Top-right discreet sensor tag (Visage / Mains / Visage & Mains) */}
                    <span
                      style={{
                        backgroundColor: theme.badgeBg,
                        color: theme.badgeText,
                      }}
                      className="absolute top-3 end-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/20 text-[11px] font-bold shadow-sm"
                    >
                      {game.sensor === 'face' ? (
                        <ScanFace className="w-3.5 h-3.5 shrink-0" />
                      ) : game.sensor === 'hands' ? (
                        <Hand className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{sensorLabel(game.sensor)}</span>
                    </span>
                  </div>

                  {/* Clean Card Body: Title + 1-line description + Vivid "Lancer" Button */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-extrabold text-white leading-snug">
                        {copy.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-white/80 line-clamp-2 leading-relaxed">
                        {copy.shortDesc}
                      </p>
                    </div>

                    <div
                      style={{
                        background: theme.primaryGradient,
                        color: theme.primaryText,
                        boxShadow: theme.glowShadow,
                      }}
                      className="btn-shine min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold transition-all"
                    >
                      <span>{t.launchShort}</span>
                      <ArrowRight className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
