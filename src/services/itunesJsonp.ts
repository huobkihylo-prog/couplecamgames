/**
 * Zero-CORS iTunes Search API client using pure JSONP (<script> tag injection).
 * Works reliably on Desktop & Mobile browsers without CORS errors.
 */

export interface ItunesTrackResult {
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
let jsonpCounter = 0;

/**
 * Upgrade standard 100x100 iTunes artwork URLs to crisp 400x400 cover art.
 */
export function upgradeItunesArtworkUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/100x100bb/i, '400x400bb').replace(/60x60bb/i, '400x400bb');
}

/**
 * Query iTunes Search API via dynamic JSONP <script> injection.
 * Always cleans up callback & <script> node on completion, error, or 8s timeout.
 */
export function searchItunesSongsJsonp(
  term: string,
  limit = 10,
  timeoutMs = ITUNES_JSONP_TIMEOUT_MS,
): Promise<ItunesTrackResult[]> {
  const cleanedTerm = term.trim();
  if (!cleanedTerm) {
    return Promise.resolve([]);
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve([]);
  }

  return new Promise<ItunesTrackResult[]>((resolve, reject) => {
    jsonpCounter += 1;
    const cbName = `itunesCb_${Date.now()}_${jsonpCounter}_${Math.floor(Math.random() * 10000)}`;
    const win = window as unknown as Record<string, unknown>;
    let scriptEl: HTMLScriptElement | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
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

    const timeoutId = window.setTimeout(() => {
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
      const tracks: ItunesTrackResult[] = rawList
        .filter((item): item is Required<Pick<RawItunesSong, 'trackName' | 'artistName' | 'previewUrl'>> & RawItunesSong =>
          Boolean(item?.trackName && item?.artistName && item?.previewUrl),
        )
        .map((item, idx) => {
          const baseArt = item.artworkUrl100 || item.artworkUrl60 || '';
          return {
            trackId: item.trackId ?? Date.now() + idx,
            trackName: item.trackName,
            artistName: item.artistName,
            collectionName: item.collectionName ?? '',
            previewUrl: item.previewUrl,
            artworkUrl: baseArt,
            artworkUrlHiRes: upgradeItunesArtworkUrl(baseArt),
            primaryGenreName: item.primaryGenreName,
          };
        });
      resolve(tracks);
    };

    const params = new URLSearchParams({
      term: cleanedTerm,
      media: 'music',
      entity: 'song',
      limit: String(limit),
      callback: cbName,
    });

    scriptEl = document.createElement('script');
    scriptEl.async = true;
    scriptEl.src = `https://itunes.apple.com/search?${params.toString()}`;
    scriptEl.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('ITUNES_NETWORK_ERROR'));
    };

    document.head.appendChild(scriptEl);
  });
}
