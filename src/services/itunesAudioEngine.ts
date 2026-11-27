/**
 * Shared Cross-Browser iTunes JSONP & Native HTML5 Audio Engine
 * Used by: "Quiz Éclair 4 Choix" and "1, 2, 3… Statue Musicale (Freeze Dance)".
 *
 * Strict cross-browser guarantees (iOS Safari, Android Chrome/Samsung/Firefox, Desktop):
 * - Zero CORS errors: queries iTunes Search API exclusively via JSONP (<script> tag injection)
 *   with unique callbacks, immediate DOM/window cleanup, 7s timeout, strict HTTPS previewUrl
 *   filtering, and in-memory category/term cache.
 * - Zero Apple audio CORS blocks: NEVER sets audio.crossOrigin and NEVER connects <audio>
 *   to AudioContext.createMediaElementSource().
 * - Zero interrupted playback: single persistent HTMLAudioElement, playPromise tracking with
 *   silent AbortError handling, safe unlock() that never cancels a real track, and 4-second
 *   anti-stall + onerror auto-skip hook.
 * - Clean teardown ONLY on unmount / game exit / intentional FREEZE_STOP without ever touching
 *   PeerJS MediaStream tracks.
 */

import { soundFx } from '../utils/soundFx';

export interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  previewUrl: string;
  artworkUrl: string;
  artworkUrlHiRes: string;
  primaryGenreName?: string;
}

interface RawItunesSong {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  primaryGenreName?: string;
}

interface RawItunesResponse {
  resultCount?: number;
  results?: RawItunesSong[];
}

interface RawDeezerTrack {
  id?: number;
  title?: string;
  preview?: string;
  artist?: { name?: string };
  album?: { title?: string; cover_medium?: string; cover_big?: string };
}

interface RawDeezerResponse {
  data?: RawDeezerTrack[];
}

export const ITUNES_JSONP_TIMEOUT_MS = 7000;
export const PLAYBACK_STALL_TIMEOUT_MS = 4000;
export const DEFAULT_AUDIO_VOLUME = 0.85;

let jsonpSeq = 0;

/** Track cache per normalized term during the session for fast replays */
const termCache = new Map<string, ItunesTrack[]>();

/** Track pool cache per category key for instant replay & auto-skip fallback */
const categoryPoolCache = new Map<string, ItunesTrack[]>();

/** Active cleanup callbacks so leaving a game immediately cancels pending requests */
const activeJsonpCancelers = new Set<() => void>();

/** Short-lived provider cooldowns so a blocked endpoint (e.g. Safari ITP proxy or Apple 5G 403) fails over instantly */
let proxyCooldownUntil = 0;
let directItunesCooldownUntil = 0;

export function upgradeItunesArtwork(url?: string): string {
  if (!url) return '';
  return url.replace(/100x100bb/i, '400x400bb').replace(/60x60bb/i, '400x400bb');
}

