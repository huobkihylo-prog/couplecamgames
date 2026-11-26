import { useMemo, useState, type MutableRefObject } from 'react';
import { Play, Search, X } from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  GameId,
  HubCategory,
  TrackerStatus,
} from '../types/duoplay';
import { useI18n } from '../i18n/LanguageContext';
import { CameraFeedTile } from './CameraFeedTile';

interface HubGameCardConfig {
  id: GameId;
  emoji: string;
  tiltClass: string;
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

/** Exact 6 soft pastel card styles cycled across the Hub bento grid */
const PASTEL_BENTO_STYLES = [
  'bg-[#F1ECFD] border-[#DDD2FA] hover:bg-[#EAE2FC]', // Lavande
  'bg-[#E7F7F0] border-[#C9EBD9] hover:bg-[#DCF3E9]', // Menthe
  'bg-[#E8F4FD] border-[#C8E3F8] hover:bg-[#DDEFFC]', // Bleu ciel
  'bg-[#FEF7DE] border-[#F7E4B0] hover:bg-[#FDF2CE]', // Jaune beurre
  'bg-[#FDEFE9] border-[#F8D6C7] hover:bg-[#FCE6DC]', // Pêche
  'bg-[#FCEBF1] border-[#F5CEDD] hover:bg-[#FADEE9]', // Rose poudré
] as const;

const HUB_GAMES: HubGameCardConfig[] = [
  { id: 'laugh', emoji: '😂', tiltClass: '-rotate-6', categories: ['drole', 'amusant'] },
  { id: 'stare-duel', emoji: '👀', tiltClass: 'rotate-6', categories: ['drole', 'romantique', 'amusant'] },
  { id: 'miam-mania', emoji: '🍕', tiltClass: '-rotate-6', categories: ['drole', 'amusant'] },
  { id: 'funambules', emoji: '🧭', tiltClass: 'rotate-6', categories: ['aventure', 'romantique'] },
  { id: 'ninja-fruits', emoji: '🍉', tiltClass: '-rotate-6', categories: ['action', 'amusant'] },
  { id: 'air-hockey', emoji: '🏒', tiltClass: 'rotate-6', categories: ['action', 'drole', 'amusant'] },
  { id: 'whisper-secrets', emoji: '💋', tiltClass: '-rotate-6', categories: ['sensuel', 'romantique'] },
  { id: 'slingshot-duo', emoji: '🎯', tiltClass: 'rotate-6', categories: ['action'] },
  { id: 'xo-neon', emoji: '⭕', tiltClass: '-rotate-6', categories: ['amusant'] },
  { id: 'parchisi-duo', emoji: '🎲', tiltClass: 'rotate-6', categories: ['amusant'] },
  { id: 'music-quiz', emoji: '⚡', tiltClass: '-rotate-6', categories: ['musique'] },
  { id: 'freeze-dance', emoji: '🥶', tiltClass: 'rotate-6', categories: ['musique'] },
];

/** Clean, luminous light-wood Parcheesi board + 2 dice SVG illustration on transparent background */
function ParcheesiBoardIllustration() {
  return (
    <svg
      viewBox="0 0 148 136"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-[104px] h-[96px] sm:w-[136px] sm:h-[124px] shrink-0 drop-shadow-[0_8px_18px_rgba(146,100,45,0.22)] transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-1"
    >
      {/* Tilted light-wood Parcheesi board */}
      <g transform="translate(8 6) rotate(-5 56 56)">
        {/* Outer light-wood beveled frame */}
        <rect x="4" y="4" width="104" height="104" rx="16" fill="#E6B882" stroke="#C89255" strokeWidth="2.5" />
        <rect x="10" y="10" width="92" height="92" rx="10" fill="#FFFDF8" stroke="#D5A671" strokeWidth="1.5" />

        {/* 4 Classic Corner Home Bases */}
        {/* Top-Left Blue */}
        <rect x="13" y="13" width="33" height="33" rx="6" fill="#5CA9F6" />
        <circle cx="23.5" cy="23.5" r="4.2" fill="#2B7AD0" />
        <circle cx="35.5" cy="23.5" r="4.2" fill="#2B7AD0" />
        <circle cx="23.5" cy="35.5" r="4.2" fill="#2B7AD0" />
        <circle cx="35.5" cy="35.5" r="4.2" fill="#2B7AD0" />

        {/* Top-Right Yellow */}
        <rect x="66" y="13" width="33" height="33" rx="6" fill="#FBD34D" />
        <circle cx="76.5" cy="23.5" r="4.2" fill="#D99B16" />
        <circle cx="88.5" cy="23.5" r="4.2" fill="#D99B16" />
        <circle cx="76.5" cy="35.5" r="4.2" fill="#D99B16" />
        <circle cx="88.5" cy="35.5" r="4.2" fill="#D99B16" />
        {/* Yellow token highlights */}
        <circle cx="76.5" cy="23.5" r="2.2" fill="#FFF7D6" />
        <circle cx="88.5" cy="35.5" r="2.2" fill="#FFF7D6" />

        {/* Bottom-Left Red */}
        <rect x="13" y="66" width="33" height="33" rx="6" fill="#F56E66" />
        <circle cx="23.5" cy="76.5" r="4.2" fill="#C93B35" />
        <circle cx="35.5" cy="76.5" r="4.2" fill="#C93B35" />
        <circle cx="23.5" cy="88.5" r="4.2" fill="#C93B35" />
        <circle cx="35.5" cy="88.5" r="4.2" fill="#C93B35" />
        {/* Red token highlights */}
        <circle cx="23.5" cy="76.5" r="2.2" fill="#FFE6E3" />
        <circle cx="35.5" cy="88.5" r="2.2" fill="#FFE6E3" />

        {/* Bottom-Right Green */}
        <rect x="66" y="66" width="33" height="33" rx="6" fill="#52C084" />
        <circle cx="76.5" cy="76.5" r="4.2" fill="#298F59" />
        <circle cx="88.5" cy="76.5" r="4.2" fill="#298F59" />
        <circle cx="76.5" cy="88.5" r="4.2" fill="#298F59" />
        <circle cx="88.5" cy="88.5" r="4.2" fill="#298F59" />

        {/* Colored Home Columns */}
        <rect x="52.5" y="13" width="7" height="33" fill="#5CA9F6" opacity="0.88" />
        <rect x="52.5" y="66" width="7" height="33" fill="#52C084" opacity="0.88" />
        <rect x="13" y="52.5" width="33" height="7" fill="#F56E66" opacity="0.88" />
        <rect x="66" y="52.5" width="33" height="7" fill="#FBD34D" opacity="0.92" />

        {/* Subtle crisp tile grid lines */}
        <g stroke="#E4DACB" strokeWidth="1">
          <line x1="46" y1="24" x2="66" y2="24" />
          <line x1="46" y1="35" x2="66" y2="35" />
          <line x1="46" y1="77" x2="66" y2="77" />
          <line x1="46" y1="88" x2="66" y2="88" />
          <line x1="24" y1="46" x2="24" y2="66" />
          <line x1="35" y1="46" x2="35" y2="66" />
          <line x1="77" y1="46" x2="77" y2="66" />
          <line x1="88" y1="46" x2="88" y2="66" />
        </g>

        {/* Center 4-color Home Triangles */}
        <polygon points="46,46 66,46 56,56" fill="#5CA9F6" />
        <polygon points="66,46 66,66 56,56" fill="#FBD34D" />
        <polygon points="46,66 66,66 56,56" fill="#52C084" />
        <polygon points="46,46 46,66 56,56" fill="#F56E66" />
        <circle cx="56" cy="56" r="5" fill="#FFFDF8" stroke="#E5B97C" strokeWidth="1.4" />
        <circle cx="56" cy="56" r="2.2" fill="#FF6B57" />
      </g>

      {/* Playful 2 Cream Dice in Foreground */}
      {/* Back Die (5 pips) */}
      <g transform="translate(88 76) rotate(12 16 16)">
        <rect x="2" y="2" width="28" height="28" rx="7" fill="#FFFDF9" stroke="#E8DCCB" strokeWidth="2" />
        <circle cx="10" cy="10" r="2.3" fill="#FF6B57" />
        <circle cx="22" cy="10" r="2.3" fill="#FF6B57" />
        <circle cx="16" cy="16" r="2.3" fill="#FF6B57" />
        <circle cx="10" cy="22" r="2.3" fill="#FF6B57" />
        <circle cx="22" cy="22" r="2.3" fill="#FF6B57" />
      </g>

      {/* Front Die (6 pips) */}
      <g transform="translate(106 94) rotate(-8 16 16)">
        <rect x="2" y="2" width="30" height="30" rx="7.5" fill="#FFFFFF" stroke="#E3D4BE" strokeWidth="2" />
        <circle cx="11" cy="9.5" r="2.3" fill="#1F242D" />
        <circle cx="23" cy="9.5" r="2.3" fill="#1F242D" />
        <circle cx="11" cy="17" r="2.3" fill="#1F242D" />
        <circle cx="23" cy="17" r="2.3" fill="#1F242D" />
        <circle cx="11" cy="24.5" r="2.3" fill="#1F242D" />
        <circle cx="23" cy="24.5" r="2.3" fill="#1F242D" />
      </g>
    </svg>
  );
}

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
  onVideoRef,
  onRequestCamera,
  onSelectGame,
}: HubViewProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const isSolo = connectionMode === 'solo';

  // Aggregate couple session score displayed on the centered floating peach pill
  const localScore = laughMatchCount + airHockeyWins + xoNeonWins + parchisiWins + freezeDanceWins;
  const partnerHighlights =
    (stareBestSec > 0 ? 1 : 0) +
    (miamBestScore > 0 ? 1 : 0) +
    (funambulesBestM > 0 ? 1 : 0) +
    (ninjaBestScore > 0 ? 1 : 0) +
    (whisperBestHeat > 16 ? 1 : 0) +
    (slingshotBestScore > 0 ? 1 : 0) +
    (musicQuizBestScore > 0 ? 1 : 0);

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
  const showFeaturedCard =
    Boolean(featuredParcheesi) &&
    searchQuery.trim().length === 0 &&
    (activeCategory === 'all' || activeCategory === 'amusant');
  const bentoGames = showFeaturedCard
    ? visibleGames.filter((g) => g.id !== 'parchisi-duo')
    : visibleGames;

  return (
    <div
      data-hub-theme={activeCategory}
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#FAF7F2] text-[#1F242D]"
    >
      {/* 1. FIXED TOP ZONE: 2 Cameras + Centered Floating Peach Score Pill */}
      <section
        aria-label="Room cameras"
        className="shrink-0 w-full max-w-6xl mx-auto px-3.5 sm:px-6 pt-3 pb-2.5"
      >
        <div className="relative max-w-2xl mx-auto grid grid-cols-2 gap-3">
          <CameraFeedTile
            name={localName}
            stream={localStream}
            isLocal
            cameraEnabled={cameraEnabled}
            micMuted={micMuted}
            trackerStatus={trackerStatus}
            showTrackingReadout
            metricsRef={localMetricsRef}
            onVideoRef={onVideoRef}
            onRequestCamera={onRequestCamera}
            minimalLabel
            frameClassName="h-[132px] sm:h-[168px]"
          />

          <CameraFeedTile
            name={partnerName}
            stream={remoteStream}
            isAi={isSolo}
            metricsRef={partnerMetricsRef}
            minimalLabel
            frameClassName="h-[132px] sm:h-[168px]"
          />

          {/* Centered Floating Peach Score Pill overlapping between both cameras */}
          <div
            data-testid="hub-session-score-pill"
            dir="ltr"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 inline-flex items-center gap-1.5 bg-[#FFE6DF] border-2 border-white shadow-md px-3.5 py-1 rounded-full text-sm font-extrabold text-[#1F242D] tabular-nums whitespace-nowrap select-none"
          >
            <span aria-hidden="true">❤️</span>
            <span>
              {localScore} - {partnerHighlights}
            </span>
            <span aria-hidden="true">❤️</span>
          </div>

          {/* Floating emoji reactions burst over cameras */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden flex items-end justify-center pb-4 z-10"
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
      </section>

      {/* 2. FIXED NAVIGATION BAR: Slim Category Pills + Clean White Search Input */}
      <section className="shrink-0 w-full max-w-6xl mx-auto px-3.5 sm:px-6 pb-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Category Pills — Zero visible scrollbar */}
          <div
            role="tablist"
            aria-label="Filter games by mood"
            className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-0.5 flex-1 min-w-0"
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
                  className={`py-1.5 px-3.5 rounded-full text-[13px] sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#FF6B57] text-white shadow-[0_4px_12px_rgba(255,107,87,0.28)]'
                      : 'bg-white text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FFFDF9] hover:border-[#FF6B57]/40'
                  }`}
                >
                  {t.categories[catId]}
                </button>
              );
            })}
          </div>

          {/* Clean White Search Input */}
          <div className="relative w-full sm:w-52 shrink-0">
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]"
              aria-hidden="true"
            />
            <input
              type="search"
              data-testid="hub-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.hubSearchPlaceholder}
              className="w-full h-10 ps-10 pe-8 rounded-xl bg-white border border-[#EAE4DC] shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-sm font-medium text-[#1F242D] placeholder-[#6B7280] focus:border-[#FF6B57] focus:ring-2 focus:ring-[#FF6B57]/15 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute end-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#1F242D] hover:bg-[#FAF7F2] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. SCROLLABLE GAMES ZONE: Zero visible scrollbar, Featured Parcheesi + Compact Pastel Bento Grid */}
      <main className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-3.5 sm:px-6 pt-1 pb-6">
        <div className="max-w-6xl mx-auto space-y-3.5">
          {/* Featured Card « ✨ À LA UNE » — Official Parcheesi */}
          {showFeaturedCard && featuredParcheesi && (
            <button
              type="button"
              data-game-card="parchisi-duo"
              data-testid="hub-featured-parcheesi"
              onClick={() => onSelectGame('parchisi-duo')}
              className="group w-full text-start rounded-3xl p-5 bg-gradient-to-br from-[#FFFDF7] to-[#FEF4DC] border border-[#F2E1B6] shadow-[0_4px_20px_rgba(31,36,45,0.05)] hover:shadow-[0_8px_28px_rgba(31,36,45,0.09)] transition-all flex items-center justify-between gap-4 active:scale-[0.99] cursor-pointer"
            >
              {/* Text Block (vertically stacked with Coral Pill Play CTA right below) */}
              <div className="flex-1 min-w-0 flex flex-col items-start">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#F5E6C4] text-[#9A742B] text-[11px] font-bold tracking-wide">
                  {t.hubFeaturedBadge}
                </span>
                <h2 className="mt-1.5 text-2xl font-extrabold text-[#1F242D] leading-tight tracking-tight">
                  {t.games['parchisi-duo'].title}
                </h2>
                <p className="mt-1 text-xs text-[#6B7280] line-clamp-2 leading-relaxed max-w-md">
                  {t.games['parchisi-duo'].shortDesc}
                </p>
                <span className="mt-3 inline-flex items-center justify-center gap-1.5 bg-[#FF6B57] group-hover:bg-[#F25743] text-white rounded-full px-5 py-2 text-xs sm:text-sm font-bold shadow-sm transition-colors whitespace-nowrap">
                  <Play className="w-3.5 h-3.5 fill-current shrink-0 rtl:rotate-180" />
                  <span>{t.hubPlayBtn}</span>
                </span>
              </div>

              {/* Clean Luminous Light-Wood Parcheesi SVG + 2 Dice (Transparent background) */}
              <ParcheesiBoardIllustration />
            </button>
          )}

          {/* Compact Pastel Bento Grid — Zero dark images, pure title + 1-line subtitle + crisp emoji */}
          {bentoGames.length > 0 ? (
            <div
              data-testid="hub-bento-grid"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-stretch"
            >
              {bentoGames.map((game, idx) => {
                const copy = t.games[game.id];
                const toneClass = PASTEL_BENTO_STYLES[idx % PASTEL_BENTO_STYLES.length];
                return (
                  <button
                    key={game.id}
                    type="button"
                    data-game-card={game.id}
                    onClick={() => onSelectGame(game.id)}
                    className={`group text-start rounded-2xl p-4 min-h-[108px] border-[1.5px] shadow-[0_2px_10px_rgba(31,36,45,0.03)] hover:shadow-[0_6px_20px_rgba(31,36,45,0.07)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 flex items-center justify-between gap-2.5 cursor-pointer ${toneClass}`}
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-extrabold text-[#1F242D] leading-tight line-clamp-2">
                        {copy.title}
                      </h3>
                      <p className="text-xs text-[#5A6270] mt-1 line-clamp-1 leading-snug">
                        {copy.shortDesc}
                      </p>
                    </div>

                    <span
                      aria-hidden="true"
                      className={`text-4xl leading-none shrink-0 select-none drop-shadow-sm transition-transform duration-200 group-hover:scale-110 group-hover:rotate-0 ${game.tiltClass}`}
                    >
                      {game.emoji}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : !showFeaturedCard ? (
            <div className="rounded-3xl bg-white border border-[#EAE4DC] p-8 text-center space-y-2 shadow-xs">
              <p className="text-base font-bold text-[#1F242D]">{t.hubNoResultsTitle}</p>
              <p className="text-xs text-[#6B7280]">{t.hubNoResultsSub}</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  onCategoryChange('all');
                }}
                className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#FF6B57] text-white text-xs font-bold hover:bg-[#F25743] cursor-pointer"
              >
                {t.hubShowAllBtn}
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
