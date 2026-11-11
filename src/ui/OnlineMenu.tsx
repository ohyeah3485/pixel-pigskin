import { useState, useEffect, useCallback } from 'react';
import { X, Globe, Users, Loader, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { network, LobbyState } from '../network/client';
import { TEAMS, getTeam, inkOn, overall } from '../game/teams';
import { audio } from '../game/audio';
import type { ModeId } from '../game/types';

interface Props {
  onClose: () => void;
  onStartGame: (isHost: boolean, mode: ModeId, myTeam: string, oppTeam: string) => void;
  serverUrl: string;
  defaultTeam: string;
}

const MODES: { id: ModeId; name: string; desc: string }[] = [
  { id: 'arcade', name: 'EXHIBITION', desc: 'Full game with halves, 4th down calls, field goals' },
  { id: 'seven7', name: '7 ON 7', desc: 'All-pass shootout, no QB runs' },
  { id: 'one1', name: '1 V 1 DRILL', desc: 'WR vs DB island drill' },
];

function TeamBadge({ id, size = 38 }: { id: string; size?: number }) {
  const t = getTeam(id);
  return (
    <div className="flex shrink-0 items-center justify-center border-2 border-[#04140b]"
      style={{ width: size, height: size, background: t.c1, boxShadow: `inset 0 -4px 0 ${t.c2}` }}>
      <span className="font-pixel leading-none" style={{ fontSize: size * 0.26, color: inkOn(t.c1) }}>{t.abbr}</span>
    </div>
  );
}

export function OnlineMenu({ onClose, onStartGame, serverUrl, defaultTeam }: Props) {
  const [view, setView] = useState<'pick' | 'hosting' | 'joining' | 'lobby'>('pick');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [myTeam, setMyTeam] = useState(defaultTeam);
  const [connecting, setConnecting] = useState(false);

  const isHost = network.isHost;

  // Connect to server on mount
  useEffect(() => {
    if (!network.connected) {
      setConnecting(true);
      network.connect(serverUrl);
    }
    const onConn = () => setConnecting(false);
    const onErr = () => { setConnecting(false); setError('Could not connect to server'); };
    const onDisc = () => { setError('Disconnected'); setView('pick'); setLobby(null); };
    const onCreated = (d: any) => { setLobby(d.lobby); setView('lobby'); };
    const onSync = (d: any) => { setLobby(d.lobby); if (view !== 'lobby') setView('lobby'); };
    const onStart = (d: any) => {
      const lb = d.lobby as LobbyState;
      audio.ding();
      const myT = isHost ? lb.hostTeam : lb.guestTeam;
      const oppT = isHost ? lb.guestTeam : lb.hostTeam;
      onStartGame(isHost, lb.mode as ModeId, myT, oppT);
    };
    const onOppLeft = () => { setError('Opponent left'); setView('pick'); setLobby(null); };
    const onSrvErr = (d: any) => setError(d.message);

    network.on('connected', onConn);
    network.on('connection_error', onErr);
    network.on('disconnected', onDisc);
    network.on('lobby_created', onCreated);
    network.on('lobby_sync', onSync);
    network.on('game_start', onStart);
    network.on('opponent_left', onOppLeft);
    network.on('error', onSrvErr);

    return () => {
      network.off('connected', onConn);
      network.off('connection_error', onErr);
      network.off('disconnected', onDisc);
      network.off('lobby_created', onCreated);
      network.off('lobby_sync', onSync);
      network.off('game_start', onStart);
      network.off('opponent_left', onOppLeft);
      network.off('error', onSrvErr);
    };
  }, [serverUrl, onStartGame, isHost, view]);

  const doHost = () => {
    audio.uiClick();
    network.hostLobby(myTeam);
    setView('hosting');
    setError('');
  };

  const doJoin = () => {
    audio.uiClick();
    if (joinCode.length !== 4) { setError('Enter a 4-letter code'); return; }
    network.joinLobby(joinCode, myTeam);
    setError('');
  };

  const cycleTeam = useCallback((dir: number) => {
    audio.uiHover();
    const idx = TEAMS.findIndex(t => t.id === myTeam);
    const next = (idx + dir + TEAMS.length) % TEAMS.length;
    const newId = TEAMS[next].id;
    setMyTeam(newId);
    network.updateLobby(isHost ? { hostTeam: newId } : { guestTeam: newId });
  }, [myTeam, isHost]);

  const cycleMode = useCallback((dir: number) => {
    if (!isHost || !lobby) return;
    audio.uiHover();
    const idx = MODES.findIndex(m => m.id === lobby.mode);
    const next = (idx + dir + MODES.length) % MODES.length;
    network.updateLobby({ mode: MODES[next].id });
  }, [isHost, lobby]);

  const startGame = () => {
    audio.uiClick();
    network.startGame();
  };

  const t = getTeam(myTeam);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020a05]/85 p-3" onClick={onClose}>
      <div className="pix-panel pop-in flex w-full max-w-[560px] flex-col bg-[#07220f] p-5" onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between border-b-2 border-[#123a1e] pb-3">
          <div className="flex items-center gap-2 text-[#4dd8ff]">
            <Globe size={18} />
            <h2 className="font-pixel text-[13px]">ONLINE MULTIPLAYER</h2>
          </div>
          <button onClick={() => { audio.uiClick(); network.disconnect(); onClose(); }}
            className="pix-btn flex h-8 w-8 items-center justify-center bg-[#3d1120] text-[#ff8b9b]">
            <X size={14} />
          </button>
        </div>

        {error && <div className="font-pixel mt-3 border-2 border-[#ff4d5e] bg-[#3d1120] px-3 py-2 text-center text-[8px] text-[#ff8b9b]">{error}</div>}

        <div className="mt-4 min-h-[260px]">
          {/* --- PICK HOST OR JOIN --- */}
          {view === 'pick' && (
            <div className="flex flex-col gap-4">
              {connecting && <div className="flex items-center justify-center gap-2 text-[#7aa383]"><Loader size={14} className="animate-spin" /> Connecting...</div>}

              {/* team picker */}
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => cycleTeam(-1)} className="pix-btn bg-[#123a1e] p-2 text-[#aaff3c]"><ChevronLeft size={16} /></button>
                <div className="flex items-center gap-3">
                  <TeamBadge id={myTeam} size={44} />
                  <div>
                    <div className="font-pixel text-[10px]" style={{ color: t.c1 === '#000000' ? '#eaffea' : t.c1 }}>{t.name.toUpperCase()}</div>
                    <div className="font-pixel text-[7px] text-[#7aa383]">OVR {overall(t)}</div>
                  </div>
                </div>
                <button onClick={() => cycleTeam(1)} className="pix-btn bg-[#123a1e] p-2 text-[#aaff3c]"><ChevronRight size={16} /></button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button disabled={!network.connected} onClick={doHost}
                  className={`pix-btn flex flex-col items-center gap-2 p-4 ${network.connected ? 'bg-[#1d5c33] text-[#b6f5c9]' : 'bg-[#0a1a0f] text-[#3c5244]'}`}>
                  <Globe size={22} />
                  <span className="font-pixel text-[10px]">HOST GAME</span>
                  <span className="text-[10px] opacity-70">Create a lobby code</span>
                </button>
                <div className="flex flex-col gap-2">
                  <input type="text" maxLength={4} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="CODE" className="font-pixel w-full border-3 border-[#4dd8ff] bg-[#0a1a24] px-3 py-2 text-center text-[18px] uppercase tracking-widest text-[#eaffea] outline-none"
                    style={{ borderWidth: 3 }} />
                  <button disabled={!network.connected || joinCode.length !== 4} onClick={doJoin}
                    className={`pix-btn flex items-center justify-center gap-2 p-3 text-[10px] ${network.connected && joinCode.length === 4 ? 'bg-[#123a4f] text-[#4dd8ff]' : 'bg-[#0a1a0f] text-[#3c5244]'}`}>
                    <Users size={14} /> JOIN GAME
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- HOSTING: waiting for guest --- */}
          {view === 'hosting' && !lobby && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader size={20} className="animate-spin text-[#ffd94d]" />
              <div className="font-pixel text-[9px] text-[#7aa383]">Creating lobby...</div>
            </div>
          )}

          {/* --- LOBBY SCREEN --- */}
          {view === 'lobby' && lobby && (
            <div className="flex flex-col gap-4">
              {/* lobby code */}
              <div className="flex items-center justify-center gap-3">
                <span className="font-pixel text-[8px] text-[#7aa383]">LOBBY CODE</span>
                <span className="font-pixel border-3 border-[#ffd94d] bg-[#1a1405] px-4 py-2 text-[22px] tracking-[0.3em] text-[#ffd94d]" style={{ borderWidth: 3 }}>{lobby.code}</span>
              </div>

              {/* players */}
              <div className="grid grid-cols-2 gap-3">
                {/* host */}
                <div className="border-3 border-[#aaff3c] bg-[#0d2a14] p-3" style={{ borderWidth: 3 }}>
                  <div className="font-pixel text-[7px] text-[#aaff3c]">HOST {isHost ? '(YOU)' : ''}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <TeamBadge id={lobby.hostTeam} size={32} />
                    <div>
                      <div className="font-pixel text-[9px] text-[#eaffea]">{getTeam(lobby.hostTeam).name.toUpperCase()}</div>
                      <div className="font-pixel text-[7px] text-[#7aa383]">OVR {overall(getTeam(lobby.hostTeam))}</div>
                    </div>
                  </div>
                  {isHost && (
                    <div className="mt-2 flex gap-1">
                      <button onClick={() => cycleTeam(-1)} className="pix-btn bg-[#123a1e] px-2 py-1 text-[#aaff3c]"><ChevronLeft size={12} /></button>
                      <button onClick={() => cycleTeam(1)} className="pix-btn bg-[#123a1e] px-2 py-1 text-[#aaff3c]"><ChevronRight size={12} /></button>
                    </div>
                  )}
                </div>

                {/* guest */}
                <div className={`border-3 p-3 ${lobby.hasGuest ? 'border-[#4dd8ff] bg-[#0a1a24]' : 'border-[#2a2a2a] bg-[#0a0a0a]'}`} style={{ borderWidth: 3 }}>
                  <div className="font-pixel text-[7px]" style={{ color: lobby.hasGuest ? '#4dd8ff' : '#555' }}>
                    {lobby.hasGuest ? `GUEST ${!isHost ? '(YOU)' : ''}` : 'WAITING...'}
                  </div>
                  {lobby.hasGuest ? (
                    <div className="mt-2 flex items-center gap-2">
                      <TeamBadge id={lobby.guestTeam} size={32} />
                      <div>
                        <div className="font-pixel text-[9px] text-[#eaffea]">{getTeam(lobby.guestTeam).name.toUpperCase()}</div>
                        <div className="font-pixel text-[7px] text-[#7aa383]">OVR {overall(getTeam(lobby.guestTeam))}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2"><Loader size={12} className="animate-spin text-[#555]" /><span className="text-[11px] text-[#555]">Waiting for player...</span></div>
                  )}
                  {!isHost && lobby.hasGuest && (
                    <div className="mt-2 flex gap-1">
                      <button onClick={() => cycleTeam(-1)} className="pix-btn bg-[#12303f] px-2 py-1 text-[#4dd8ff]"><ChevronLeft size={12} /></button>
                      <button onClick={() => cycleTeam(1)} className="pix-btn bg-[#12303f] px-2 py-1 text-[#4dd8ff]"><ChevronRight size={12} /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* mode picker (host only) */}
              <div className="border-3 border-[#123a1e] bg-[#05160b] p-3" style={{ borderWidth: 3 }}>
                <div className="font-pixel text-[7px] text-[#7aa383]">GAME MODE {isHost ? '— HOST PICKS' : ''}</div>
                <div className="mt-2 flex items-center gap-3">
                  {isHost && <button onClick={() => cycleMode(-1)} className="pix-btn bg-[#123a1e] px-2 py-1 text-[#aaff3c]"><ChevronLeft size={12} /></button>}
                  <div className="flex-1 text-center">
                    <div className="font-pixel text-[11px] text-[#eaffea]">{MODES.find(m => m.id === lobby.mode)?.name ?? lobby.mode}</div>
                    <div className="text-[10px] text-[#7aa383]">{MODES.find(m => m.id === lobby.mode)?.desc ?? ''}</div>
                  </div>
                  {isHost && <button onClick={() => cycleMode(1)} className="pix-btn bg-[#123a1e] px-2 py-1 text-[#aaff3c]"><ChevronRight size={12} /></button>}
                </div>
              </div>

              {/* start button (host only, needs guest) */}
              {isHost && (
                <button disabled={!lobby.hasGuest} onClick={startGame}
                  className={`pix-btn flex w-full items-center justify-center gap-2 py-4 text-[12px] ${lobby.hasGuest ? 'bg-[#aaff3c] text-[#07140c]' : 'bg-[#1a241c] text-[#3c5244]'}`}>
                  {lobby.hasGuest ? <><ArrowRight size={16} /> START GAME</> : 'WAITING FOR OPPONENT'}
                </button>
              )}
              {!isHost && <div className="font-pixel animate-pulse text-center text-[9px] text-[#ffd94d]">WAITING FOR HOST TO START...</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