export function normalizeTrackKey(trackName: string): string {
  return trackName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

export function isValidHttpsPreviewUrl(url: string | undefined | null): url is string {
  return typeof url === 'string' && url.trim().startsWith('https://');
}

export function isAbortAudioError(err: unknown): boolean {
  if (!err) return false;
  const name = err instanceof Error ? err.name : typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
  const message = err instanceof Error ? err.message : String(err);
  return (
    name === 'AbortError' ||
    /interrupted by a call to pause|interrupted by a new load|aborted/i.test(message)
  );
}

export function isAutoplayBlockedError(err: unknown): boolean {
  if (!err) return false;
  const name = err instanceof Error ? err.name : typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
  const message = err instanceof Error ? err.message : String(err);
  return name === 'NotAllowedError' || /notallowed|gesture|autoplay|interact/i.test(message);
}

export function dedupeItunesTracks(tracks: ItunesTrack[]): ItunesTrack[] {
  const seenTitles = new Set<string>();
  const seenPreview = new Set<string>();
  const out: ItunesTrack[] = [];

  for (const t of tracks) {
    if (!t.trackName || !t.artistName || !isValidHttpsPreviewUrl(t.previewUrl)) continue;
    const cleanUrl = t.previewUrl.trim();
    const titleKey = normalizeTrackKey(t.trackName);
    if (!titleKey || seenTitles.has(titleKey) || seenPreview.has(cleanUrl)) {
      continue;
    }
    seenTitles.add(titleKey);
    seenPreview.add(cleanUrl);
    out.push({ ...t, previewUrl: cleanUrl });
  }
  return out;
}

export function cancelPendingItunesJsonp(): void {
  for (const cancel of Array.from(activeJsonpCancelers)) {
    cancel();
  }
  activeJsonpCancelers.clear();
}

export function parseRawItunesResults(payload: RawItunesResponse | null | undefined): ItunesTrack[] {
  const rawList = Array.isArray(payload?.results) ? payload.results : [];
  const mapped: ItunesTrack[] = rawList
    .filter(
      (item): item is Required<Pick<RawItunesSong, 'trackName' | 'artistName' | 'previewUrl'>> & RawItunesSong =>
        Boolean(item?.trackName && item?.artistName && isValidHttpsPreviewUrl(item?.previewUrl)),
    )
    .map((item, idx) => {
      const baseArt = item.artworkUrl100 || item.artworkUrl60 || '';
      return {
        trackId: item.trackId ?? Date.now() + idx,
        trackName: item.trackName.trim(),
        artistName: item.artistName.trim(),
        collectionName: (item.collectionName ?? '').trim(),
        previewUrl: item.previewUrl.trim(),
        artworkUrl: baseArt,
        artworkUrlHiRes: upgradeItunesArtwork(baseArt),
        primaryGenreName: item.primaryGenreName,
      };
    });
  return dedupeItunesTracks(mapped);
}

export function parseRawDeezerResults(payload: RawDeezerResponse | null | undefined): ItunesTrack[] {
  const rawList = Array.isArray(payload?.data) ? payload.data : [];
  const mapped: ItunesTrack[] = rawList
    .filter(
      (item): item is RawDeezerTrack & { title: string; preview: string; artist: { name: string } } =>
        Boolean(
          typeof item?.title === 'string' &&
            item.title.trim().length > 0 &&
            typeof item?.artist?.name === 'string' &&
            item.artist.name.trim().length > 0 &&
            isValidHttpsPreviewUrl(item?.preview),
        ),
    )
    .map((item, idx) => {
      const art = (item.album?.cover_big || item.album?.cover_medium || '').trim();
      return {
        trackId: typeof item.id === 'number' ? item.id : Date.now() + 200000 + idx,
        trackName: item.title.trim(),
        artistName: item.artist.name.trim(),
        collectionName: (item.album?.title ?? '').trim(),
        previewUrl: item.preview.trim(),
        artworkUrl: art,
        artworkUrlHiRes: art,
      };
    });
  return dedupeItunesTracks(mapped);
}

async function fetchJsonWithAbort<T>(
  url: string,
  timeoutMs: number,
  options?: { credentials?: RequestCredentials },
): Promise<T | null> {
  if (typeof fetch !== 'function' || typeof window === 'undefined') {
    return null;
  }

  const controller = new AbortController();
  let abortedByCancel = false;
  const cancelSelf = () => {
    abortedByCancel = true;
    controller.abort();
  };
  activeJsonpCancelers.add(cancelSelf);

  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      credentials: options?.credentials,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      // HTML redirect/login page (e.g. iOS Safari ITP inside preview iframe)
      return null;
    }
    return JSON.parse(text) as T;
  } catch (err) {
    if (abortedByCancel) {
      throw new Error('ITUNES_ABORTED');
    }
    return null;
  } finally {
    window.clearTimeout(timer);
    activeJsonpCancelers.delete(cancelSelf);
  }
}

