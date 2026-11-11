import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Serve static build files from Vite.
app.use(express.static(path.join(__dirname, 'dist')));

// Express 5 catch-all route for the single-page app.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const wss = new WebSocketServer({ server });
const lobbies = new Map();

const VALID_MODES = new Set(['arcade', 'seven7', 'one1']);
const ROOM_TTL_MS = 10 * 60 * 1000;

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

function generateToken() {
  return randomBytes(24).toString('hex');
}

function isOpen(ws) {
  return Boolean(ws && ws.readyState === 1);
}

function sendJson(ws, data) {
  if (!isOpen(ws)) return false;

  try {
    ws.send(JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Could not send WebSocket message:', err);
    return false;
  }
}

function sendError(ws, message) {
  sendJson(ws, { type: 'error', message });
}

function cleanTeamId(value, fallback) {
  if (typeof value !== 'string') return fallback;

  const id = value.trim().toLowerCase();
  return /^[a-z0-9_-]{1,16}$/.test(id) ? id : fallback;
}

function cleanMode(value, fallback = 'arcade') {
  return typeof value === 'string' && VALID_MODES.has(value)
    ? value
    : fallback;
}

function makePublicLobby(entry) {
  return {
    ...entry.lobby,
    hostConnected: isOpen(entry.hostWs),
    guestConnected: isOpen(entry.guestWs),
  };
}

function broadcastLobby(entry) {
  const message = {
    type: 'lobby_sync',
    lobby: makePublicLobby(entry),
  };

  sendJson(entry.hostWs, message);
  sendJson(entry.guestWs, message);
}

function clearExpiry(entry) {
  if (entry.expireTimer) {
    clearTimeout(entry.expireTimer);
    entry.expireTimer = null;
  }
}

function scheduleExpiry(entry) {
  clearExpiry(entry);

  entry.expireTimer = setTimeout(() => {
    if (lobbies.get(entry.lobby.code) !== entry) return;

    // Keep a room if a player is still connected and choosing to wait.
    if (!isOpen(entry.hostWs) && !isOpen(entry.guestWs)) {
      lobbies.delete(entry.lobby.code);
    }

    entry.expireTimer = null;
  }, ROOM_TTL_MS);
}

function messageSizeIsSafe(value, limit) {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' && serialized.length <= limit;
  } catch {
    return false;
  }
}

