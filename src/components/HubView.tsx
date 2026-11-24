import { useState, type MutableRefObject } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
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
const CARD_KISS_SRC = '/src/assets/images/hub_card_kiss_bounce_1795533030461.jpg';
const CARD_CONSTELLATIONS_SRC = '/src/assets/images/hub_card_constellations_1795533032400.jpg';

interface HubGameCardConfig {
  id: GameId;
  imageSrc: string;
  imageClassName: string;
  accentHex: string;
  hoverBorderClass: string;
  hoverCtaClass: string;
  categories: Exclude<HubCategory, 'all'>[];
}

const HUB_CATEGORY_IDS: HubCategory[] = [
  'all',
  'drole',
  'action',
  'aventure',
  'romantique',
  'amusant',
];

const HUB_GAMES: HubGameCardConfig[] = [
  {
    id: 'laugh',
    imageSrc: CARD_LAUGH_SRC,
    imageClassName: 'scale-[1.07] group-hover:scale-[1.11]',
    accentHex: '#E86A58',
    hoverBorderClass: 'hover:border-[#E86A58]/70',
    hoverCtaClass: 'group-hover:text-[#F08272]',
    categories: ['drole', 'amusant'],
  },
  {
    id: 'stare-duel',
    imageSrc: CARD_STARE_SRC,
    imageClassName: 'group-hover:scale-[1.04]',
    accentHex: '#E8B861',
    hoverBorderClass: 'hover:border-[#E8B861]/70',
    hoverCtaClass: 'group-hover:text-[#F2CB80]',
    categories: ['drole', 'romantique', 'amusant'],
  },
  {
    id: 'miam-mania',
    imageSrc: CARD_MIAM_SRC,
    imageClassName: 'group-hover:scale-[1.04]',
    accentHex: '#E86A58',
    hoverBorderClass: 'hover:border-[#E86A58]/70',
    hoverCtaClass: 'group-hover:text-[#F08272]',
    categories: ['drole', 'amusant'],
  },
  {
    id: 'funambules',
    imageSrc: CARD_FUNAMBULES_SRC,
    imageClassName: 'group-hover:scale-[1.04]',
    accentHex: '#E8B861',
    hoverBorderClass: 'hover:border-[#E8B861]/70',
    hoverCtaClass: 'group-hover:text-[#F2CB80]',
    categories: ['aventure', 'romantique'],
  },
  {
    id: 'ninja-fruits',
    imageSrc: CARD_NINJA_SRC,
    imageClassName: 'group-hover:scale-[1.04]',
    accentHex: '#E86A58',
    hoverBorderClass: 'hover:border-[#E86A58]/70',
    hoverCtaClass: 'group-hover:text-[#F08272]',
    categories: ['action', 'amusant'],
  },
  {
    id: 'air-hockey',
    imageSrc: CARD_HOCKEY_SRC,
    imageClassName: 'group-hover:scale-[1.04]',
    accentHex: '#E8B861',
    hoverBorderClass: 'hover:border-[#E8B861]/70',
    hoverCtaClass: 'group-hover:text-[#F2CB80]',
    categories: ['action', 'drole', 'amusant'],
  },
  {
    id: 'kiss-bounce',
    imageSrc: CARD_KISS_SRC,
    imageClassName: 'group-hover:scale-[1.04]',
    accentHex: '#E86A58',
    hoverBorderClass: 'hover:border-[#E86A58]/70',
    hoverCtaClass: 'group-hover:text-[#F08272]',
    categories: ['romantique', 'amusant'],
  },
  {
    id: 'constellations',
    imageSrc: CARD_CONSTELLATIONS_SRC,
    imageClassName: 'group-hover:scale-[1.04]',
    accentHex: '#E8B861',
    hoverBorderClass: 'hover:border-[#E8B861]/70',
    hoverCtaClass: 'group-hover:text-[#F2CB80]',
    categories: ['romantique', 'aventure'],
  },
];

interface HubViewProps {
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
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSelectGame: (game: GameId) => void;
}

