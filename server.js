import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Serve static build files from Vite
app.use(express.static(path.join(__dirname, 'dist')));

// Express 5 catch-all route for Single Page App
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// WebSocket Server & Active Lobbies Store
const wss = new WebSocketServer({ server });
const lobbies = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function sendJson(ws, data) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

wss.on('connection', (ws) => {
  let currentCode = null;
  let isHost = false;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      // 1. HOST LOBBY
      if (data.type === 'host') {
        let code = generateCode();
        while (lobbies.has(code)) {
          code = generateCode();
        }

        const lobby = {
          code,
          hostTeam: data.teamId || 'kc',
          guestTeam: 'sf',
          mode: 'arcade',
          hostReady: true,
          guestReady: false,
          started: false,
          hasGuest: false,
        };

        currentCode = code;
        isHost = true;

        lobbies.set(code, {
          lobby,
          hostWs: ws,
          guestWs: null,
        });

        sendJson(ws, { type: 'lobby_created', lobby });
      }

      // 2. JOIN LOBBY
      else if (data.type === 'join') {
        const code = (data.code || '').trim().toUpperCase();
        const entry = lobbies.get(code);

        if (!entry) {
          sendJson(ws, { type: 'error', message: 'Lobby code not found' });
          return;
        }

        if (entry.lobby.hasGuest) {
          sendJson(ws, { type: 'error', message: 'Lobby is full' });
          return;
        }

        entry.guestWs = ws;
        entry.lobby.hasGuest = true;
        entry.lobby.guestTeam = data.teamId || 'sf';

        currentCode = code;
        isHost = false;

        sendJson(ws, { type: 'lobby_sync', lobby: entry.lobby });
        sendJson(entry.hostWs, { type: 'lobby_sync', lobby: entry.lobby });
      }

      // 3. LOBBY UPDATES (TEAM/MODE SELECTION)
      else if (data.type === 'lobby_update') {
        if (!currentCode) return;
        const entry = lobbies.get(currentCode);
        if (entry) {
          Object.assign(entry.lobby, data.updates);
          sendJson(entry.hostWs, { type: 'lobby_sync', lobby: entry.lobby });
          sendJson(entry.guestWs, { type: 'lobby_sync', lobby: entry.lobby });
        }
      }

      // 4. START GAME
      else if (data.type === 'start_game') {
        if (!currentCode) return;
        const entry = lobbies.get(currentCode);
        if (entry && isHost) {
          entry.lobby.started = true;
          sendJson(entry.hostWs, { type: 'game_start', lobby: entry.lobby });
          sendJson(entry.guestWs, { type: 'game_start', lobby: entry.lobby });
        }
      }

      // 5. LIVE GAMEPLAY STATE BROADCAST
      else if (data.type === 'game_state') {
        if (!currentCode) return;
        const entry = lobbies.get(currentCode);
        if (entry) {
          const targetWs = isHost ? entry.guestWs : entry.hostWs;
          sendJson(targetWs, data);
        }
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  // CLEANUP ON DISCONNECT
  ws.on('close', () => {
    if (currentCode) {
      const entry = lobbies.get(currentCode);
      if (entry) {
        const otherWs = isHost ? entry.guestWs : entry.hostWs;
        if (otherWs) {
          sendJson(otherWs, { type: 'opponent_left' });
        }
        lobbies.delete(currentCode);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
