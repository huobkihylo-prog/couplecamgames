import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { normalizeRelayRoomCode, RoomRelayRegistry } from './src/services/roomRelayLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));
  const server = http.createServer(app);

  // Shared room registry powering BOTH WebSocket (`/ws/room`) and HTTP/SSE (`/api/room/*`) relays.
  // Guarantees instant Host/Partner room entry and game sync across Symmetric NAT, 4G/5G,
  // mobile app-switches (WhatsApp code copy), and proxies that block WebSocket upgrades.
  const registry = new RoomRelayRegistry();
  const wss = new WebSocketServer({ noServer: true });
  let nextClientSeq = 1;

  interface SseClientEntry {
    id: string;
    res: Response;
    activeCode: string;
    send: (payload: Record<string, unknown>) => void;
  }

  const sseClients = new Map<string, SseClientEntry>();

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: registry.getRoomCount() });
  });

  // Server-side music search proxy (`/api/itunes/search`) with 15-minute TTL cache
  // and automatic Deezer public API fallback. Eliminates iOS Safari / 5G JSONP blocks & rate limits.
  interface CachedMusicPayload {
    expiresAt: number;
    source: 'itunes' | 'deezer';
    results: Array<{
      trackId: number;
      trackName: string;
      artistName: string;
      collectionName: string;
      previewUrl: string;
      artworkUrl100: string;
      primaryGenreName?: string;
    }>;
  }
  const MUSIC_CACHE_TTL_MS = 15 * 60 * 1000;
  const musicSearchCache = new Map<string, CachedMusicPayload>();

  const fetchWithTimeout = async (url: string, timeoutMs = 5500): Promise<globalThis.Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CoupleCam/1.0 (+https://aistudio.google.com)',
        },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  app.get('/api/itunes/search', async (req, res) => {
    const rawTerm = typeof req.query.term === 'string' ? req.query.term.trim() : '';
    if (!rawTerm || rawTerm.length > 120) {
      res.status(400).json({ resultCount: 0, results: [], error: 'invalid-term' });
      return;
    }

    const rawLimit = Number(req.query.limit ?? 25);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, Math.round(rawLimit))) : 25;
    const cacheKey = `${rawTerm.toLowerCase()}::${limit}`;
    const now = Date.now();
    const cached = musicSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > now && cached.results.length > 0) {
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.json({ resultCount: cached.results.length, results: cached.results, source: cached.source });
      return;
    }

    let normalized: CachedMusicPayload['results'] = [];
    let source: 'itunes' | 'deezer' = 'itunes';

    // 1. Primary upstream: Apple iTunes Search API
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(rawTerm)}&media=music&entity=song&limit=${limit}`;
      const upstream = await fetchWithTimeout(itunesUrl, 5500);
      if (upstream.ok) {
        const json = (await upstream.json()) as {
          results?: Array<{
            trackId?: number;
            trackName?: string;
            artistName?: string;
            collectionName?: string;
            previewUrl?: string;
            artworkUrl100?: string;
            artworkUrl60?: string;
            primaryGenreName?: string;
          }>;
        };
        const items = Array.isArray(json?.results) ? json.results : [];
        normalized = items
          .filter(
            (item) =>
              typeof item?.trackName === 'string' &&
              item.trackName.trim().length > 0 &&
              typeof item?.artistName === 'string' &&
              item.artistName.trim().length > 0 &&
              typeof item?.previewUrl === 'string' &&
              item.previewUrl.trim().startsWith('https://'),
          )
          .map((item, idx) => ({
            trackId: typeof item.trackId === 'number' ? item.trackId : Date.now() + idx,
            trackName: item.trackName!.trim(),
            artistName: item.artistName!.trim(),
            collectionName: (item.collectionName ?? '').trim(),
            previewUrl: item.previewUrl!.trim(),
            artworkUrl100: (item.artworkUrl100 || item.artworkUrl60 || '').trim(),
            primaryGenreName: item.primaryGenreName,
          }));
      }
    } catch {
      // Fall through to Deezer public search fallback
    }

    // 2. Automatic fallback: Deezer Public Search API (30s HTTPS previews) if iTunes throttled/empty
    if (normalized.length < 4) {
      try {
        const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(rawTerm)}&limit=${limit}`;
        const upstream = await fetchWithTimeout(deezerUrl, 5500);
        if (upstream.ok) {
          const json = (await upstream.json()) as {
            data?: Array<{
              id?: number;
              title?: string;
              preview?: string;
              artist?: { name?: string };
              album?: { title?: string; cover_medium?: string; cover_big?: string };
            }>;
          };
          const items = Array.isArray(json?.data) ? json.data : [];
          const deezerTracks = items
            .filter(
              (item) =>
                typeof item?.title === 'string' &&
                item.title.trim().length > 0 &&
                typeof item?.artist?.name === 'string' &&
                item.artist.name.trim().length > 0 &&
                typeof item?.preview === 'string' &&
                item.preview.trim().startsWith('https://'),
            )
            .map((item, idx) => ({
              trackId: typeof item.id === 'number' ? item.id : Date.now() + 100000 + idx,
              trackName: item.title!.trim(),
              artistName: item.artist!.name!.trim(),
              collectionName: (item.album?.title ?? '').trim(),
              previewUrl: item.preview!.trim(),
              artworkUrl100: (item.album?.cover_big || item.album?.cover_medium || '').trim(),
            }));

          if (deezerTracks.length > normalized.length) {
            normalized = deezerTracks;
            source = 'deezer';
          }
        }
      } catch {
        // Return whatever iTunes provided (or empty array)
      }
    }

    if (normalized.length > 0) {
      if (musicSearchCache.size >= 300) {
        const oldestKey = musicSearchCache.keys().next().value;
        if (oldestKey) musicSearchCache.delete(oldestKey);
      }
      musicSearchCache.set(cacheKey, {
        expiresAt: now + MUSIC_CACHE_TTL_MS,
        source,
        results: normalized,
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ resultCount: normalized.length, results: normalized, source });
  });

  // Fallback Transport 2: Server-Sent Events stream (`/api/room/stream`) for networks/proxies
  // where WebSocket upgrades fail or drop. Shares the exact same `RoomRelayRegistry` as `/ws/room`.
  app.get('/api/room/stream', (req, res) => {
    const rawId = typeof req.query.clientId === 'string' ? req.query.clientId.trim() : '';
    const clientId = rawId && rawId.length <= 64
      ? rawId
      : `sse-${nextClientSeq++}-${Math.random().toString(36).slice(2, 7)}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const safeSend = (payload: Record<string, unknown>) => {
      if (res.writableEnded) return;
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // Ignore closed stream writes
      }
    };

    const existing = sseClients.get(clientId);
    if (existing) {
      try {
        existing.res.end();
      } catch {
        // Ignore previous stream close
      }
    }

    const entry: SseClientEntry = {
      id: clientId,
      res,
      activeCode: existing?.activeCode ?? '',
      send: safeSend,
    };
    sseClients.set(clientId, entry);

    safeSend({ type: 'RELAY_SSE_CONNECTED', clientId });

    const pingTimer = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(pingTimer);
        return;
      }
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingTimer);
      }
    }, 15_000);

    req.on('close', () => {
      clearInterval(pingTimer);
      const current = sseClients.get(clientId);
      if (current && current.res === res) {
        sseClients.delete(clientId);
        if (current.activeCode) {
          registry.detachClient(current.activeCode, clientId);
        }
      }
    });
  });

  // Companion HTTP POST endpoint for SSE clients to send HOST_OPEN / GUEST_JOIN / RELAY_DATA / LEAVE_ROOM
  app.post('/api/room/action', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
    const type = typeof body.type === 'string' ? body.type : '';
    const entry = sseClients.get(clientId);

    if (!clientId || !entry) {
      res.status(409).json({ ok: false, reason: 'sse-not-connected' });
      return;
    }

    if (type === 'HOST_OPEN') {
      const cleanCode = normalizeRelayRoomCode(String(body.code ?? ''));
      const name = String(body.name ?? 'Hôte').trim() || 'Hôte';
      if (entry.activeCode && entry.activeCode !== cleanCode) {
        registry.removeClient(entry.activeCode, clientId);
      }
      const result = registry.registerHost(cleanCode, {
        id: clientId,
        role: 'host',
        name,
        send: entry.send,
      });
      if (result.ok) {
        entry.activeCode = result.code;
        res.json({ ok: true, code: result.code, resumed: result.resumed });
      } else {
        entry.send({ type: 'RELAY_ERROR', reason: result.reason, code: cleanCode });
        res.status(409).json({ ok: false, reason: result.reason });
      }
      return;
    }

    if (type === 'GUEST_JOIN') {
      const cleanCode = normalizeRelayRoomCode(String(body.code ?? ''));
      const name = String(body.name ?? 'Partenaire').trim() || 'Partenaire';
      const hasStream = Boolean(body.hasStream);
      if (entry.activeCode && entry.activeCode !== cleanCode) {
        registry.removeClient(entry.activeCode, clientId);
      }
      const result = registry.joinGuest(
        cleanCode,
        {
          id: clientId,
          role: 'guest',
          name,
          hasStream,
          send: entry.send,
        },
        hasStream,
      );
      if (result.ok) {
        entry.activeCode = result.code;
        res.json({ ok: true, code: result.code });
      } else {
        res.status(404).json({ ok: false, reason: result.reason });
      }
      return;
    }

    if (type === 'RELAY_DATA') {
      const targetCode = normalizeRelayRoomCode(String(body.code ?? entry.activeCode));
      const data = body.data;
      if (targetCode && data && typeof data === 'object') {
        const delivered = registry.forwardMessage(targetCode, clientId, data as Record<string, unknown>);
        res.json({ ok: delivered });
        return;
      }
      res.status(400).json({ ok: false, reason: 'invalid-payload' });
      return;
    }

    if (type === 'LEAVE_ROOM') {
      const targetCode = normalizeRelayRoomCode(String(body.code ?? entry.activeCode));
      if (targetCode) {
        registry.removeClient(targetCode, clientId);
      }
      entry.activeCode = '';
      res.json({ ok: true });
      return;
    }

    res.status(400).json({ ok: false, reason: 'unknown-type' });
  });

  interface TrackedSocket extends WebSocket {
    isAlive?: boolean;
  }

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/ws/room' || reqUrl.pathname === '/ws/room/') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  const keepaliveInterval = setInterval(() => {
    for (const client of wss.clients) {
      const sock = client as TrackedSocket;
      if (sock.isAlive === false) {
        sock.terminate();
        continue;
      }
      sock.isAlive = false;
      try {
        sock.ping();
      } catch {
        // Ignore ping errors on closing sockets
      }
    }
    registry.pruneExpired(Date.now());
  }, 10_000);

  wss.on('close', () => {
    clearInterval(keepaliveInterval);
  });

  wss.on('connection', (rawWs) => {
    const ws = rawWs as TrackedSocket;
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const clientId = `c-${nextClientSeq++}-${Math.random().toString(36).slice(2, 7)}`;
    let activeCode = '';

    const safeSend = (payload: Record<string, unknown>) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(payload));
        } catch {
          // Ignore send errors on closing sockets
        }
      }
    };

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = typeof msg.type === 'string' ? msg.type : '';

      if (type === 'HOST_OPEN') {
        const cleanCode = normalizeRelayRoomCode(String(msg.code ?? ''));
        const name = String(msg.name ?? 'Hôte').trim() || 'Hôte';
        if (activeCode && activeCode !== cleanCode) {
          registry.removeClient(activeCode, clientId);
        }
        const res = registry.registerHost(cleanCode, {
          id: clientId,
          role: 'host',
          name,
          send: safeSend,
        });
        if (res.ok) {
          activeCode = res.code;
        } else {
          safeSend({ type: 'RELAY_ERROR', reason: res.reason, code: cleanCode });
        }
        return;
      }

      if (type === 'GUEST_JOIN') {
        const cleanCode = normalizeRelayRoomCode(String(msg.code ?? ''));
        const name = String(msg.name ?? 'Partenaire').trim() || 'Partenaire';
        const hasStream = Boolean(msg.hasStream);
        if (activeCode && activeCode !== cleanCode) {
          registry.removeClient(activeCode, clientId);
        }
        const res = registry.joinGuest(
          cleanCode,
          {
            id: clientId,
            role: 'guest',
            name,
            hasStream,
            send: safeSend,
          },
          hasStream,
        );
        if (res.ok) {
          activeCode = res.code;
        }
        return;
      }

      if (type === 'RELAY_DATA') {
        const targetCode = normalizeRelayRoomCode(String(msg.code ?? activeCode));
        const data = msg.data;
        if (targetCode && data && typeof data === 'object') {
          registry.forwardMessage(targetCode, clientId, data as Record<string, unknown>);
        }
        return;
      }

      if (type === 'LEAVE_ROOM' && activeCode) {
        registry.removeClient(activeCode, clientId);
        activeCode = '';
      }
    });

    ws.on('close', () => {
      if (activeCode) {
        // Use grace-period detach on transport drop so mobile app-switching never destroys the room
        registry.detachClient(activeCode, clientId);
        activeCode = '';
      }
    });

    ws.on('error', () => {
      if (activeCode) {
        registry.detachClient(activeCode, clientId);
        activeCode = '';
      }
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
        ws: {
          server,
          path: '/__vite_ws',
        },
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CoupleCam Server] Listening on http://0.0.0.0:${PORT} (${IS_PROD ? 'prod' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('[CoupleCam Server] Failed to start:', err);
  process.exit(1);
});