function runJsonpScript<T>(buildUrl: (cbName: string) => string, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    jsonpSeq += 1;
    const cbName = `coupleCamMusicCb_${Date.now()}_${jsonpSeq}_${Math.floor(Math.random() * 10000)}`;
    const win = window as unknown as Record<string, unknown>;
    let scriptEl: HTMLScriptElement | null = null;
    let settled = false;
    let timeoutId: number | null = null;

    const cleanup = () => {
      activeJsonpCancelers.delete(cancelSelf);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      try {
        delete win[cbName];
      } catch {
        win[cbName] = undefined;
      }
      if (scriptEl && scriptEl.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
      scriptEl = null;
    };

    const cancelSelf = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('ITUNES_ABORTED'));
    };

    activeJsonpCancelers.add(cancelSelf);

    timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('ITUNES_TIMEOUT'));
    }, timeoutMs);

    win[cbName] = (payload: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(payload);
    };

    scriptEl = document.createElement('script');
    scriptEl.async = true;
    scriptEl.src = buildUrl(cbName);
    scriptEl.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('ITUNES_NETWORK_ERROR'));
    };

    document.head.appendChild(scriptEl);
  });
}

/**
 * Primary same-origin Express proxy query (`/api/itunes/search`), which caches results
 * server-side and automatically falls back to Deezer if iTunes throttles or fails on 5G/iOS Safari.
 */
async function searchItunesViaProxy(
  cleanedTerm: string,
  limit: number,
  timeoutMs: number,
): Promise<ItunesTrack[]> {
  const url = `/api/itunes/search?term=${encodeURIComponent(cleanedTerm)}&limit=${limit}`;
  const payload = await fetchJsonWithAbort<RawItunesResponse>(url, Math.min(timeoutMs, 4200), {
    credentials: 'same-origin',
  });
  return parseRawItunesResults(payload);
}

/**
 * Direct CORS fetch to Apple iTunes Search API (iTunes sends Access-Control-Allow-Origin: *).
 * Runs from the player's own browser connection and avoids `<script>` JSONP quirks.
 */
async function searchItunesDirectFetch(
  cleanedTerm: string,
  limit: number,
  timeoutMs: number,
): Promise<ItunesTrack[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanedTerm)}&media=music&entity=song&limit=${limit}`;
  const payload = await fetchJsonWithAbort<RawItunesResponse>(url, Math.min(timeoutMs, 3800), {
    credentials: 'omit',
  });
  return parseRawItunesResults(payload);
}

/**
 * Direct client-side Deezer JSONP search (`output=jsonp&callback=...`).
 * Zero CORS issues and immune to Apple 5G CGNAT rate-limits and iOS Safari ITP iframe proxy blocks.
 */
async function searchDeezerJsonp(
  cleanedTerm: string,
  limit: number,
  timeoutMs: number,
): Promise<ItunesTrack[]> {
  const payload = await runJsonpScript<RawDeezerResponse>(
    (cbName) =>
      `https://api.deezer.com/search?q=${encodeURIComponent(cleanedTerm)}&limit=${limit}&output=jsonp&callback=${encodeURIComponent(cbName)}`,
    Math.min(timeoutMs, 4500),
  );
  return parseRawDeezerResults(payload);
}

/**
 * Last-resort live global chart safety net (server `/api/itunes/chart` or direct Deezer Chart JSONP).
 * Ensures players always get real 30-second HTTPS previews even if per-term searches are throttled.
 */
async function loadLiveChartSafetyTracks(timeoutMs = ITUNES_JSONP_TIMEOUT_MS): Promise<ItunesTrack[]> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return [];
  }

  // 1. Try server chart proxy if not in cooldown
  if (Date.now() >= proxyCooldownUntil) {
    try {
      const payload = await fetchJsonWithAbort<RawItunesResponse>('/api/itunes/chart', 3500, {
        credentials: 'same-origin',
      });
      const parsed = parseRawItunesResults(payload);
      if (parsed.length > 0) return parsed;
    } catch (err) {
      if (err instanceof Error && err.message === 'ITUNES_ABORTED') throw err;
    }
  }

  // 2. Direct client-side Deezer Global Chart JSONP
  try {
    const payload = await runJsonpScript<RawDeezerResponse>(
      (cbName) =>
        `https://api.deezer.com/chart/0/tracks?limit=50&output=jsonp&callback=${encodeURIComponent(cbName)}`,
      Math.min(timeoutMs, 5000),
    );
    return parseRawDeezerResults(payload);
  } catch (err) {
    if (err instanceof Error && err.message === 'ITUNES_ABORTED') throw err;
    return [];
  }
}

