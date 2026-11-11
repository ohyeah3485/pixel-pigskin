import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine } from './game/engine';
import { DrillSide, FinalStats, ModeId, Mods } from './game/types';
import { MainMenu } from './ui/MainMenu';
import { ModsModal, ScoresModal, HelpModal } from './ui/Modals';
import { PauseOverlay } from './ui/PauseOverlay';
import { TeamPicker } from './ui/TeamPicker';
import { OnlineMenu } from './ui/OnlineMenu';
import { GameOver } from './ui/GameOver';
import { FranchiseHub } from './ui/FranchiseHub';
import { FranchiseState, freshFranchise, loadFranchise, saveFranchise, advanceWeek, advancePlayoff, creditsForWin, creditsForLoss } from './game/franchise';
import { network } from './network/client';

const MODS_KEY = 'pixel-pigskin.mods';
const TEAM_KEY = 'pixel-pigskin.team';

function loadTeam(): { teamId: string; oppId: string | null } {
  try {
    const raw = localStorage.getItem(TEAM_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v && typeof v.teamId === 'string') return { teamId: v.teamId, oppId: v.oppId ?? null };
    }
  } catch { /* ignore */ }
  return { teamId: 'kc', oppId: null };
}

function loadMods(): Mods {
  try {
    const raw = localStorage.getItem(MODS_KEY);
    if (raw) return { bigHead: false, moonBall: false, turbo: false, blitz: false, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { bigHead: false, moonBall: false, turbo: false, blitz: false };
}

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game' | 'franchise'>('menu');
  const [modal, setModal] = useState<'none' | 'mods' | 'scores' | 'help' | 'teams' | 'online'>('none');
  const [mode, setMode] = useState<ModeId>('arcade');
  const [side, setSide] = useState<DrillSide>('wr');
  const [twoP, setTwoP] = useState(false);
  const [mods, setMods] = useState<Mods>(loadMods);
  const [teams, setTeams] = useState(loadTeam);
  const [paused, setPaused] = useState(false);
  const [onlineRole, setOnlineRole] = useState<'host' | 'guest' | null>(null);
  const [franchise, setFranchise] = useState<FranchiseState | null>(loadFranchise);
  const franchiseRef = useRef<FranchiseState | null>(null);
  franchiseRef.current = franchise;
  const setFranchiseAndSave = useCallback((f: FranchiseState | null) => {
    franchiseRef.current = f;
    setFranchise(f);
    if (f) saveFranchise(f);
  }, []);

  const [results, setResults] = useState<FinalStats | null>(null);

  const engineRef = useRef<GameEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modsRef = useRef(mods);
  modsRef.current = mods;
  const sideRef = useRef(side);
  sideRef.current = side;
  const twoPRef = useRef(twoP);
  twoPRef.current = twoP;
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  // create/destroy the engine with the game screen
  useEffect(() => {
    if (screen !== 'game' || !canvasRef.current) return;
    const engine = new GameEngine(canvasRef.current, {
      onPause: (p) => setPaused(p),
      onOver: (s) => { setResults({ ...s }); if (franchiseRef.current) franchiseResult(s); },
    });
    engineRef.current = engine;
    engine.start(mode, modsRef.current, sideRef.current, twoPRef.current, teamsRef.current.teamId, teamsRef.current.oppId ?? undefined);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const play = useCallback((m: ModeId, s: DrillSide, two: boolean) => {
    setMode(m);
    setSide(s);
    sideRef.current = s;
    setTwoP(two);
    twoPRef.current = two;
    setResults(null);
    setPaused(false);
    setModal('none');
    setScreen('game');
  }, []);

  const restart = useCallback(() => {
    setResults(null);
    setPaused(false);
    engineRef.current?.start(mode, modsRef.current, sideRef.current, twoPRef.current, teamsRef.current.teamId, teamsRef.current.oppId ?? undefined);
  }, [mode]);

  const resume = useCallback(() => {
    engineRef.current?.setPaused(false);
  }, []);

  // --- Network Sync Loop ---
  useEffect(() => {
    if (screen !== 'game' || !onlineRole) return;

    const interval = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;

      if (onlineRole === 'host') {
        // Host broadcasts the entire world state
        const state = engine.getNetworkState();
        network.send({ type: 'game_state', state });
      }
    }, 50); // 20 times per second

    const onGameState = (data: any) => {
      const engine = engineRef.current;
      if (engine && onlineRole === 'guest') {
        engine.isRemote = true;
        engine.remoteState = data.state;
      }
    };

    network.on('game_state', onGameState);

    return () => {
      clearInterval(interval);
      network.off('game_state', onGameState);
    };
  }, [screen, onlineRole]);

  const quit = useCallback(() => {
    engineRef.current?.quitToMenu();
    setResults(null);
    setPaused(false);
    setOnlineRole(null);
    network.disconnect();
    if (franchise) setScreen('franchise');
    else setScreen('menu');
  }, [franchise]);

  const startFranchise = useCallback((teamId: string) => {
    const f = freshFranchise(teamId);
    setFranchiseAndSave(f);
    setScreen('franchise');
  }, [setFranchiseAndSave]);

  const franchisePlay = useCallback((oppId: string) => {
    if (!franchise) return;
    setMode('arcade');
    teamsRef.current = { teamId: franchise.teamId, oppId };
    setTeams({ teamId: franchise.teamId, oppId });
    setResults(null);
    setPaused(false);
    setScreen('game');
  }, [franchise]);

  const franchiseResult = useCallback((stats: FinalStats) => {
    const cur = franchiseRef.current;
    if (!cur) return;
    const won = stats.scoreUs > stats.scoreThem;
    let f = { ...cur };
    if (f.playoffRound > 0) {
      f = advancePlayoff(f, won);
    } else {
      const game = f.schedule[f.week - 1];
      if (game) {
        game.result = won ? 'win' : 'loss';
        game.scoreUs = stats.scoreUs;
        game.scoreThem = stats.scoreThem;
      }
      if (won) { f.wins++; f.credits += creditsForWin(stats.scoreUs - stats.scoreThem); }
      else { f.losses++; f.credits += creditsForLoss(); }
      f = advanceWeek(f);
    }
    setFranchiseAndSave(f);
  }, [setFranchiseAndSave]);

  const changeTeams = useCallback((teamId: string, oppId: string | null) => {
    const v = { teamId, oppId };
    setTeams(v);
    teamsRef.current = v;
    try { localStorage.setItem(TEAM_KEY, JSON.stringify(v)); } catch { /* ignore */ }
    setModal('none');
  }, []);

  const changeMods = useCallback((m: Mods) => {
    setMods(m);
    try { localStorage.setItem(MODS_KEY, JSON.stringify(m)); } catch { /* ignore */ }
  }, []);

  // ambience embers for menu
  const embers = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: (i * 37.7) % 100,
        delay: (i * 0.83) % 9,
        dur: 7 + ((i * 1.37) % 6),
        size: 2 + ((i * 3) % 3),
        col: i % 3 === 0 ? '#aaff3c' : i % 3 === 1 ? '#ffd94d' : '#4dd8ff',
      })),
    []
  );

  return (
    <div className="crt relative h-full w-full overflow-hidden bg-[#04120a]">
      {/* -------- menu screen -------- */}
      {screen === 'menu' && (
        <div className="absolute inset-0 overflow-y-auto">
          {/* stadium backdrop */}
          <div className="pointer-events-none fixed inset-0">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(1200px 500px at 50% -10%, rgba(60,160,90,.35), transparent 60%), radial-gradient(500px 300px at 8% 10%, rgba(255,240,180,.14), transparent 70%), radial-gradient(500px 300px at 92% 10%, rgba(255,240,180,.14), transparent 70%), linear-gradient(#03140a, #051f0e 55%, #07230f)',
              }}
            />
            {/* floodlight poles */}
            {[6, 92].map((l) => (
              <div key={l} className="absolute top-10 w-1 bg-[#0a2413]" style={{ left: `${l}%`, height: 130 }}>
                <div className="absolute -left-4 top-0 h-3 w-9 border-2 border-[#0f3319] bg-[#0d2b16]" />
              </div>
            ))}
            {/* yard-line grid floor */}
            <div
              className="absolute bottom-0 left-1/2 h-[46vh] w-[140vw] -translate-x-1/2 opacity-25"
              style={{
                background:
                  'repeating-linear-gradient(to right, transparent 0 78px, rgba(170,255,60,.35) 78px 80px), repeating-linear-gradient(to top, transparent 0 34px, rgba(170,255,60,.25) 34px 36px), linear-gradient(#0b3319, #03140a)',
                transform: 'perspective(500px) rotateX(58deg) translateX(-50%)',
                transformOrigin: 'bottom',
              }}
            />
            {/* crowd strip */}
            <div className="absolute bottom-0 left-0 flex h-16 w-full items-end gap-[3px] overflow-hidden opacity-60">
              {Array.from({ length: 130 }).map((_, i) => (
                <div
                  key={i}
                  className="crowd-pulse w-full shrink-0"
                  style={{
                    height: `${22 + ((i * 53) % 40)}%`,
                    background: i % 7 === 0 ? '#ff5d75' : i % 5 === 0 ? '#ffd94d' : i % 3 === 0 ? '#4a9f63' : '#123a1e',
                    animationDelay: `${(i * 0.13) % 1.6}s`,
                  }}
                />
              ))}
            </div>
            {/* floating embers */}
            {embers.map((e, i) => (
              <div
                key={i}
                className="float-particle absolute top-full"
                style={{
                  left: `${e.left}%`,
                  width: e.size,
                  height: e.size,
                  background: e.col,
                  opacity: 0,
                  animationDuration: `${e.dur}s`,
                  animationDelay: `${e.delay}s`,
                }}
              />
            ))}
          </div>

          <MainMenu
            onPlay={play}
            onOpenMods={() => setModal('mods')}
            onOpenScores={() => setModal('scores')}
            onOpenHelp={() => setModal('help')}
            onFranchise={startFranchise}
            onOpenOnline={() => setModal('online')}
            onOpenTeams={() => setModal('teams')}
            mods={mods}
            blockKeys={modal !== 'none'}
            teamId={teams.teamId}
            oppId={teams.oppId}
            hasSave={!!franchise}
          />
        </div>
      )}

      {/* -------- game screen -------- */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#020d06]">
          {/* side dressing on wide screens */}
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-between xl:flex">
            <div className="font-pixel rotate-180 text-[10px] tracking-[0.6em] text-[#123a1e]" style={{ writingMode: 'vertical-rl' }}>
              PIXEL PIGSKIN
            </div>
            <div className="font-pixel text-[10px] tracking-[0.6em] text-[#123a1e]" style={{ writingMode: 'vertical-rl' }}>
              EST 1995
            </div>
          </div>
          <canvas ref={canvasRef} className="game-canvas block" style={{ touchAction: 'none' }} />
        </div>
      )}

      {/* -------- franchise hub -------- */}
      {screen === 'franchise' && franchise && (
        <div className="absolute inset-0 z-10 overflow-y-auto bg-[#04120a]">
          <FranchiseHub
            franchise={franchise}
            onChange={(f) => setFranchiseAndSave(f)}
            onPlay={franchisePlay}
            onQuit={() => { setFranchiseAndSave(null); setScreen('menu'); }}
          />
        </div>
      )}

      {/* -------- overlays -------- */}
      {paused && !results && screen === 'game' && (
        <PauseOverlay onResume={resume} onRestart={restart} onQuit={quit} />
      )}
      {results && screen === 'game' && (
        <GameOver stats={results} mods={mods} onRestart={franchise ? () => { setScreen('franchise'); setResults(null); } : restart} onQuit={franchise ? () => { setScreen('franchise'); setResults(null); } : quit} />
      )}

      {modal === 'mods' && screen === 'menu' && (
        <ModsModal mods={mods} onChange={changeMods} onClose={() => setModal('none')} />
      )}
      {modal === 'scores' && screen === 'menu' && <ScoresModal onClose={() => setModal('none')} />}
      {modal === 'help' && screen === 'menu' && <HelpModal onClose={() => setModal('none')} />}
      {modal === 'online' && screen === 'menu' && (
        <OnlineMenu 
          onClose={() => setModal('none')}
          serverUrl={window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.hostname}:8080`}
          defaultTeam={teams.teamId}
          onStartGame={(isHost, gameMode, myTeam, oppTeam) => {
            setOnlineRole(isHost ? 'host' : 'guest');
            setMode(gameMode);
            teamsRef.current = { teamId: myTeam, oppId: oppTeam };
            setTeams({ teamId: myTeam, oppId: oppTeam });
            setResults(null);
            setPaused(false);
            setModal('none');
            setScreen('game');
          }} 
        />
      )}
      {modal === 'teams' && screen === 'menu' && (
        <TeamPicker
          teamId={teams.teamId}
          oppId={teams.oppId}
          twoPlayer={mode === 'two2'}
          onPick={changeTeams}
          onClose={() => setModal('none')}
        />
      )}
    </div>
  );
}
