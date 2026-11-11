// Pixel Pigskin Online Server
// Run with: node server.js
// Requires: npm install ws

import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;

// Serve the static files from the Vite build
app.use(express.static(join(__dirname, 'dist')));

// Catch-all to serve index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Start HTTP server
const server = app.listen(port, () => {
  console.log(`[Server] Web + WebSocket server running on port ${port}`);
});

// Attach WebSocket Server to the same HTTP server
const wss = new WebSocketServer({ server });

const lobbies = new Map();

function genCode() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I,L,O to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) code += c[Math.floor(Math.random() * c.length)];
  return lobbies.has(code) ? genCode() : code;
}

function broadcast(lobby, data) {
  const msg = JSON.stringify(data);
  [lobby.host, lobby.guest].forEach(c => {
    if (c && c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

wss.on('connection', (ws) => {
  let myLobby = null;
  let myRole = null;

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }

    if (data.type === 'host') {
      const code = genCode();
      const lobby = {
        code,
        host: ws, guest: null,
        hostTeam: data.teamId || 'kc',
        guestTeam: 'sf',
        mode: 'arcade',
        hostReady: false, guestReady: false,
        started: false,
      };
      lobbies.set(code, lobby);
      myLobby = code;
      myRole = 'host';
      ws.send(JSON.stringify({ type: 'lobby_created', code, lobby: lobbyState(lobby) }));
      console.log(`[Host] ${code}`);
    }

    else if (data.type === 'join') {
      const code = (data.code || '').toUpperCase();
      const lobby = lobbies.get(code);
      if (!lobby) { ws.send(JSON.stringify({ type: 'error', message: 'Lobby not found' })); return; }
      if (lobby.guest) { ws.send(JSON.stringify({ type: 'error', message: 'Lobby full' })); return; }
      lobby.guest = ws;
      lobby.guestTeam = data.teamId || 'sf';
      myLobby = code;
      myRole = 'guest';
      broadcast(lobby, { type: 'lobby_sync', lobby: lobbyState(lobby) });
      console.log(`[Join] ${code}`);
    }

    else if (data.type === 'lobby_update') {
      if (!myLobby) return;
      const lobby = lobbies.get(myLobby);
      if (!lobby) return;
      const u = data.updates || {};
      if (myRole === 'host') {
        if (u.hostTeam) lobby.hostTeam = u.hostTeam;
        if (u.mode) lobby.mode = u.mode;
        if (u.hostReady !== undefined) lobby.hostReady = u.hostReady;
      } else {
        if (u.guestTeam) lobby.guestTeam = u.guestTeam;
        if (u.guestReady !== undefined) lobby.guestReady = u.guestReady;
      }
      broadcast(lobby, { type: 'lobby_sync', lobby: lobbyState(lobby) });
    }

    else if (data.type === 'start_game') {
      if (!myLobby || myRole !== 'host') return;
      const lobby = lobbies.get(myLobby);
      if (!lobby || !lobby.guest) return;
      lobby.started = true;
      broadcast(lobby, { type: 'game_start', lobby: lobbyState(lobby) });
      console.log(`[Start] ${myLobby} mode=${lobby.mode}`);
    }

    else if (data.type === 'game_state') {
      if (!myLobby) return;
      const lobby = lobbies.get(myLobby);
      if (!lobby) return;
      const target = myRole === 'host' ? lobby.guest : lobby.host;
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify(data));
      }
    }
  });

  ws.on('close', () => {
    if (!myLobby) return;
    const lobby = lobbies.get(myLobby);
    if (!lobby) return;
    const target = myRole === 'host' ? lobby.guest : lobby.host;
    if (target && target.readyState === WebSocket.OPEN) {
      target.send(JSON.stringify({ type: 'opponent_left' }));
    }
    lobbies.delete(myLobby);
    console.log(`[Left] ${myLobby}`);
  });
});

function lobbyState(l) {
  return {
    code: l.code,
    hostTeam: l.hostTeam,
    guestTeam: l.guestTeam,
    mode: l.mode,
    hasGuest: !!l.guest,
    started: l.started,
  };
}