export function HubView({
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
  onVideoRef,
  onRequestCamera,
  onSelectGame,
}: HubViewProps) {
  const { t } = useI18n();
  const isSolo = connectionMode === 'solo';
  const [selectedCategory, setSelectedCategory] = useState<HubCategory>('all');

  const visibleGames =
    selectedCategory === 'all'
      ? HUB_GAMES
      : HUB_GAMES.filter((g) => g.categories.includes(selectedCategory));

  const statBits: string[] = [];
  if (laughMatchCount > 0) statBits.push(`${t.games.laugh.title} ×${laughMatchCount}`);
  if (stareBestSec > 0) statBits.push(`${t.games['stare-duel'].title} ${stareBestSec.toFixed(1)}s`);
  if (miamBestScore > 0) statBits.push(`${t.games['miam-mania'].title} ${miamBestScore}`);
  if (funambulesBestM > 0) statBits.push(`${t.games.funambules.title} ${Math.round(funambulesBestM)}m`);
  if (ninjaBestScore > 0) statBits.push(`${t.games['ninja-fruits'].title} ${ninjaBestScore}`);
  if (airHockeyWins > 0) statBits.push(`${t.games['air-hockey'].title} ×${airHockeyWins}`);
  if (kissBestRally > 0) statBits.push(`${t.games['kiss-bounce'].title} ×${kissBestRally}`);
  if (constellationsCompleted > 0) statBits.push(`${t.games.constellations.title} ★${constellationsCompleted}`);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Top Duo Camera Bar — balanced compact height */}
      <section
        aria-label="Room cameras"
        className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4"
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

      {/* Synchronized Game Picker with Mood Category Tabs */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#F6F2E9] tracking-tight">
              {t.hubTitle}
            </h1>
            <p className="text-sm text-[#CBC4B6] mt-0.5">{t.hubSubtitle}</p>
          </div>
          <p className="text-xs text-[#A9A295] tabular-nums">
            {statBits.length > 0 ? statBits.join(' · ') : t.gamesAvailable}
          </p>
        </div>

        {/* Category Filter Tabs */}
        <div
          role="tablist"
          aria-label="Filter games by mood"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
        >
          {HUB_CATEGORY_IDS.map((catId) => {
            const active = selectedCategory === catId;
            return (
              <button
                key={catId}
                type="button"
                role="tab"
                aria-selected={active}
                data-category={catId}
                onClick={() => setSelectedCategory(catId)}
                className={`relative px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-[#E8B861] ${
                  active
                    ? 'text-[#11131E]'
                    : 'text-[#CBC4B6] hover:text-[#F6F2E9] bg-white/[0.04] hover:bg-white/[0.08] border border-white/10'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="couplecam-hub-category"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-[#E8B861] -z-0"
                  />
                )}
                <span className="relative z-10">{t.categories[catId]}</span>
              </button>
            );
          })}
        </div>

        {/* Responsive 2-Column Game Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
          {visibleGames.map((game) => {
            const copy = t.games[game.id];
            return (
              <button
                key={game.id}
                type="button"
                data-game-card={game.id}
                onClick={() => onSelectGame(game.id)}
                className={`group text-start rounded-2xl overflow-hidden bg-[#141724] border border-white/12 ring-1 ring-inset ring-white/5 ${game.hoverBorderClass} hover:-translate-y-1 hover:shadow-xl hover:shadow-black/35 transition-all duration-200 flex flex-col focus-visible:ring-2 focus-visible:ring-[#E8B861]`}
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#151828]">
                  <img
                    src={game.imageSrc}
                    alt={copy.title}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover transition-transform duration-300 ${game.imageClassName}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141724] via-transparent to-transparent" />
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium" style={{ color: game.accentHex }}>
                      {copy.badge}
                    </p>
                    <h2 className="text-2xl font-semibold text-[#F6F2E9]">{copy.title}</h2>
                    <p className="text-sm text-[#CBC4B6] leading-relaxed">{copy.description}</p>
                  </div>

                  <div
                    className={`flex items-center justify-between pt-3 border-t border-white/8 text-sm font-semibold text-[#F6F2E9] ${game.hoverCtaClass} transition-colors`}
                  >
                    <span>{copy.cta}</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
