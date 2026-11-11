import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Home, Crown, ChevronUp, ChevronDown, Check, Swords } from 'lucide-react';
import { FinalStats, MODES, modsTag, Mods } from '../game/types';
import { qualifies, submitScore } from '../game/highscores';
import { audio } from '../game/audio';

interface Props {
  stats: FinalStats;
  mods: Mods;
  onRestart: () => void;
  onQuit: () => void;
}

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function GameOver({ stats, mods, onRestart, onQuit }: Props) {
  const mode = MODES[stats.mode];
  const is2p = stats.mode === 'two2';
  const score = is2p ? Math.max(stats.p2[0], stats.p2[1]) : stats.scoreUs;
  const canSubmit = !mode.practice && qualifies(mode.key, score);

  const [initials, setInitials] = useState(['A', 'B', 'C']);
  const [slot, setSlot] = useState(0);
  const [saved, setSaved] = useState(false);
  const popRef = useRef(false);

  useEffect(() => {
    if (!popRef.current) {
      popRef.current = true;
      audio.cheer(is2p || stats.scoreUs >= stats.scoreThem ? 1.2 : 0.4);
    }
  }, [is2p, stats.scoreUs, stats.scoreThem]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canSubmit || saved) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRestart(); }
        return;
      }
      if (e.key === 'ArrowUp') bump(1);
      else if (e.key === 'ArrowDown') bump(-1);
      else if (e.key === 'ArrowRight') setSlot((s) => Math.min(2, s + 1));
      else if (e.key === 'ArrowLeft') setSlot((s) => Math.max(0, s - 1));
      else if (e.key === 'Enter') { e.preventDefault(); save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const winnerText = useMemo(() => {
    if (stats.drill) {
      if (stats.scoreUs === stats.scoreThem) return 'DEAD HEAT';
      if (stats.twoP) return stats.scoreUs > stats.scoreThem ? 'P1 WINS!' : 'P2 WINS!';
      return stats.scoreUs > stats.scoreThem ? 'DRILL WON!' : 'OUT-PLAYED...';
    }
    if (is2p) {
      if (stats.winner === -1) return 'TIE GAME';
      return stats.winner === 0 ? 'P1 WINS!' : 'P2 WINS!';
    }
    if (stats.scoreUs > stats.scoreThem) return 'YOU WIN!';
    if (stats.scoreUs === stats.scoreThem) return 'DEAD HEAT';
    return 'SO CLOSE...';
  }, [is2p, stats]);

  const won = ['YOU WIN!', 'P1 WINS!', 'P2 WINS!', 'DRILL WON!'].includes(winnerText);
  const winColor = won ? '#aaff3c' : winnerText === 'DEAD HEAT' ? '#ffd94d' : '#ff6b6b';

  const bump = (dir: number) => {
    const cur = ALPHA.indexOf(initials[slot]);
    const next = (cur + dir + ALPHA.length) % ALPHA.length;
    const copy = [...initials];
    copy[slot] = ALPHA[next];
    setInitials(copy);
    audio.uiHover();
  };

  const save = () => {
    submitScore(mode.key, { s: score, i: initials.join(''), m: modsTag(mods), d: Date.now() });
    setSaved(true);
    audio.ding();
  };

  const row = (label: string, val: string | number, accent = false) => (
    <div className="flex items-baseline justify-between border-b border-[#0c2a15] py-1.5" key={label}>
      <span className="font-pixel text-[8px] text-[#7aa383]">{label}</span>
      <span className={`font-pixel text-[11px] ${accent ? 'text-[#ffd94d]' : 'text-[#eaffea]'}`}>{val}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#020a05]/75 p-4 backdrop-blur-[2px]">
      <div className="pix-panel pop-in w-full max-w-[480px] bg-[#07220f] p-5">
        <div className="text-center">
          <div className="font-pixel text-[8px] tracking-wide text-[#7aa383]">
            {mode.name}
            {stats.drill
              ? stats.twoP
                ? ` * P1 = ${stats.drillSide === 'wr' ? 'WR' : 'DB'}`
                : ` * AS ${stats.drillSide === 'wr' ? 'RECEIVER' : 'DEFENDER'}`
              : ''}{' '}
            * FINAL
          </div>
          <h2 className="font-pixel mt-2 text-[22px] leading-none" style={{ color: winColor, textShadow: '0 3px 0 #04140b' }}>
            {winnerText}
          </h2>
          {stats.drill && stats.twoP ? (
            <div className="mt-3 flex items-center justify-center gap-4">
              <span className={`font-pixel text-[15px] ${stats.scoreUs > stats.scoreThem ? 'text-[#ffd94d]' : 'text-[#7aa383]'}`}>P1 {stats.scoreUs}</span>
              <Swords size={15} className="text-[#5f8a66]" />
              <span className={`font-pixel text-[15px] ${stats.scoreThem > stats.scoreUs ? 'text-[#b06bff]' : 'text-[#7aa383]'}`}>P2 {stats.scoreThem}</span>
            </div>
          ) : is2p ? (
            <div className="mt-3 flex items-center justify-center gap-4">
              <span className={`font-pixel text-[15px] ${stats.winner === 0 ? 'text-[#0fd3c3]' : 'text-[#7aa383]'}`}>P1 {stats.p2[0]}</span>
              <Swords size={15} className="text-[#5f8a66]" />
              <span className={`font-pixel text-[15px] ${stats.winner === 1 ? 'text-[#b06bff]' : 'text-[#7aa383]'}`}>P2 {stats.p2[1]}</span>
            </div>
          ) : (
            <div className="font-pixel mt-3 text-[15px] text-[#eaffea]">
              {stats.scoreUs} <span className="text-[#5f8a66]">-</span> {stats.scoreThem}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-5">
          {stats.drill ? (
            <>
              {row('REPS RUN', stats.reps)}
              {row('TARGETS', stats.attempts)}
              {row('CATCHES', stats.catches, stats.drillSide === 'wr')}
              {row('BREAKUPS', stats.breakups, stats.drillSide === 'db')}
              {row('INTERCEPTIONS', stats.ints, stats.drillSide === 'db')}
              {row('TOUCHDOWNS', stats.tds)}
              {row('LONGEST PLAY', stats.longest)}
              {row('YOUR POINTS', stats.scoreUs, true)}
            </>
          ) : (
            <>
              {row('PASS YDS', Math.max(0, stats.passYds))}
              {row('RUSH YDS', stats.rushYds)}
              {row('COMPLETIONS', `${stats.completions}/${stats.attempts}`)}
              {row('TOUCHDOWNS', stats.tds, true)}
              {row('INTERCEPTED', stats.ints)}
              {row('LONGEST PLAY', stats.longest)}
              {row('PANCAKES', stats.pancakes)}
              {row('JUKES', stats.jukes)}
            </>
          )}
        </div>

        {canSubmit && !saved && (
          <div className="mt-4 border-3 border-[#ffd94d] bg-[#241b06] p-3" style={{ borderWidth: 3 }}>
            <div className="font-pixel flex items-center justify-center gap-1.5 text-[8px] text-[#ffd94d]">
              <Crown size={11} /> NEW LOCAL RECORD — ENTER INITIALS
            </div>
            <div className="mt-2.5 flex items-center justify-center gap-3">
              {initials.map((ch, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <button
                    className="pix-btn flex h-6 w-8 items-center justify-center bg-[#123a4f] text-[#4dd8ff]"
                    onClick={() => { setSlot(i); const cur = ALPHA.indexOf(initials[i]); const c = [...initials]; c[i] = ALPHA[(cur + 1) % 26]; setInitials(c); audio.uiHover(); }}
                    aria-label="Letter up"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <div
                    className="font-pixel flex h-11 w-9 items-center justify-center border-3 text-[16px]"
                    style={{ borderWidth: 3, borderColor: slot === i ? '#ffd94d' : '#1d5c33', color: slot === i ? '#ffd94d' : '#eaffea', background: '#05160b' }}
                  >
                    {ch}
                  </div>
                  <button
                    className="pix-btn flex h-6 w-8 items-center justify-center bg-[#123a4f] text-[#4dd8ff]"
                    onClick={() => { setSlot(i); const cur = ALPHA.indexOf(initials[i]); const c = [...initials]; c[i] = ALPHA[(cur + 25) % 26]; setInitials(c); audio.uiHover(); }}
                    aria-label="Letter down"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              ))}
              <button onClick={save} className="pix-btn ml-2 flex h-11 items-center gap-1.5 bg-[#1d5c33] px-3 text-[9px] text-[#b6f5c9]">
                <Check size={13} /> SAVE
              </button>
            </div>
          </div>
        )}
        {canSubmit && saved && (
          <div className="font-pixel mt-4 border-3 border-[#1d5c33] bg-[#0a2a16] p-3 text-center text-[9px] text-[#aaff3c]" style={{ borderWidth: 3 }}>
            <Crown size={11} className="mr-1 inline" /> ETCHED INTO LEGEND
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              audio.uiClick();
              const el = document.activeElement as HTMLElement | null;
              el?.blur();
              onRestart();
            }}
            className="pix-btn flex items-center justify-center gap-2 bg-[#1d5c33] px-3 py-3.5 text-[10px] text-[#b6f5c9]"
            onMouseEnter={audio.uiHover}
          >
            <RotateCcw size={14} /> {is2p ? 'REMATCH' : 'RUN IT BACK'}
          </button>
          <button
            onClick={() => { audio.uiClick(); onQuit(); }}
            onMouseEnter={audio.uiHover}
            className="pix-btn flex items-center justify-center gap-2 bg-[#3d1120] px-3 py-3.5 text-[10px] text-[#ff8b9b]"
          >
            <Home size={14} /> LOCKER ROOM
          </button>
        </div>
        <p className="font-pixel mt-3 text-center text-[7px] text-[#5f8a66]">ENTER = INSTANT REMATCH</p>
      </div>
    </div>
  );
}
