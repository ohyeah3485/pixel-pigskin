import { useCallback, useEffect, useState } from 'react';
import {
  Trophy, Users, Swords, UsersRound, Dumbbell, Zap, Medal, CircleHelp, Crown,
  Keyboard, Mouse, ChevronRight, Shield, Hand,
} from 'lucide-react';
import { MODES, ModeId, Mods, modsTag, DrillSide } from '../game/types';
import { bestScore } from '../game/highscores';
import { getTeam, overall, inkOn } from '../game/teams';
import { audio } from '../game/audio';

interface Props {
  onPlay: (mode: ModeId, side: DrillSide, twoPlayer: boolean) => void;
  onFranchise: (teamId: string) => void;
  onOpenOnline: () => void;
  onOpenMods: () => void;
  onOpenScores: () => void;
  onOpenHelp: () => void;
  onOpenTeams: () => void;
  mods: Mods;
  blockKeys: boolean;
  teamId: string;
  oppId: string | null;
  hasSave: boolean;
}

const MODE_ICON: Record<ModeId, typeof Trophy> = {
  arcade: Trophy,
  seven7: Users,
  one1: Swords,
  two2: UsersRound,
  practice: Dumbbell,
};

const ORDER: ModeId[] = ['arcade', 'seven7', 'one1', 'two2', 'practice'];

const FEATURES: Record<ModeId, string[]> = {
  arcade: ['All 32 pro franchises', '4th down: go / punt / FG', 'Ratings drive the CPU', 'Coverage shells + blitzes'],
  seven7: ['Six receivers, loaded coverage', 'No QB runs allowed', '1 & 2 point conversion plays', 'Pure timing + reads'],
  one1: ['Pick your side each game', 'AI quarterback throws live', 'Dive tackles with real whiffs', '8 reps, best score wins'],
  two2: ['Alternating offensive drives', 'Pick a franchise each', 'Full special teams', 'Winner banner + rematch'],
  practice: ['Unlimited downs', 'Soft scout-team coverage', 'R resets the rep', 'No pressure, all reps'],
};