/**
 * Queries music tracks through a resilient 4-tier waterfall:
 * 1. Same-origin `/api/itunes/search` proxy (server cache + iTunes + Deezer fallback)
 * 2. Direct browser CORS `fetch()` to iTunes Search API
 * 3. Direct browser iTunes JSONP (`<script>`)
 * 4. Direct browser Deezer JSONP (`<script>`) — immune to Apple 5G CGNAT blocks & Safari ITP iframe blocks
 */
export async function searchItunesJsonp(
  term: string,
  limit = 25,
  timeoutMs = ITUNES_JSONP_TIMEOUT_MS,
): Promise<ItunesTrack[]> {
  const cleanedTerm = term.trim();
  if (!cleanedTerm) return [];

  const cacheKey = `${cleanedTerm.toLowerCase()}::${limit}`;
  const cached = termCache.get(cacheKey);
  if (cached && cached.length > 0) {
    return [...cached];
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return [];
  }

  const now = Date.now();

  // Tier 1: Same-origin Express proxy (iTunes + server-side Deezer fallback)
  if (now >= proxyCooldownUntil) {
    try {
      const proxyTracks = await searchItunesViaProxy(cleanedTerm, limit, timeoutMs);
      if (proxyTracks.length > 0) {
        termCache.set(cacheKey, proxyTracks);
        return [...proxyTracks];
      }
      proxyCooldownUntil = Date.now() + 25_000;
    } catch (err) {
      if (err instanceof Error && err.message === 'ITUNES_ABORTED') {
        throw err;
      }
      proxyCooldownUntil = Date.now() + 25_000;
    }
  }

  // Tier 2 & 3: Direct browser iTunes (CORS fetch first, then JSONP) if not rate-limited
  if (Date.now() >= directItunesCooldownUntil) {
    try {
      const directTracks = await searchItunesDirectFetch(cleanedTerm, limit, timeoutMs);
      if (directTracks.length > 0) {
        termCache.set(cacheKey, directTracks);
        return [...directTracks];
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'ITUNES_ABORTED') {
        throw err;
      }
    }

    try {
      const jsonpPayload = await runJsonpScript<RawItunesResponse>(
        (cbName) =>
          `https://itunes.apple.com/search?term=${encodeURIComponent(cleanedTerm)}&media=music&entity=song&limit=${limit}&callback=${encodeURIComponent(cbName)}`,
        Math.min(timeoutMs, 4000),
      );
      const deduped = parseRawItunesResults(jsonpPayload);
      if (deduped.length > 0) {
        termCache.set(cacheKey, deduped);
        return [...deduped];
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'ITUNES_ABORTED') {
        throw err;
      }
      // Apple rate-limited or blocked this network -> cool down briefly so Deezer answers immediately
      directItunesCooldownUntil = Date.now() + 45_000;
    }
  }

  // Tier 4: Direct client-side Deezer JSONP (30s HTTPS MP3 previews, works on iOS Safari 5G & iframes)
  try {
    const deezerTracks = await searchDeezerJsonp(cleanedTerm, limit, timeoutMs);
    if (deezerTracks.length > 0) {
      termCache.set(cacheKey, deezerTracks);
      return [...deezerTracks];
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'ITUNES_ABORTED') {
      throw err;
    }
  }

  return [];
}

