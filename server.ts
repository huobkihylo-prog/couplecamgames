import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { normalizeRelayRoomCode, RoomRelayRegistry } from './src/services/roomRelayLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: registry.getRoomCount() });
  });

  // Lightweight WebSocket room relay (`/ws/room`) that guarantees instant Host/Partner
  // room entry and game sync even across Symmetric NAT / 4G / strict firewalls.
  const registry = new RoomRelayRegistry();
  const wss = new WebSocketServer({ noServer: true });
  let nextClientSeq = 1;

  interface TrackedSocket extends WebSocket {
    isAlive?: boolean;
  }

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/ws/room') {
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
  }, 20000);

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
        registry.removeClient(activeCode, clientId);
        activeCode = '';
      }
    });

    ws.on('error', () => {
      if (activeCode) {
        registry.removeClient(activeCode, clientId);
        activeCode = '';
      }
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
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
