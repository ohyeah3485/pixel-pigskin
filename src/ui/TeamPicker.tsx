import { useMemo, useState } from 'react';
import { Shield, Swords, X, Shuffle, Star } from 'lucide-react';
import { TEAMS, Team, getTeam, overall, stars, inkOn } from '../game/teams';
import { audio } from '../game/audio';

interface Props {
  teamId: string;
  oppId: string | null;        // null = random
  onPick: (teamId: string, oppId: string | null) => void;
  onClose: () => void;
  twoPlayer: boolean;
}

function Crest({ t, size = 34 }: { t: Team; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center border-2 border-[#04140b]"
      style={{ width: size, height: size, background: t.c1, boxShadow: `inset 0 -4px 0 ${t.c2}` }}
    >
      <span className="font-pixel leading-none" style={{ fontSize: size * 0.26, color: inkOn(t.c1) }}>
        {t.abbr}
      </span>
    </div>
  );
}

function Bar({ label, v, col }: { label: string; v: number; col: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-pixel w-7 text-[7px] text-[#7aa383]">{label}</span>
      <div className="h-2.5 flex-1 border border-[#04140b] bg-[#10261a]">
        <div className="h-full" style={{ width: `${((v - 50) / 50) * 100}%`, background: col }} />
      </div>
      <span className="font-pixel w-5 text-right text-[7px] text-[#eaffea]">{v}</span>
    </div>
  );
}

export function TeamPicker({ teamId, oppId, onPick, onClose, twoPlayer }: Props) {
  const [sel, setSel] = useState(teamId);
  const [opp, setOpp] = useState<string | null>(oppId);
  const [tab, setTab] = useState<'you' | 'opp'>('you');
  const team = getTeam(sel);
  const oppTeam = opp ? getTeam(opp) : null;

  const sorted = useMemo(() => [...TEAMS].sort((a, b) => overall(b) - overall(a)), []);
  const active = tab === 'you' ? sel : opp;

  const choose = (id: string) => {
    audio.ensure();
    audio.uiClick();
    if (tab === 'you') setSel(id);
    else setOpp(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020a05]/85 p-3 backdrop-blur-[2px]" onClick={onClose}>
      <div className="pix-panel pop-in flex max-h-[94vh] w-full max-w-[900px] flex-col bg-[#07220f] p-4" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-[13px] text-[#aaff3c]">SELECT TEAM</h2>
          <button onClick={() => { audio.uiClick(); onClose(); }} className="pix-btn flex h-8 w-8 items-center justify-center bg-[#3d1120] text-[#ff8b9b]">
            <X size={14} />
          </button>
        </div>

        {/* tabs */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => { audio.uiClick(); setTab('you'); }}
            className={`pix-btn flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-[8px] ${tab === 'you' ? 'bg-[#1d5c33] text-[#b6f5c9]' : 'bg-[#082011] text-[#6d9a76]'}`}
          >
            <Shield size={13} /> {twoPlayer ? 'PLAYER 1' : 'YOUR TEAM'}: {team.abbr}
          </button>
          <button
            onClick={() => { audio.uiClick(); setTab('opp'); }}
            className={`pix-btn flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-[8px] ${tab === 'opp' ? 'bg-[#3d1120] text-[#ff8b9b]' : 'bg-[#082011] text-[#6d9a76]'}`}
          >
            <Swords size={13} /> {twoPlayer ? 'PLAYER 2' : 'OPPONENT'}: {oppTeam ? oppTeam.abbr : 'RANDOM'}
          </button>
        </div>

        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[1fr_230px]">
          {/* list */}
          <div className="score-scroll min-h-0 overflow-y-auto border-3 border-[#123a1e] bg-[#05160b] p-1.5" style={{ borderWidth: 3 }}>
            {tab === 'opp' && (
              <button
                onClick={() => { audio.uiClick(); setOpp(null); }}
                className={`mb-1.5 flex w-full items-center gap-2 border-2 p-2 text-left ${opp === null ? 'border-[#ffd94d] bg-[#2a2109]' : 'border-[#123a1e] bg-[#071b0e]'}`}
              >
                <Shuffle size={16} className="text-[#ffd94d]" />
                <span className="font-pixel text-[8px] text-[#ffd94d]">RANDOM OPPONENT</span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
              {sorted.map((t) => {
                const on = active === t.id;
                const ovr = overall(t);
                return (
                  <button
                    key={t.id}
                    onClick={() => choose(t.id)}
                    className="mode-card flex items-center gap-2 border-2 p-1.5 text-left"
                    style={{ borderColor: on ? t.c1 : '#123a1e', background: on ? `${t.c1}33` : '#071b0e' }}
                  >
                    <Crest t={t} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-semibold leading-tight text-[#dff2e2]">{t.name}</div>
                      <div className="font-pixel text-[6px] text-[#7aa383]">{t.city}</div>
                    </div>
                    <span className="font-pixel text-[9px]" style={{ color: ovr >= 85 ? '#aaff3c' : ovr >= 75 ? '#ffd94d' : '#ff9f3c' }}>
                      {ovr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* detail */}
          <div className="flex flex-col gap-3">
            {[{ t: team, lbl: twoPlayer ? 'PLAYER 1' : 'YOU', col: '#aaff3c' },
              { t: oppTeam, lbl: twoPlayer ? 'PLAYER 2' : 'OPPONENT', col: '#ff8b9b' }].map((row, i) => (
              <div key={i} className="border-3 border-[#123a1e] bg-[#05160b] p-2.5" style={{ borderWidth: 3 }}>
                <div className="font-pixel text-[7px]" style={{ color: row.col }}>{row.lbl}</div>
                {row.t ? (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <Crest t={row.t} size={34} />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold leading-tight text-[#eaffea]">{row.t.name}</div>
                        <div className="font-pixel text-[6px] text-[#7aa383]">{row.t.conf} {row.t.div}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, k) => (
                        <Star key={k} size={11} className={k < stars(overall(row.t!)) ? 'text-[#ffd94d]' : 'text-[#1d3b26]'} fill={k < stars(overall(row.t!)) ? '#ffd94d' : 'none'} />
                      ))}
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      <Bar label="OFF" v={row.t.off} col="#aaff3c" />
                      <Bar label="DEF" v={row.t.def} col="#ff6b6b" />
                    </div>
                  </>
                ) : (
                  <div className="font-pixel mt-3 flex items-center gap-2 text-[8px] text-[#7aa383]">
                    <Shuffle size={13} /> RANDOM
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={() => { audio.ensure(); audio.uiClick(); onPick(sel, opp); }}
              className="pix-btn mt-auto w-full px-4 py-4 text-[11px]"
              style={{ background: team.c1, color: inkOn(team.c1) }}
            >
              CONFIRM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
