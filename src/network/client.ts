type OnlineRole = 'host' | 'guest';

type NetworkMessage = Record<string, unknown> & {
  type: string;
};

type NetworkListener = (message: any) => void;

type OnlineSession = {
  code: string;
  role: OnlineRole;
  token: string;
};

const SESSION_STORAGE_KEY = 'pixel-pigskin-online-session';
const VALID_MODES = new Set(['arcade', 'seven7', 'one1']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function text(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function isOnlineMode(value: string): boolean {
  return VALID_MODES.has(value);
}

export class NetworkClient {
  private socket: WebSocket | null = null;
  private connectionPromise: Promise<boolean> | null = null;
  private listeners = new Map<string, Set<NetworkListener>>();
  private outbox: NetworkMessage[] = [];
  private pendingResume: OnlineSession | null = null;
  private requestedRole: OnlineRole | null = null;
  private sessionInfo: OnlineSession | null = this.loadSession();

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  get isHost(): boolean {
    return (this.sessionInfo?.role ?? this.requestedRole) === 'host';
  }

  /**
   * Connects to the WebSocket server.
   * By default, the client connects to the same origin as the game.
   * Set VITE_WS_URL if you need to use a different WebSocket address.
   */
  connect(url?: string): Promise<boolean> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve(true);
    }

    if (
      this.socket?.readyState === WebSocket.CONNECTING &&
      this.connectionPromise
    ) {
      return this.connectionPromise;
    }

    let targetUrl: string;

    try {
      targetUrl = this.resolveUrl(url);
    } catch (error) {
      this.emit('error', {
        type: 'error',
        message: 'Could not determine the online server address.',
        error,
      });
      return Promise.resolve(false);
    }

    let socket: WebSocket;

    try {
      socket = new WebSocket(targetUrl);
    } catch (error) {
      this.emit('error', {
        type: 'error',
        message: 'Could not open the online connection.',
        error,
      });
      return Promise.resolve(false);
    }

    this.socket = socket;

    let resolveConnection: (connected: boolean) => void = () => {};
    let settled = false;

    const promise = new Promise<boolean>((resolve) => {
      resolveConnection = resolve;
    });

    this.connectionPromise = promise;

    const finish = (connected: boolean) => {
      if (settled) return;
      settled = true;
      resolveConnection(connected);
    };

    socket.addEventListener('open', () => {
      if (this.socket !== socket) {
        socket.close();
        finish(false);
        return;
      }

      this.connectionPromise = null;

      const event = { type: 'connected' };
      this.emit('connected', event);
      this.emit('connect', event);
      this.emit('open', event);

      this.flushOutbox();

      if (this.pendingResume) {
        const session = this.pendingResume;
        this.pendingResume = null;
        this.send({
          type: 'resume',
          code: session.code,
          role: session.role,
          token: session.token,
        });
      }

      finish(true);
    });

    socket.addEventListener('message', (event: MessageEvent) => {
      this.handleIncoming(event.data);
    });

    socket.addEventListener('error', (event: Event) => {
      this.emit('error', {
        type: 'error',
        message: 'The online connection encountered an error.',
        error: event,
      });

      if (socket.readyState !== WebSocket.OPEN) {
        finish(false);
      }
    });

    socket.addEventListener('close', (event: CloseEvent) => {
      if (this.socket === socket) {
        this.socket = null;
      }

      if (this.connectionPromise === promise) {
        this.connectionPromise = null;
      }

      this.outbox = [];

      const closeInfo = {
        type: 'disconnected',
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      };

      this.emit('disconnected', closeInfo);
      this.emit('disconnect', closeInfo);
      this.emit('close', closeInfo);

      finish(false);
    });

    return promise;
  }

  /**
   * Creates a room as the host.
   *
   * Accepts either an options object:
   *   hostLobby({ mode: 'arcade', team: '...', playerName: '...' })
   *
   * Or strings in either order:
   *   hostLobby('arcade', 'Team Name', 'Player Name')
   *   hostLobby('Team Name', 'arcade', 'Player Name')
   */
  hostLobby(
    first?: unknown,
    second?: unknown,
    third?: unknown,
  ): boolean {
    const options = isRecord(first) ? first : {};
    const args = [first, second, third]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);

    const suppliedMode = text(options.mode);
    const mode = isOnlineMode(suppliedMode)
      ? suppliedMode
      : args.find(isOnlineMode) || 'arcade';

    const team =
      text(options.team, options.teamName, options.selectedTeam) ||
      args.find((value) => value !== mode) ||
      '';

    const playerName =
      text(options.playerName, options.name) ||
      args.find((value) => value !== mode && value !== team) ||
      '';

    this.clearSession();
    this.pendingResume = null;
    this.requestedRole = 'host';

    return this.send({
      type: 'host',
      mode,
      team,
      teamId: team,
      teamName: team,
      hostTeam: team,
      playerName,
      name: playerName,
    });
  }

  /**
   * Joins a room as the guest.
   *
   * Accepts either an options object:
   *   joinLobby({ code: 'ABCD', team: '...', playerName: '...' })
   *
   * Or:
   *   joinLobby('ABCD', 'Team Name', 'Player Name')
   */
  joinLobby(
    first?: unknown,
    second?: unknown,
    third?: unknown,
  ): boolean {
    const options = isRecord(first)
      ? first
      : isRecord(second)
        ? second
        : {};

    const args = [second, third]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);

    const code = text(
      options.code,
      options.roomCode,
      typeof first === 'string' ? first : '',
    ).toUpperCase();

    if (!code) {
      this.emit('error', {
        type: 'error',
        message: 'Enter a room code before joining.',
      });
      return false;
    }

    const team =
      text(options.team, options.teamName, options.selectedTeam) ||
      args.find((value) => value !== code) ||
      '';

    const playerName =
      text(options.playerName, options.name) ||
      args.find((value) => value !== code && value !== team) ||
      '';

    this.clearSession();
    this.pendingResume = null;
    this.requestedRole = 'guest';

    return this.send({
      type: 'join',
      code,
      roomCode: code,
      team,
      teamId: team,
      teamName: team,
      guestTeam: team,
      playerName,
      name: playerName,
    });
  }

  /**
   * Updates this player's team and, for the host, the room mode.
   */
  updateLobby(
    updatesOrTeam?: unknown,
    modeOrName?: unknown,
    playerName?: unknown,
  ): boolean {
    const updates: Record<string, unknown> = isRecord(updatesOrTeam)
      ? { ...updatesOrTeam }
      : {};

    if (typeof updatesOrTeam === 'string' && updatesOrTeam.trim()) {
      updates.team = updatesOrTeam.trim();
    }

    const secondValue = text(modeOrName);

    if (secondValue) {
      if (isOnlineMode(secondValue)) {
        updates.mode = secondValue;
      } else if (!updates.playerName && !updates.name) {
        updates.playerName = secondValue;
      }
    }

    if (typeof playerName === 'string' && playerName.trim()) {
      updates.playerName = playerName.trim();
    }

    const team = text(
      updates.team,
      updates.teamName,
      updates.selectedTeam,
    );

    if (team) {
      updates.team = team;
      updates.teamName = team;
    }

    return this.send({
      type: 'lobby_update',
      ...updates,
      update: updates,
      updates,
    });
  }

  startGame(details?: unknown): boolean {
    return this.send({
      type: 'start_game',
      ...(isRecord(details) ? details : {}),
    });
  }

  sendGameState(state: unknown): boolean {
    return this.send({
      type: 'game_state',
      state,
    });
  }

  sendGameInput(input: unknown): boolean {
    return this.send({
      type: 'game_input',
      input,
    });
  }

  waitForOpponent(): boolean {
    return this.send({ type: 'wait_for_opponent' });
  }

  claimWin(): boolean {
    return this.send({ type: 'claim_win' });
  }

  /**
   * Resumes a room using explicit credentials or the saved session.
   */
  resume(
    code?: string,
    role?: OnlineRole,
    token?: string,
  ): boolean {
    const saved = this.sessionInfo;

    const session: OnlineSession = {
      code: text(code, saved?.code).toUpperCase(),
      role: role || saved?.role || 'guest',
      token: text(token, saved?.token),
    };

    if (!session.code || !session.token) {
      this.emit('error', {
        type: 'error',
        message: 'There is no saved online session to resume.',
      });
      return false;
    }

    this.requestedRole = session.role;
    this.sessionInfo = session;
    this.saveSession();

    const message = {
      type: 'resume',
      code: session.code,
      role: session.role,
      token: session.token,
    };

    if (this.socket?.readyState === WebSocket.CONNECTING) {
      return this.send(message);
    }

    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.pendingResume = session;
      void this.connect();
      return true;
    }

    return this.send(message);
  }

  resumeSession(): boolean {
    if (!this.sessionInfo) {
      this.emit('error', {
        type: 'error',
        message: 'There is no saved online session to resume.',
      });
      return false;
    }

    return this.resume(
      this.sessionInfo.code,
      this.sessionInfo.role,
      this.sessionInfo.token,
    );
  }

  getSession(): OnlineSession | null {
    return this.sessionInfo ? { ...this.sessionInfo } : null;
  }

  clearSession(): void {
    this.sessionInfo = null;

    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Storage may be unavailable in private or restricted browsing modes.
    }
  }

  /**
   * Sends either a complete message object or a message type plus data.
   */
  send(
    messageOrType: NetworkMessage | string,
    data?: unknown,
  ): boolean {
    let message: NetworkMessage;

    if (typeof messageOrType === 'string') {
      const type = messageOrType;

      if (type === 'game_state') {
        const extra = isRecord(data) ? data : {};
        const state =
          isRecord(data) && 'state' in data ? data.state : data;

        message = { type, ...extra, state };
      } else if (type === 'game_input') {
        const extra = isRecord(data) ? data : {};
        const input =
          isRecord(data) && 'input' in data ? data.input : data;

        message = { type, ...extra, input };
      } else if (isRecord(data)) {
        message = { type, ...data };
      } else if (data !== undefined) {
        message = { type, payload: data };
      } else {
        message = { type };
      }
    } else {
      message = messageOrType;
    }

    const socket = this.socket;

    if (socket?.readyState === WebSocket.OPEN) {
      try {
        const encoded = JSON.stringify(message);
        if (typeof encoded !== 'string') return false;

        socket.send(encoded);
        return true;
      } catch (error) {
        this.emit('error', {
          type: 'error',
          message: 'Could not send the online message.',
          error,
        });
        return false;
      }
    }

    if (socket?.readyState === WebSocket.CONNECTING) {
      this.outbox.push(message);
      return true;
    }

    this.emit('error', {
      type: 'error',
      message: 'Not connected to the online server.',
    });
    return false;
  }

  on(eventName: string, listener: NetworkListener): () => void {
    let eventListeners = this.listeners.get(eventName);

    if (!eventListeners) {
      eventListeners = new Set<NetworkListener>();
      this.listeners.set(eventName, eventListeners);
    }

    eventListeners.add(listener);

    return () => this.off(eventName, listener);
  }

  off(eventName: string, listener: NetworkListener): void {
    const eventListeners = this.listeners.get(eventName);
    if (!eventListeners) return;

    eventListeners.delete(listener);

    if (eventListeners.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  disconnect(): void {
    const socket = this.socket;

    this.socket = null;
    this.connectionPromise = null;
    this.outbox = [];
    this.pendingResume = null;

    if (
      socket &&
      socket.readyState !== WebSocket.CLOSED &&
      socket.readyState !== WebSocket.CLOSING
    ) {
      socket.close(1000, 'Client disconnected');
    }
  }

  private resolveUrl(override?: string): string {
    const env = (import.meta as any).env || {};
    const configuredUrl =
      override ||
      env.VITE_WS_URL ||
      env.VITE_SERVER_URL;

    if (configuredUrl) {
      const base =
        typeof window !== 'undefined'
          ? window.location.href
          : undefined;

      const url = base
        ? new URL(configuredUrl, base)
        : new URL(configuredUrl);

      if (url.protocol === 'http:') url.protocol = 'ws:';
      if (url.protocol === 'https:') url.protocol = 'wss:';

      return url.toString();
    }

    if (typeof window === 'undefined') {
      throw new Error('No browser location is available.');
    }

    const location = window.location;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = location.host;

    // Vite's development server is separate from the game server.
    if (
      (location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1') &&
      ['5173', '5174', '4173'].includes(location.port)
    ) {
      host = `${location.hostname}:3001`;
    }

    return `${protocol}//${host}`;
  }

  private flushOutbox(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;

    const queued = this.outbox.splice(0);

    for (const message of queued) {
      this.send(message);
    }
  }

  private handleIncoming(rawData: unknown): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(
        typeof rawData === 'string' ? rawData : String(rawData),
      );
    } catch (error) {
      this.emit('error', {
        type: 'error',
        message: 'Received an unreadable message from the online server.',
        error,
      });
      return;
    }

    if (!isRecord(parsed) || typeof parsed.type !== 'string') {
      this.emit('message', parsed);
      return;
    }

    const message = parsed as NetworkMessage;

    this.rememberSession(message);
    this.emit(message.type, message);
    this.emit('message', message);

    const aliases: Record<string, string[]> = {
      hosted: ['lobby_created'],
      room_created: ['lobby_created'],
      joined: ['lobby_joined'],
      lobby_update: ['lobby_updated'],
      lobby_updated: ['lobby_update'],
      game_start: ['game_started', 'start_game'],
    };

    for (const alias of aliases[message.type] || []) {
      this.emit(alias, message);
    }
  }

  private rememberSession(message: NetworkMessage): void {
    const lobby = isRecord(message.lobby) ? message.lobby : {};

    const code = text(
      message.code,
      message.roomCode,
      message.lobbyCode,
      lobby.code,
      this.sessionInfo?.code,
    ).toUpperCase();

    const roleText = text(
      message.role,
      message.playerRole,
      lobby.role,
      this.requestedRole,
      this.sessionInfo?.role,
    ).toLowerCase();

    if (roleText !== 'host' && roleText !== 'guest') return;

    const role = roleText as OnlineRole;
    const savedToken =
      this.sessionInfo?.code === code
        ? this.sessionInfo.token
        : '';

    const token = text(
      message.token,
      message.sessionToken,
      role === 'host' ? message.hostToken : message.guestToken,
      lobby.token,
      savedToken,
    );

    if (!code || !token) return;

    this.sessionInfo = { code, role, token };
    this.saveSession();
  }

  private loadSession(): OnlineSession | null {
    try {
      if (typeof window === 'undefined') return null;

      const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!saved) return null;

      const parsed: unknown = JSON.parse(saved);
      if (!isRecord(parsed)) return null;

      const code = text(parsed.code).toUpperCase();
      const role = text(parsed.role).toLowerCase();
      const token = text(parsed.token);

      if (
        !code ||
        !token ||
        (role !== 'host' && role !== 'guest')
      ) {
        return null;
      }

      return {
        code,
        role: role as OnlineRole,
        token,
      };
    } catch {
      return null;
    }
  }

  private saveSession(): void {
    try {
      if (typeof window === 'undefined' || !this.sessionInfo) return;

      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(this.sessionInfo),
      );
    } catch {
      // Storage may be unavailable in private or restricted browsing modes.
    }
  }

  private emit(eventName: string, message: unknown): void {
    const eventListeners = this.listeners.get(eventName);
    if (!eventListeners) return;

    for (const listener of eventListeners) {
      try {
        listener(message);
      } catch (error) {
        console.error(`Online listener for "${eventName}" failed:`, error);
      }
    }
  }
}

export const network = new NetworkClient();
export default network;
