/**
 * Shared Cross-Browser iTunes JSONP & Native HTML5 Audio Engine
 * Used by: "Quiz Éclair 4 Choix" and "1, 2, 3… Statue Musicale (Freeze Dance)".
 *
 * Strict cross-browser guarantees (iOS Safari, Android Chrome/Samsung/Firefox, Desktop):
 * - Zero CORS errors: queries iTunes Search API exclusively via JSONP (<script> tag injection)
 *   with unique callbacks, strict cleanup, 8s timeout, and automatic fallback-term retry.
 * - Zero silent audio: plays external `.m4a` previewUrl strictly via native `<audio>`
 *   (NEVER connected to AudioContext.createMediaElementSource()).
 * - Mobile audio unlock on first user click + autoplay-blocked callback for "🔊 Activer le son".
 * - Strict cleanup on unmount / game exit without ever touching PeerJS MediaStream tracks.
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

const ITUNES_JSONP_TIMEOUT_MS = 8000;
let jsonpSeq = 0;

/** Track cache per normalized term during the session for fast replays */
const termCache = new Map<string, ItunesTrack[]>();

/** Active cleanup callbacks so leaving a game immediately cancels pending JSONP requests */
const activeJsonpCancelers = new Set<() => void>();

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

export function dedupeItunesTracks(tracks: ItunesTrack[]): ItunesTrack[] {
  const seenTitles = new Set<string>();
  const seenPreview = new Set<string>();
  const out: ItunesTrack[] = [];

  for (const t of tracks) {
    if (!t.previewUrl || !t.trackName || !t.artistName) continue;
    if (!/^https?:\/\//i.test(t.previewUrl)) continue;
    const titleKey = normalizeTrackKey(t.trackName);
    if (!titleKey || seenTitles.has(titleKey) || seenPreview.has(t.previewUrl)) {
      continue;
    }
    seenTitles.add(titleKey);
    seenPreview.add(t.previewUrl);
    out.push(t);
  }
  return out;
}

export function cancelPendingItunesJsonp(): void {
  for (const cancel of Array.from(activeJsonpCancelers)) {
    cancel();
  }
  activeJsonpCancelers.clear();
}

/**
 * Pure JSONP query to iTunes Search API (limit=25 default).
 */
export function searchItunesJsonp(
  term: string,
  limit = 25,
  timeoutMs = ITUNES_JSONP_TIMEOUT_MS,
): Promise<ItunesTrack[]> {
  const cleanedTerm = term.trim();
  if (!cleanedTerm) return Promise.resolve([]);

  const cacheKey = `${cleanedTerm.toLowerCase()}::${limit}`;
  const cached = termCache.get(cacheKey);
  if (cached && cached.length > 0) {
    return Promise.resolve([...cached]);
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve([]);
  }

  return new Promise<ItunesTrack[]>((resolve, reject) => {
    jsonpSeq += 1;
    const cbName = `coupleCamItunesCb_${Date.now()}_${jsonpSeq}_${Math.floor(Math.random() * 10000)}`;
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

    win[cbName] = (payload: RawItunesResponse) => {
      if (settled) return;
      settled = true;
      cleanup();
      const rawList = Array.isArray(payload?.results) ? payload.results : [];
      const mapped: ItunesTrack[] = rawList
        .filter(
          (item): item is Required<Pick<RawItunesSong, 'trackName' | 'artistName' | 'previewUrl'>> & RawItunesSong =>
            Boolean(item?.trackName && item?.artistName && item?.previewUrl),
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
      const deduped = dedupeItunesTracks(mapped);
      if (deduped.length > 0) {
        termCache.set(cacheKey, deduped);
      }
      resolve(deduped);
    };

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanedTerm)}&media=music&entity=song&limit=${limit}&callback=${encodeURIComponent(cbName)}`;

    scriptEl = document.createElement('script');
    scriptEl.async = true;
    scriptEl.src = url;
    scriptEl.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('ITUNES_NETWORK_ERROR'));
    };

    document.head.appendChild(scriptEl);
  });
}

function shuffleStrings(items: readonly string[]): string[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Loads a rich deduplicated pool of iTunes tracks from a category's search terms,
 * automatically retrying fallback search terms if any query times out or yields too few songs.
 */
export async function loadCategoryTracksJsonp(
  primaryTerms: readonly string[],
  fallbackTerms: readonly string[],
  minDesiredTracks = 16,
): Promise<ItunesTrack[]> {
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
  error?: string;
}

/**
 * Dedicated native HTML5 <audio> player controller.
 * NEVER attaches createMediaElementSource() so cross-origin iTunes `.m4a` tracks
 * always play loudly and cleanly on iOS Safari, Android Chrome, Samsung Internet, Firefox & PC.
 */
export class SharedMusicAudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private lastUrl = '';
  private lastOptions: PlayTrackOptions = {};
  private isPlayingState = false;
  private onPlayingChange?: (playing: boolean) => void;
  private onAutoplayBlocked?: (blocked: boolean) => void;

  constructor(callbacks?: {
    onPlayingChange?: (playing: boolean) => void;
    onAutoplayBlocked?: (blocked: boolean) => void;
  }) {
    this.onPlayingChange = callbacks?.onPlayingChange;
    this.onAutoplayBlocked = callbacks?.onAutoplayBlocked;
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!this.audio) {
      const el = new Audio();
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.onplay = () => {
        this.isPlayingState = true;
        this.onPlayingChange?.(true);
        this.onAutoplayBlocked?.(false);
      };
      el.onpause = () => {
        this.isPlayingState = false;
        this.onPlayingChange?.(false);
      };
      el.onended = () => {
        if (!el.loop) {
          this.isPlayingState = false;
          this.onPlayingChange?.(false);
        }
      };
      el.onerror = () => {
        this.isPlayingState = false;
        this.onPlayingChange?.(false);
      };
      this.audio = el;
    }
    return this.audio;
  }

  /**
   * Synchronously unlocks both native <audio> and procedural Web Audio SFX
   * inside a direct user gesture (click/tap on "Commencer" or "Prêt").
   */
  public unlock(): void {
    soundFx.unlock();
    const el = this.ensureAudio();
    if (!el) return;
    // Play a tiny silent WAV data URI to satisfy iOS Safari & Android Chrome gesture unlock
    if (!el.src) {
      const silentWav =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      el.muted = true;
      el.src = silentWav;
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          el.pause();
          el.muted = false;
          el.removeAttribute('src');
          el.load();
        }).catch(() => {
          el.muted = false;
        });
      } else {
        el.muted = false;
      }
    }
  }

  public setMuted(muted: boolean): void {
    if (this.audio) {
      this.audio.muted = muted;
    }
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public async playTrack(previewUrl: string, options: PlayTrackOptions = {}): Promise<PlayTrackResult> {
    const el = this.ensureAudio();
    if (!el || !previewUrl) {
      return { ok: false, blocked: false, error: 'NO_AUDIO_URL' };
    }

    this.lastUrl = previewUrl;
    this.lastOptions = options;

    try {
      el.pause();
      el.loop = Boolean(options.loop);
      el.volume = Math.max(0, Math.min(1, options.volume ?? 0.9));
      if (el.src !== previewUrl) {
        el.src = previewUrl;
        el.load();
      }
      if (typeof options.startAtSec === 'number' && options.startAtSec > 0) {
        try {
          el.currentTime = options.startAtSec;
        } catch {
          // Some mobile browsers defer seeking until loadedmetadata
        }
      } else {
        try {
          el.currentTime = 0;
        } catch {
          // Ignore seek errors prior to metadata load
        }
      }

      await el.play();
      this.onAutoplayBlocked?.(false);
      return { ok: true, blocked: false };
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const message = err instanceof Error ? err.message : String(err);
      const isBlocked =
        name === 'NotAllowedError' ||
        /notallowed|gesture|autoplay|interact/i.test(message);
      if (isBlocked) {
        this.onAutoplayBlocked?.(true);
      }
      this.isPlayingState = false;
      this.onPlayingChange?.(false);
      return { ok: false, blocked: isBlocked, error: message };
    }
  }

  /**
   * Called by the visible "🔊 Activer le son" fallback button if mobile autoplay blocked playback.
   */
  public async resumeAfterGesture(): Promise<boolean> {
    soundFx.unlock();
    if (!this.lastUrl) return false;
    const res = await this.playTrack(this.lastUrl, this.lastOptions);
    return res.ok;
  }

  /**
   * Instant pause (e.g. Freeze Dance cut!).
   */
  public pause(): void {
    if (!this.audio) return;
    try {
      this.audio.pause();
    } catch {
      // Ignore
    }
    this.isPlayingState = false;
    this.onPlayingChange?.(false);
  }

  /**
   * Full teardown on unmount or "← Changer de jeu".
   * Leaves PeerJS MediaStream tracks completely untouched.
   */
  public stopAndCleanup(): void {
    this.lastUrl = '';
    this.isPlayingState = false;
    this.onPlayingChange?.(false);
    this.onAutoplayBlocked?.(false);
    if (!this.audio) return;
    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    } catch {
      // Ignore cleanup errors
    }
  }
}