function shuffleStrings(items: readonly string[]): string[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const UNIVERSAL_SAFETY_TERMS = ['The Weeknd', 'Dua Lipa', 'Stromae', 'Daft Punk'] as const;

/**
 * Loads a rich deduplicated pool of music tracks from a category's search terms,
 * using session cache when available and automatically retrying fallback terms & live charts if needed.
 */
export async function loadCategoryTracksJsonp(
  primaryTerms: readonly string[],
  fallbackTerms: readonly string[],
  minDesiredTracks = 16,
  categoryCacheKey?: string,
): Promise<ItunesTrack[]> {
  if (categoryCacheKey) {
    const cachedPool = categoryPoolCache.get(categoryCacheKey);
    if (cachedPool && cachedPool.length >= minDesiredTracks) {
      return [...cachedPool];
    }
  }

  const collected: ItunesTrack[] = [];
  const shuffledPrimary = shuffleStrings(primaryTerms).slice(0, 4);
  const shuffledFallback = shuffleStrings(fallbackTerms);

  // Batch 1: query 3 varied terms in parallel for diversity and speed
  const firstBatch = shuffledPrimary.slice(0, 3);
  const settledFirst = await Promise.allSettled(
    firstBatch.map((term) => searchItunesJsonp(term, 25, ITUNES_JSONP_TIMEOUT_MS)),
  );
  for (const res of settledFirst) {
    if (res.status === 'fulfilled') {
      collected.push(...res.value);
    }
  }

  let pool = dedupeItunesTracks(collected);
  if (pool.length >= minDesiredTracks) {
    if (categoryCacheKey) categoryPoolCache.set(categoryCacheKey, pool);
    return pool;
  }

  // Automatic retry on fallback search terms if first batch wasn't enough or timed out
  const retryQueue = [...shuffledPrimary.slice(3), ...shuffledFallback];
  for (const term of retryQueue) {
    if (pool.length >= minDesiredTracks) break;
    try {
      const more = await searchItunesJsonp(term, 25, ITUNES_JSONP_TIMEOUT_MS);
      collected.push(...more);
      pool = dedupeItunesTracks(collected);
    } catch (err) {
      if (err instanceof Error && err.message === 'ITUNES_ABORTED') {
        throw err;
      }
      // Continue trying next fallback term
    }
  }

  // Safety net 1: if a niche category still returned < 6 tracks, supplement with universally indexed hits
  if (pool.length < 6) {
    for (const term of UNIVERSAL_SAFETY_TERMS) {
      if (pool.length >= Math.min(minDesiredTracks, 12)) break;
      try {
        const more = await searchItunesJsonp(term, 25, ITUNES_JSONP_TIMEOUT_MS);
        collected.push(...more);
        pool = dedupeItunesTracks(collected);
      } catch (err) {
        if (err instanceof Error && err.message === 'ITUNES_ABORTED') {
          throw err;
        }
      }
    }
  }

  // Safety net 2: live global chart tracks so mobile players never hit an empty catalog error
  if (pool.length < 6) {
    try {
      const chartTracks = await loadLiveChartSafetyTracks(ITUNES_JSONP_TIMEOUT_MS);
      collected.push(...chartTracks);
      pool = dedupeItunesTracks(collected);
    } catch (err) {
      if (err instanceof Error && err.message === 'ITUNES_ABORTED') {
        throw err;
      }
    }
  }

  if (categoryCacheKey && pool.length > 0) {
    categoryPoolCache.set(categoryCacheKey, pool);
  }

  return pool;
}

export interface PlayTrackOptions {
  volume?: number;
  loop?: boolean;
  startAtSec?: number;
}

export interface PlayTrackResult {
  ok: boolean;
  blocked: boolean;
  aborted?: boolean;
  error?: string;
}

export type TrackFailReason = 'media-error' | 'stall-timeout' | 'play-error';

export interface SharedAudioElementLike {
  src: string;
  preload: string;
  volume: number;
  muted: boolean;
  loop: boolean;
  paused: boolean;
  currentTime: number;
  readyState: number;
  crossOrigin?: string | null;
  play: () => Promise<void> | undefined;
  pause: () => void;
  load: () => void;
  setAttribute?: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  onplay: (() => void) | null;
  onplaying: (() => void) | null;
  ontimeupdate: (() => void) | null;
  onpause: (() => void) | null;
  onended: (() => void) | null;
  onerror: (() => void) | null;
}

export interface SharedMusicAudioPlayerCallbacks {
  onPlayingChange?: (playing: boolean) => void;
  onAutoplayBlocked?: (blocked: boolean) => void;
  onTrackFailed?: (failedUrl: string, reason: TrackFailReason) => void;
  audioFactory?: () => SharedAudioElementLike;
  stallTimeoutMs?: number;
}

/**
 * Single persistent native HTML5 <audio> player controller.
 * - NEVER sets crossOrigin = 'anonymous' (avoids Apple CDN CORS rejections).
 * - NEVER attaches AudioContext.createMediaElementSource().
 * - Properly awaits/handles playPromiseRef before pause() or switching tracks, silently ignoring AbortError.
 * - Includes a 4-second anti-stall watchdog + onerror hook to auto-skip broken tracks seamlessly.
 */
export class SharedMusicAudioPlayer {
  private audio: SharedAudioElementLike | null = null;
  private playPromise: Promise<void> | null = null;
  private playSeq = 0;
  private activeUrl = '';
  private lastUrl = '';
  private lastOptions: PlayTrackOptions = {};
  private muted = false;
  private isUnlocked = false;
  private isPlayingState = false;
  private hasStartedCurrentTrack = false;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;

  private onPlayingChange?: (playing: boolean) => void;
  private onAutoplayBlocked?: (blocked: boolean) => void;
  private onTrackFailed?: (failedUrl: string, reason: TrackFailReason) => void;
  private audioFactory?: () => SharedAudioElementLike;
  private stallTimeoutMs: number;

  constructor(callbacks?: SharedMusicAudioPlayerCallbacks) {
    this.onPlayingChange = callbacks?.onPlayingChange;
    this.onAutoplayBlocked = callbacks?.onAutoplayBlocked;
    this.onTrackFailed = callbacks?.onTrackFailed;
    this.audioFactory = callbacks?.audioFactory;
    this.stallTimeoutMs = callbacks?.stallTimeoutMs ?? PLAYBACK_STALL_TIMEOUT_MS;
  }

  public setCallbacks(callbacks: {
    onPlayingChange?: (playing: boolean) => void;
    onAutoplayBlocked?: (blocked: boolean) => void;
    onTrackFailed?: (failedUrl: string, reason: TrackFailReason) => void;
  }): void {
    this.onPlayingChange = callbacks.onPlayingChange;
    this.onAutoplayBlocked = callbacks.onAutoplayBlocked;
    this.onTrackFailed = callbacks.onTrackFailed;
  }

  public getAudioElement(): SharedAudioElementLike | null {
    return this.audio;
  }

  private clearStallTimer(): void {
    if (this.stallTimer !== null) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }

  private markPlaybackStarted(): void {
    this.hasStartedCurrentTrack = true;
    this.clearStallTimer();
    this.isPlayingState = true;
    this.onPlayingChange?.(true);
    this.onAutoplayBlocked?.(false);
  }

  private ensureAudio(): SharedAudioElementLike | null {
    if (!this.audio) {
      let el: SharedAudioElementLike | null = null;
      if (this.audioFactory) {
        el = this.audioFactory();
      } else if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        el = new Audio() as unknown as SharedAudioElementLike;
      }
      if (!el) return null;

      // Strictly standard HTML5 audio — NEVER set crossOrigin, NEVER attach Web Audio source!
      el.preload = 'auto';
      el.volume = DEFAULT_AUDIO_VOLUME;
      el.muted = this.muted;
      el.setAttribute?.('playsinline', '');
      el.setAttribute?.('webkit-playsinline', '');

      el.onplay = () => {
        if (!this.activeUrl) return;
        this.isPlayingState = true;
        this.onPlayingChange?.(true);
        this.onAutoplayBlocked?.(false);
      };
      el.onplaying = () => {
        if (!this.activeUrl) return;
        this.markPlaybackStarted();
      };
      el.ontimeupdate = () => {
        if (!this.activeUrl || this.hasStartedCurrentTrack) return;
        if (el && el.currentTime > 0) {
          this.markPlaybackStarted();
        }
      };
      el.onpause = () => {
        this.isPlayingState = false;
        this.onPlayingChange?.(false);
      };
      el.onended = () => {
        if (el && !el.loop) {
          this.isPlayingState = false;
          this.onPlayingChange?.(false);
        }
      };
      el.onerror = () => {
        const failedUrl = this.activeUrl;
        // Ignore onerror emitted when src is intentionally cleared during cleanup
        if (!failedUrl) return;
        this.clearStallTimer();
        this.isPlayingState = false;
        this.onPlayingChange?.(false);
        this.activeUrl = '';
        this.onTrackFailed?.(failedUrl, 'media-error');
      };

      this.audio = el;
    }
    return this.audio;
  }

  /**
   * Synchronously unlocks both native <audio> and procedural Web Audio SFX
   * inside a direct user click ("Commencer", category selection, or Guest "Prêt").
   * Guarded by `playSeq` so it NEVER interrupts or clears a real track that starts immediately after.
   */
  public unlock(): void {
    soundFx.unlock();
    const el = this.ensureAudio();
    if (!el || this.isUnlocked || this.activeUrl || this.playPromise) return;

    const unlockSeq = this.playSeq;
    const silentWav =
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    el.muted = true;
    el.src = silentWav;
    try {
      const p = el.play();
      if (p && typeof p.then === 'function') {
        this.playPromise = p
          .then(() => {
            if (this.playPromise === p) {
              this.playPromise = null;
            }
            this.isUnlocked = true;
            // ONLY pause silent WAV if no real track has been started in the meantime!
            if (this.playSeq === unlockSeq && !this.activeUrl) {
              try {
                el.pause();
              } catch {
                // Ignore
              }
              el.muted = this.muted;
            }
          })
          .catch(() => {
            if (this.playPromise === p) {
              this.playPromise = null;
            }
            if (this.playSeq === unlockSeq && !this.activeUrl) {
              el.muted = this.muted;
            }
          });
      } else {
        this.isUnlocked = true;
        el.muted = this.muted;
      }
    } catch {
      el.muted = this.muted;
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.audio) {
      this.audio.muted = muted;
    }
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public async playTrack(previewUrl: string, options: PlayTrackOptions = {}): Promise<PlayTrackResult> {
    const el = this.ensureAudio();
    if (!el || !isValidHttpsPreviewUrl(previewUrl)) {
      return { ok: false, blocked: false, error: 'INVALID_AUDIO_URL' };
    }

    const cleanUrl = previewUrl.trim();
    const seq = ++this.playSeq;
    this.clearStallTimer();
    this.activeUrl = cleanUrl;
    this.lastUrl = cleanUrl;
    this.lastOptions = options;
    this.hasStartedCurrentTrack = false;

    // Wait for any in-flight play() promise to settle cleanly before switching src/pausing
    const pendingPlay = this.playPromise;
    if (pendingPlay) {
      try {
        await pendingPlay;
      } catch {
        // Silently absorb AbortError / previous play rejection
      }
    }

    // Abort silently if a newer playTrack / pause / stopAndCleanup superseded us while awaiting
    if (seq !== this.playSeq) {
      return { ok: false, blocked: false, aborted: true };
    }

    try {
      if (!el.paused) {
        el.pause();
      }
      el.preload = 'auto';
      el.muted = this.muted;
      el.loop = Boolean(options.loop);
      el.volume = Math.max(0, Math.min(1, options.volume ?? DEFAULT_AUDIO_VOLUME));

      if (el.src !== cleanUrl) {
        el.src = cleanUrl;
      }

      const targetStart = typeof options.startAtSec === 'number' && options.startAtSec > 0 ? options.startAtSec : 0;
      try {
        el.currentTime = targetStart;
      } catch {
        // Mobile browsers may defer seeking until metadata is available
      }

      // 4-second anti-stall watchdog: if playback never starts, auto-skip to next cached track
      this.stallTimer = setTimeout(() => {
        this.stallTimer = null;
        if (seq !== this.playSeq || this.activeUrl !== cleanUrl || this.hasStartedCurrentTrack) {
          return;
        }
        this.isPlayingState = false;
        this.onPlayingChange?.(false);
        this.activeUrl = '';
        this.onTrackFailed?.(cleanUrl, 'stall-timeout');
      }, this.stallTimeoutMs);

      const p = el.play();
      if (p && typeof p.then === 'function') {
        this.playPromise = p;
        await p;
        if (this.playPromise === p) {
          this.playPromise = null;
        }
      }

      if (seq !== this.playSeq) {
        // Pause cleanly if a pause/stop arrived right as play() resolved
        if (!this.activeUrl && !el.paused) {
          try {
            el.pause();
          } catch {
            // Ignore
          }
        }
        return { ok: false, blocked: false, aborted: true };
      }

      this.isUnlocked = true;
      this.markPlaybackStarted();
      return { ok: true, blocked: false };
    } catch (err) {
      if (seq !== this.playSeq || isAbortAudioError(err)) {
        // Silently ignore AbortError ("The play() request was interrupted by a call to pause()")
        return { ok: false, blocked: false, aborted: true };
      }

      this.clearStallTimer();
      this.isPlayingState = false;
      this.onPlayingChange?.(false);

      if (isAutoplayBlockedError(err)) {
        this.onAutoplayBlocked?.(true);
        return {
          ok: false,
          blocked: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      this.activeUrl = '';
      this.onTrackFailed?.(cleanUrl, 'play-error');
      return {
        ok: false,
        blocked: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Called by the prominent floating "🔊 Activer le son" fallback button if mobile autoplay blocked playback.
   */
  public async resumeAfterGesture(): Promise<boolean> {
    soundFx.unlock();
    const targetUrl = this.activeUrl || this.lastUrl;
    if (!targetUrl) return false;
    const res = await this.playTrack(targetUrl, this.lastOptions);
    return res.ok;
  }

  /**
   * Voluntary instant pause (e.g. Freeze Dance FREEZE_STOP cut!).
   * Safely coordinates with any pending play() promise so AbortError never leaks.
   */
  public pause(): void {
    const pauseSeq = ++this.playSeq;
    this.clearStallTimer();
    this.activeUrl = '';
    this.hasStartedCurrentTrack = false;
    this.isPlayingState = false;
    this.onPlayingChange?.(false);

    const el = this.audio;
    if (!el) return;

    const pending = this.playPromise;
    if (pending) {
      void pending
        .then(() => {
          if (this.playSeq === pauseSeq) {
            try {
              el.pause();
            } catch {
              // Ignore
            }
          }
        })
        .catch(() => {
          // Silently absorb AbortError
        });
      return;
    }

    try {
      el.pause();
    } catch {
      // Ignore
    }
  }

  /**
   * Full teardown ONLY on unmount / "← Changer de jeu" / match end.
   * Leaves PeerJS MediaStream tracks completely untouched.
   */
  public stopAndCleanup(): void {
    const stopSeq = ++this.playSeq;
    this.clearStallTimer();
    this.activeUrl = '';
    this.lastUrl = '';
    this.hasStartedCurrentTrack = false;
    this.isPlayingState = false;
    this.onPlayingChange?.(false);
    this.onAutoplayBlocked?.(false);

    const el = this.audio;
    if (!el) return;

    const finalizeReset = () => {
      if (this.playSeq !== stopSeq) return;
      try {
        el.pause();
        el.removeAttribute('src');
        el.load();
      } catch {
        // Ignore cleanup errors
      }
    };

    const pending = this.playPromise;
    if (pending) {
      void pending.then(finalizeReset).catch(finalizeReset);
      return;
    }

    finalizeReset();
  }
}