wss.on('connection', (ws) => {
  let currentCode = null;
  let role = null;

  function attachToLobby(entry, nextRole) {
    currentCode = entry.lobby.code;
    role = nextRole;

    if (nextRole === 'host') {
      entry.hostWs = ws;
    } else {
      entry.guestWs = ws;
    }

    clearExpiry(entry);
  }

  ws.on('message', (message) => {
    let data;

    try {
      data = JSON.parse(message.toString());
    } catch {
      sendError(ws, 'Invalid message format');
      return;
    }

    if (!data || typeof data.type !== 'string') {
      sendError(ws, 'Invalid message');
      return;
    }

    // Create a room.
    if (data.type === 'host') {
      if (currentCode) {
        sendError(ws, 'This connection is already in a lobby');
        return;
      }

      let code = generateCode();
      while (lobbies.has(code)) {
        code = generateCode();
      }

      const entry = {
        lobby: {
          code,
          hostTeam: cleanTeamId(data.teamId, 'kc'),
          guestTeam: 'sf',
          mode: cleanMode(data.mode),
          hostReady: true,
          guestReady: false,
          started: false,
          hasGuest: false,
        },
        hostWs: ws,
        guestWs: null,
        hostToken: generateToken(),
        guestToken: null,
        latestState: null,
        finished: false,
        expireTimer: null,
      };

      lobbies.set(code, entry);
      currentCode = code;
      role = 'host';

      sendJson(ws, {
        type: 'lobby_created',
        lobby: makePublicLobby(entry),
        role: 'host',
        sessionToken: entry.hostToken,
      });

      return;
    }

    // Join a room for the first time.
    if (data.type === 'join') {
      if (currentCode) {
        sendError(ws, 'This connection is already in a lobby');
        return;
      }

      const code = typeof data.code === 'string'
        ? data.code.trim().toUpperCase()
        : '';

      const entry = lobbies.get(code);

      if (!entry) {
        sendError(ws, 'Lobby code not found');
        return;
      }

      if (entry.lobby.started) {
        sendError(ws, 'That game has already started. Rejoin using your original connection.');
        return;
      }

      if (entry.lobby.hasGuest || isOpen(entry.guestWs)) {
        sendError(ws, 'Lobby is full');
        return;
      }

      entry.guestWs = ws;
      entry.guestToken = generateToken();
      entry.lobby.hasGuest = true;
      entry.lobby.guestReady = true;
      entry.lobby.guestTeam = cleanTeamId(data.teamId, 'sf');

      currentCode = code;
      role = 'guest';

      sendJson(ws, {
        type: 'lobby_sync',
        lobby: makePublicLobby(entry),
        role: 'guest',
        sessionToken: entry.guestToken,
      });

      sendJson(entry.hostWs, {
        type: 'lobby_sync',
        lobby: makePublicLobby(entry),
      });

      return;
    }

    // Reconnect to a room after a temporary WebSocket disconnect.
    if (data.type === 'resume') {
      if (currentCode) {
        sendError(ws, 'This connection is already in a lobby');
        return;
      }

      const code = typeof data.code === 'string'
        ? data.code.trim().toUpperCase()
        : '';

      const requestedRole = data.role === 'host' || data.role === 'guest'
        ? data.role
        : null;

      if (!requestedRole || typeof data.token !== 'string') {
        sendError(ws, 'Invalid reconnect information');
        return;
      }

      const entry = lobbies.get(code);

      if (!entry || entry.finished) {
        sendError(ws, 'That game is no longer available');
        return;
      }

      const expectedToken = requestedRole === 'host'
        ? entry.hostToken
        : entry.guestToken;

      if (!expectedToken || data.token !== expectedToken) {
        sendError(ws, 'Reconnect information did not match');
        return;
      }

      const currentPlayerSocket = requestedRole === 'host'
        ? entry.hostWs
        : entry.guestWs;

      if (isOpen(currentPlayerSocket)) {
        sendError(ws, 'That player is already connected');
        return;
      }

      if (requestedRole === 'guest' && !entry.lobby.hasGuest) {
        sendError(ws, 'The guest seat is no longer available');
        return;
      }

      attachToLobby(entry, requestedRole);

      sendJson(ws, {
        type: 'resumed',
        role: requestedRole,
        lobby: makePublicLobby(entry),
        state: entry.latestState,
      });

      // Keep lobby screens working when reconnecting before the game starts.
      sendJson(ws, {
        type: 'lobby_sync',
        lobby: makePublicLobby(entry),
      });

      const opponentWs = requestedRole === 'host'
        ? entry.guestWs
        : entry.hostWs;

      sendJson(opponentWs, {
        type: 'opponent_reconnected',
        role: requestedRole,
      });

      return;
    }

    // All remaining messages require membership in a room.
    if (!currentCode || !role) return;

    const entry = lobbies.get(currentCode);
    if (!entry || entry.finished) return;

    // Update only the sender's team. Only the host can choose the mode.
    if (data.type === 'lobby_update') {
      if (entry.lobby.started || !data.updates || typeof data.updates !== 'object') {
        return;
      }

      const updates = data.updates;

      if (role === 'host') {
        if (typeof updates.hostTeam === 'string') {
          entry.lobby.hostTeam = cleanTeamId(updates.hostTeam, entry.lobby.hostTeam);
        }

        if (typeof updates.mode === 'string') {
          entry.lobby.mode = cleanMode(updates.mode, entry.lobby.mode);
        }
      } else if (typeof updates.guestTeam === 'string') {
        entry.lobby.guestTeam = cleanTeamId(updates.guestTeam, entry.lobby.guestTeam);
      }

      broadcastLobby(entry);
      return;
    }

    // Only the host can start a game, and the guest must still be connected.
    if (data.type === 'start_game') {
      if (role !== 'host') {
        sendError(ws, 'Only the host can start the game');
        return;
      }

      if (!isOpen(entry.guestWs)) {
        sendError(ws, 'Wait for the other player to connect first');
        return;
      }

      entry.lobby.started = true;

      const startMessage = {
        type: 'game_start',
        lobby: makePublicLobby(entry),
      };

      sendJson(entry.hostWs, startMessage);
      sendJson(entry.guestWs, startMessage);
      return;
    }

    // The host owns the simulation; its state is relayed to the guest.
    if (data.type === 'game_state') {
      if (role !== 'host' || !entry.lobby.started || !data.state) return;

      if (!messageSizeIsSafe(data.state, 150000)) {
        sendError(ws, 'Game state message was too large');
        return;
      }

      entry.latestState = data.state;
      sendJson(entry.guestWs, {
        type: 'game_state',
        state: data.state,
      });

      return;
    }

    // Guest gameplay input is forwarded to the host for the host simulation.
    if (data.type === 'game_input') {
      if (role !== 'guest' || !entry.lobby.started || !data.input) return;

      if (!messageSizeIsSafe(data.input, 4096)) {
        sendError(ws, 'Game input message was too large');
        return;
      }

      sendJson(entry.hostWs, {
        type: 'game_input',
        input: data.input,
        seq: Number.isSafeInteger(data.seq) ? data.seq : null,
      });

      return;
    }

    // The game UI will use this when the connected player chooses to wait.
    if (data.type === 'wait_for_opponent') {
      const opponentWs = role === 'host'
        ? entry.guestWs
        : entry.hostWs;

      if (isOpen(opponentWs)) {
        sendJson(ws, { type: 'waiting_confirmed' });
      } else {
        sendJson(ws, {
          type: 'waiting_confirmed',
          opponentDisconnected: true,
        });
      }

      return;
    }

    // Only award a win if the other player's connection is gone.
    if (data.type === 'claim_win') {
      if (!entry.lobby.started) {
        sendError(ws, 'The game has not started');
        return;
      }

      const opponentRole = role === 'host' ? 'guest' : 'host';
      const opponentWs = opponentRole === 'host'
        ? entry.hostWs
        : entry.guestWs;

      if (isOpen(opponentWs)) {
        sendError(ws, 'Your opponent is still connected');
        return;
      }

      entry.finished = true;

      const result = {
        type: 'forfeit_result',
        winnerRole: role,
        loserRole: opponentRole,
        state: entry.latestState,
      };

      sendJson(ws, result);
      sendJson(opponentWs, result);
    }
  });

  ws.on('close', () => {
    if (!currentCode || !role) return;

    const code = currentCode;
    const disconnectedRole = role;
    currentCode = null;
    role = null;

    const entry = lobbies.get(code);
    if (!entry) return;

    const socketField = disconnectedRole === 'host' ? 'hostWs' : 'guestWs';

    // Ignore a close event from an older socket after a reconnect.
    if (entry[socketField] !== ws) return;

    entry[socketField] = null;

    if (entry.lobby.started) {
      if (!entry.finished) {
        const opponentWs = disconnectedRole === 'host'
          ? entry.guestWs
          : entry.hostWs;

        sendJson(opponentWs, {
          type: 'opponent_disconnected',
          role: disconnectedRole,
        });
      }

      // Keep active match rooms available for a reconnect.
      scheduleExpiry(entry);
      return;
    }

    // Before the match starts, end the lobby if either player leaves.
    const opponentWs = disconnectedRole === 'host'
      ? entry.guestWs
      : entry.hostWs;

    sendJson(opponentWs, {
      type: 'opponent_left',
      role: disconnectedRole,
      roomClosed: true,
    });

    clearExpiry(entry);
    lobbies.delete(code);
  });

  ws.on('error', (err) => {
    console.error('WebSocket connection error:', err);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