export function MainMenu({ onPlay, onFranchise, onOpenOnline, onOpenMods, onOpenScores, onOpenHelp, onOpenTeams, mods, blockKeys, teamId, oppId, hasSave }: Props) {
  void hasSave; // used below
  const [sel, setSel] = useState(0);
  const [side, setSide] = useState<DrillSide>('wr');
  const [vsLocal, setVsLocal] = useState(false);
  const tag = modsTag(mods);
  const myTeam = getTeam(teamId);
  const foeTeam = oppId ? getTeam(oppId) : null;
  const mode = MODES[ORDER[sel]];
  const isDrill = mode.drill;

  const click = (fn: () => void) => () => { audio.ensure(); audio.uiClick(); fn(); };

  const launch = useCallback(() => {
    audio.ensure();
    audio.uiClick();
    onPlay(ORDER[sel], side, vsLocal);
  }, [onPlay, sel, side, vsLocal]);

  useEffect(() => {
    if (blockKeys) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowdown' || k === 's') { e.preventDefault(); setSel((s) => (s + 1) % ORDER.length); audio.uiHover(); }
      else if (k === 'arrowup' || k === 'w') { e.preventDefault(); setSel((s) => (s - 1 + ORDER.length) % ORDER.length); audio.uiHover(); }
      else if ((k === 'arrowleft' || k === 'a') && MODES[ORDER[sel]].drill) { setSide('wr'); audio.uiHover(); }
      else if ((k === 'arrowright' || k === 'd') && MODES[ORDER[sel]].drill) { setSide('db'); audio.uiHover(); }
      else if (k === 'enter' || k === ' ') { e.preventDefault(); launch(); }
      else if (k === 'm') onOpenMods();
      else if (k === 'r') onOpenScores();
      else if (k === 'h' || k === '?') onOpenHelp();
      else if (k === 't') onOpenTeams();
      else if (/^[1-5]$/.test(k)) { setSel(parseInt(k, 10) - 1); audio.uiHover(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blockKeys, launch, onOpenHelp, onOpenMods, onOpenScores, onOpenTeams, sel]);

  return (
    <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[1120px] flex-col px-6 py-5">
      {/* ticker */}
      <div className="pointer-events-none absolute left-0 top-0 w-full overflow-hidden border-b-2 border-[#3d0f18] bg-[#21060c] py-1.5">
        <div className="marquee-x flex w-max whitespace-nowrap">
          {[0, 1].map((i) => (
            <span key={i} className="font-pixel px-4 text-[9px] leading-none text-[#ff5d75]">
              PIXEL PIGSKIN '95 /// MOUSE-AIMED PASSING /// COVER 2, COVER 3, MAN PRESS, ALL-OUT BLITZ /// 4TH
              DOWN CALLS /// 1V1 DRILL: PLAY RECEIVER OR DEFENDER /// INSERT COIN ///&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* logo row */}
      <div className="mt-10 flex items-end justify-between gap-6">
        <div className="logo-bob">
          <div className="relative">
            <h1
              className="font-pixel text-[40px] leading-none tracking-tight text-[#aaff3c]"
              style={{ textShadow: '0 5px 0 #06250f, 0 0 30px rgba(170,255,60,.45)' }}
            >
              PIXEL PIGSKIN
            </h1>
            <span className="font-pixel absolute -right-9 -top-4 rotate-12 border-2 border-[#04140b] bg-[#ff9f3c] px-1.5 py-1 text-[11px] text-[#241100] shadow-[0_3px_0_#04140b]">
              '95
            </span>
          </div>
          <p className="font-pixel mt-3 text-[8px] tracking-wide text-[#9fce9f]">
            ARCADE FOOTBALL * KEYBOARD + MOUSE EDITION
          </p>
        </div>
        <div className="hidden items-center gap-4 pb-2 md:flex">
          <div className="flex items-center gap-2 border-2 border-[#1d5c33] bg-[#07220f] px-3 py-2">
            <Keyboard size={15} className="text-[#aaff3c]" />
            <span className="font-pixel text-[7px] leading-relaxed text-[#9fce9f]">
              ARROWS / WASD
              <br />
              ENTER START
            </span>
          </div>
          <div className="flex items-center gap-2 border-2 border-[#1d5c33] bg-[#07220f] px-3 py-2">
            <Mouse size={15} className="text-[#4dd8ff]" />
            <span className="font-pixel text-[7px] leading-relaxed text-[#9fce9f]">
              AIM WITH MOUSE
              <br />
              CLICK TO THROW
            </span>
          </div>
          {tag && (
            <div className="font-pixel flex items-center gap-1.5 border-2 border-[#aaff3c] bg-[#0a2a16] px-2.5 py-2 text-[8px] text-[#aaff3c]">
              <Zap size={11} /> {tag.split('').join(' ')}
            </div>
          )}
        </div>
      </div>

      {/* main two-column */}
      <div className="mt-6 grid flex-1 grid-cols-1 gap-5 md:grid-cols-[360px_1fr]">
        {/* mode list */}
        <div className="flex flex-col gap-2">
          {ORDER.map((id, i) => {
            const m = MODES[id];
            const Icon = MODE_ICON[id];
            const active = i === sel;
            const best = bestScore(m.key);
            return (
              <button
                key={id}
                onMouseEnter={() => { if (sel !== i) { setSel(i); audio.uiHover(); } }}
                onClick={launch}
                className={`pop-in group flex items-center gap-3 border-3 px-3 py-3 text-left transition-transform ${
                  active ? 'translate-x-1.5' : 'opacity-70'
                }`}
                style={{
                  animationDelay: `${i * 60}ms`,
                  borderWidth: 3,
                  borderColor: active ? m.color : '#123a1e',
                  background: active ? `linear-gradient(90deg, ${m.color}26, #071b0e 70%)` : '#061609',
                  boxShadow: active ? `0 4px 0 #04140b, -4px 0 0 ${m.color}` : '0 3px 0 #04140b',
                }}
              >
                <span className="font-pixel w-3 text-[9px] text-[#5f8a66]">{i + 1}</span>
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-[#04140b]"
                  style={{ background: active ? m.color : '#0d2414' }}
                >
                  <Icon size={18} color={active ? '#07140c' : '#7aa383'} strokeWidth={2.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-pixel text-[10px]" style={{ color: active ? m.color : '#7aa383' }}>
                    {m.name}
                  </div>
                  {best > 0 && !m.practice && (
                    <div className="font-pixel mt-1 flex items-center gap-1 text-[7px] text-[#ffd94d]">
                      <Crown size={9} /> BEST {best}
                    </div>
                  )}
                </div>
                {active && <ChevronRight size={16} className="blink-hard" style={{ color: m.color }} />}
              </button>
            );
          })}
        </div>

        {/* detail panel */}
        <div
          key={mode.id}
          className="pix-panel pop-in flex flex-col bg-[#07220f] p-5"
          style={{ background: `linear-gradient(150deg, ${mode.color}1f, #061609 60%)` }}
        >
          <h2 className="font-pixel text-[17px]" style={{ color: mode.color, textShadow: '0 3px 0 #04140b' }}>
            {mode.name}
          </h2>
          <p className="mt-2.5 max-w-[640px] text-[15px] leading-snug text-[#c2ddc7]">{mode.desc}</p>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {FEATURES[mode.id].map((f) => (
              <div key={f} className="flex items-baseline gap-2">
                <span className="font-pixel text-[8px] text-[#aaff3c]">+</span>
                <span className="text-[13px] leading-snug text-[#9fce9f]">{f}</span>
              </div>
            ))}
          </div>

          {/* 1v1 opponent + side picker */}
          {isDrill && (
            <div className="mt-5 border-3 border-[#ff9f3c] bg-[#1f1206] p-3" style={{ borderWidth: 3 }}>
              <div className="font-pixel text-[8px] text-[#ff9f3c]">OPPONENT</div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {([
                  { v: false, name: 'VS CPU', blurb: 'The computer plays the other side.' },
                  { v: true, name: '2 PLAYER', blurb: 'P1: WASD + F   /   P2: IJKL + P' },
                ]).map((o) => {
                  const on = vsLocal === o.v;
                  return (
                    <button
                      key={String(o.v)}
                      onClick={(ev) => { ev.stopPropagation(); audio.uiClick(); setVsLocal(o.v); }}
                      className="mode-card p-2 text-left"
                      style={{
                        border: `3px solid ${on ? '#ffd94d' : '#2b2112'}`,
                        background: on ? '#ffd94d1f' : '#120c05',
                      }}
                    >
                      <div className="font-pixel text-[9px]" style={{ color: on ? '#ffd94d' : '#7a6a4f' }}>
                        {o.name}
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-[#a9c2ae]">{o.blurb}</p>
                    </button>
                  );
                })}
              </div>
              <div className="font-pixel mt-3 text-[8px] text-[#ff9f3c]">
                {vsLocal ? 'PLAYER 1 PLAYS — ← → OR CLICK' : 'CHOOSE YOUR SIDE — ← → OR CLICK'}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                {([
                  { k: 'wr' as DrillSide, name: 'RECEIVER', icon: Hand, col: '#0fd3c3', blurb: 'Beat press, win at the top of the route, high-point the ball and take it to the house.' },
                  { k: 'db' as DrillSide, name: 'DEFENDER', icon: Shield, col: '#ff6b6b', blurb: 'Mirror his release, stay in phase, then swat it away or jump the route for the pick.' },
                ]).map((o) => {
                  const on = side === o.k;
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.k}
                      onClick={(ev) => { ev.stopPropagation(); audio.uiClick(); setSide(o.k); }}
                      className="mode-card flex flex-col gap-1.5 p-2.5 text-left"
                      style={{
                        border: `3px solid ${on ? o.col : '#2b2112'}`,
                        background: on ? `${o.col}1f` : '#120c05',
                        boxShadow: on ? `0 3px 0 #04140b` : 'none',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={15} style={{ color: on ? o.col : '#7a6a4f' }} />
                        <span className="font-pixel text-[9px]" style={{ color: on ? o.col : '#7a6a4f' }}>
                          {o.name}
                        </span>
                        {on && <span className="font-pixel blink-hard ml-auto text-[7px] text-[#ffd94d]">PICKED</span>}
                      </div>
                      <p className="text-[12px] leading-snug text-[#a9c2ae]">{o.blurb}</p>
                    </button>
                  );
                })}
              </div>
              <p className="font-pixel mt-2.5 text-[7px] leading-relaxed text-[#9a7f55]">
                AN AI QUARTERBACK THROWS LIVE EITHER WAY — YOU ONLY CONTROL YOUR GUY.
                <br />
                DB: SWAT ONLY IN THE AIR * PUSH ON THE ROUTE * TACKLE THE BALL CARRIER.
                <br />
                WR: JUKE WITHIN 0.3s OF A PUSH OR TACKLE TO BEAT IT.
              </p>
            </div>
          )}

          {!isDrill && (
            <button
              onClick={(ev) => { ev.stopPropagation(); audio.uiClick(); onOpenTeams(); }}
              className="mode-card mt-5 flex items-center gap-3 border-3 p-2.5 text-left"
              style={{ borderWidth: 3, borderColor: myTeam.c1, background: `${myTeam.c1}1f` }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#04140b]" style={{ background: myTeam.c1, boxShadow: `inset 0 -5px 0 ${myTeam.c2}` }}>
                <span className="font-pixel text-[9px]" style={{ color: inkOn(myTeam.c1) }}>{myTeam.abbr}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-pixel text-[7px] text-[#7aa383]">{MODES[ORDER[sel]].id === 'two2' ? 'P1 TEAM' : 'YOUR TEAM'} — CLICK TO CHANGE [T]</div>
                <div className="truncate text-[14px] font-bold leading-tight text-[#eaffea]">{myTeam.city} {myTeam.name}</div>
                <div className="font-pixel text-[7px]" style={{ color: '#aaff3c' }}>OVR {overall(myTeam)} · OFF {myTeam.off} · DEF {myTeam.def}</div>
              </div>
              <div className="font-pixel text-right text-[7px] text-[#ff8b9b]">
                VS
                <div className="mt-1 text-[9px] text-[#eaffea]">{foeTeam ? foeTeam.abbr : 'RND'}</div>
              </div>
            </button>
          )}

          {/* online mode */}
          <button
            onClick={(ev) => { ev.stopPropagation(); audio.uiClick(); onOpenOnline(); }}
            className="mode-card mt-4 flex w-full items-center gap-3 border-3 border-[#4dd8ff] bg-[#061a24] p-3 text-left"
            style={{ borderWidth: 3 }}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#04140b] bg-[#4dd8ff]">
              <span className="font-pixel text-[12px] text-[#061a24]">🌐</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-pixel text-[10px] text-[#4dd8ff]">ONLINE MULTIPLAYER</div>
              <div className="mt-0.5 text-[12px] leading-snug text-[#a8c2c9]">Host or join a lobby with a 4-letter code. (Requires running the local server)</div>
            </div>
          </button>

          {/* franchise mode */}
          <button
            onClick={(ev) => { ev.stopPropagation(); audio.uiClick(); onFranchise(teamId); }}
            className="mode-card mt-4 flex w-full items-center gap-3 border-3 border-[#ffd94d] bg-[#1f1a06] p-3 text-left"
            style={{ borderWidth: 3 }}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#04140b] bg-[#ffd94d]">
              <span className="font-pixel text-[12px] text-[#1a1205]">🏆</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-pixel text-[10px] text-[#ffd94d]">FRANCHISE MODE</div>
              <div className="mt-0.5 text-[12px] leading-snug text-[#c9c2a8]">Pick a team. Play a 12-game season. Win credits. Upgrade your roster. Make the playoffs.</div>
            </div>
          </button>

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
            <button
              onClick={launch}
              className="pix-btn flex items-center gap-2 px-6 py-4 text-[12px] text-[#07140c]"
              style={{ background: mode.color }}
            >
              <ChevronRight size={16} /> PRESS START
            </button>
            <button onClick={click(onOpenMods)} className="pix-btn flex items-center gap-2 bg-[#3f2d12] px-4 py-4 text-[9px] text-[#ffd94d]">
              <Zap size={14} /> MODS [M]
            </button>
            <button onClick={click(onOpenScores)} className="pix-btn flex items-center gap-2 bg-[#123a4f] px-4 py-4 text-[9px] text-[#4dd8ff]">
              <Medal size={14} /> RECORDS [R]
            </button>
            <button onClick={click(onOpenHelp)} className="pix-btn flex items-center gap-2 bg-[#1d5c33] px-4 py-4 text-[9px] text-[#b6f5c9]">
              <CircleHelp size={14} /> HOW TO [H]
            </button>
          </div>
        </div>
      </div>

      <p className="font-pixel mt-4 text-center text-[7px] text-[#5f8a66]">
        SCORES SAVED LOCALLY * BEST ON DESKTOP WITH KEYBOARD + MOUSE
      </p>
    </div>
  );
}
