export type NetworkCallback = (data: any) => void;

export interface LobbyState {
  code: string;
  hostTeam: string;
  guestTeam: string;
  mode: string;
  hostReady: boolean;
  guestReady: boolean;
  started: boolean;
  hasGuest: boolean;
}

class NetworkClient {
  private ws: WebSocket | null = null;
  private callbacks: Map<string, NetworkCallback[]> = new Map();
  public lobbyCode: string | null = null;
  public isHost = false;
  public connected = false;
  public inLobby = false;

  connect(url: string) {
    if (this.ws) this.ws.close();
    this.ws = new WebSocket(url);
    this.ws.onopen = () => { this.connected = true; this.emit('connected', {}); };
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type) this.emit(data.type, data);
      } catch {}
    };
    this.ws.onclose = () => {
      this.connected = false; this.inLobby = false; this.lobbyCode = null;
      this.emit('disconnected', {});
    };
    this.ws.onerror = () => this.emit('connection_error', {});
  }

  hostLobby(teamId: string) {
    this.isHost = true;
    this.send({ type: 'host', teamId });
  }

  joinLobby(code: string, teamId: string) {
    this.isHost = false;
    this.send({ type: 'join', code, teamId });
  }

  updateLobby(updates: Partial<LobbyState>) {
    this.send({ type: 'lobby_update', updates });
  }

  startGame() {
    this.send({ type: 'start_game' });
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event: string, callback: NetworkCallback) {
    if (!this.callbacks.has(event)) this.callbacks.set(event, []);
    this.callbacks.get(event)!.push(callback);
  }

  off(event: string, callback?: NetworkCallback) {
    if (!callback) { this.callbacks.delete(event); return; }
    if (this.callbacks.has(event)) {
      this.callbacks.set(event, this.callbacks.get(event)!.filter(cb => cb !== callback));
    }
  }

  private emit(event: string, data: any) {
    this.callbacks.get(event)?.forEach(cb => cb(data));
  }

  disconnect() {
    this.inLobby = false; this.lobbyCode = null;
    if (this.ws) { this.ws.close(); this.ws = null; }
  }
}

export const network = new NetworkClient();
