import { useState } from 'react';
import { Trophy, ArrowRight, ChevronUp, RotateCcw, Home, Calendar, DollarSign, Award } from 'lucide-react';
import { FranchiseState, UpgradeState, UPGRADE_NAMES, upgradeCost, MAX_LEVEL, buyUpgrade, currentOpponent, playoffRoundName, saveFranchise, newSeason, deleteFranchise } from '../game/franchise';
import { getTeam, overall, inkOn, Team } from '../game/teams';
import { audio } from '../game/audio';

interface Props {
  franchise: FranchiseState;
  onChange: (f: FranchiseState) => void;
  onPlay: (oppId: string) => void;
  onQuit: () => void;
}

function Crest({ t, size = 40 }: { t: Team; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center border-2 border-[#04140b]"
      style={{ width: size, height: size, background: t.c1, boxShadow: `inset 0 -5px 0 ${t.c2}` }}
    >
      <span className="font-pixel leading-none" style={{ fontSize: size * 0.28, color: inkOn(t.c1) }}>{t.abbr}</span>
    </div>
  );
}

export function FranchiseHub({ franchise: f, onChange, onPlay, onQuit }: Props) {
  const [tab, setTab] = useState<'schedule' | 'roster' | 'upgrades' | 'history'>('schedule');
  const team = getTeam(f.teamId);
  const opp = currentOpponent(f);
  const seasonOver = f.playoffResult !== 'none' || (f.week > 12 && f.playoffRound === 0);
  const inPlayoffs = f.playoffRound > 0 && f.playoffResult === 'none';

  const handleBuy = (key: keyof UpgradeState) => {
    audio.uiClick();
    const next = buyUpgrade(f, key);
    onChange(next);
    saveFranchise(next);
  };

  const handleNewSeason = () => {
    audio.uiClick();
    const next = newSeason(f);
    onChange(next);
    saveFranchise(next);
  };

  const handleReset = () => {
    audio.uiClick();
    deleteFranchise();
    onQuit();
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1000px] flex-col px-5 py-6">
      {/* header */}
      <div className="flex items-center gap-4">
        <Crest t={team} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="font-pixel text-[18px] leading-none" style={{ color: team.c1 === '#000000' ? '#eaffea' : team.c1 }}>
            {team.city.toUpperCase()} {team.name.toUpperCase()}
          </h1>
          <div className="font-pixel mt-1.5 flex flex-wrap items-center gap-4 text-[8px] text-[#9fce9f]">
            <span className="flex items-center gap-1"><Calendar size={11} /> SEASON {f.season} — WEEK {Math.min(f.week, 12)}</span>
            <span className="flex items-center gap-1"><Trophy size={11} /> {f.wins}W - {f.losses}L</span>
            <span className="flex items-center gap-1 text-[#ffd94d]"><DollarSign size={11} /> {f.credits} CREDITS</span>
            {inPlayoffs && <span className="flex items-center gap-1 text-[#ff9f3c]"><Award size={11} /> {playoffRoundName(f.playoffRound)}</span>}
          </div>
        </div>
        <button onClick={() => { audio.uiClick(); onQuit(); }} className="pix-btn flex items-center gap-2 bg-[#3d1120] px-3 py-2 text-[8px] text-[#ff8b9b]">
          <Home size={13} /> MENU
        </button>
      </div>

      {/* tabs */}
      <div className="mt-4 flex gap-2">
        {(['schedule', 'roster', 'upgrades', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => { audio.uiClick(); setTab(t); }}
            className={`pix-btn flex-1 px-2 py-2.5 text-[8px] ${tab === t ? 'bg-[#1d5c33] text-[#b6f5c9]' : 'bg-[#082011] text-[#6d9a76]'}`}
          >
            {t === 'schedule' ? 'SCHEDULE' : t === 'roster' ? 'ROSTER' : t === 'upgrades' ? 'UPGRADES' : 'HISTORY'}
          </button>
        ))}
      </div>

      {/* content */}
      <div className="mt-3 flex-1">
        {tab === 'schedule' && (
          <div className="grid gap-2">
            {/* next game card */}
            {opp && !seasonOver && (
              <div className="pix-panel pop-in flex items-center gap-4 bg-[#07220f] p-4">
                <div className="flex-1">
                  <div className="font-pixel text-[8px] text-[#ffd94d]">
                    {inPlayoffs ? playoffRoundName(f.playoffRound) : `WEEK ${f.week}`} — NEXT GAME
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Crest t={team} size={36} />
                    <span className="font-pixel text-[11px] text-[#7aa383]">VS</span>
                    <Crest t={opp} size={36} />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold text-[#eaffea]">{opp.city} {opp.name}</div>
                      <div className="font-pixel text-[7px] text-[#7aa383]">OVR {overall(opp)}</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { audio.uiClick(); onPlay(opp.id); }}
                  className="pix-btn flex items-center gap-2 px-5 py-3.5 text-[11px]"
                  style={{ background: team.c1 === '#000000' ? '#3a3a3a' : team.c1, color: inkOn(team.c1) }}
                >
                  PLAY <ArrowRight size={14} />
                </button>
              </div>
            )}

            {seasonOver && (
              <div className="pix-panel pop-in bg-[#07220f] p-5 text-center">
                <div className="font-pixel text-[14px]" style={{ color: f.playoffResult === 'won' ? '#ffd94d' : '#ff8b9b' }}>
                  {f.playoffResult === 'won' ? '🏆 CHAMPIONS! 🏆' : 'SEASON OVER'}
                </div>
                <div className="font-pixel mt-2 text-[10px] text-[#eaffea]">
                  FINAL RECORD: {f.wins}W - {f.losses}L
                  {f.playoffResult === 'won' && ` — ${playoffRoundName(4)} WINNERS`}
                </div>
                <div className="font-pixel mt-1 text-[9px] text-[#ffd94d]">CREDITS EARNED: {f.credits}</div>
                <button onClick={handleNewSeason} className="pix-btn mt-4 flex items-center justify-center gap-2 bg-[#1d5c33] px-5 py-3 text-[10px] text-[#b6f5c9]">
                  <RotateCcw size={13} /> START SEASON {f.season + 1}
                </button>
              </div>
            )}

            {/* schedule list */}
            <div className="score-scroll max-h-[340px] overflow-y-auto border-3 border-[#123a1e] bg-[#05160b]" style={{ borderWidth: 3 }}>
              {f.schedule.map((g, i) => {
                const gt = getTeam(g.oppId);
                const current = i === f.week - 1 && g.result === 'pending';
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 border-b border-[#0c2a15] px-3 py-2 ${current ? 'bg-[#0d2a14]' : ''}`}
                  >
                    <span className="font-pixel w-8 text-[8px] text-[#5f8a66]">W{i + 1}</span>
                    <Crest t={gt} size={22} />
                    <span className="flex-1 truncate text-[12px] text-[#c9dec9]">{gt.name}</span>
                    <span className="font-pixel text-[7px] text-[#7aa383]">OVR {overall(gt)}</span>
                    {g.result === 'win' && (
                      <span className="font-pixel text-[9px] text-[#aaff3c]">W {g.scoreUs}-{g.scoreThem}</span>
                    )}
                    {g.result === 'loss' && (
                      <span className="font-pixel text-[9px] text-[#ff6b6b]">L {g.scoreUs}-{g.scoreThem}</span>
                    )}
                    {g.result === 'pending' && current && (
                      <span className="font-pixel blink-hard text-[8px] text-[#ffd94d]">NEXT</span>
                    )}
                    {g.result === 'pending' && !current && (
                      <span className="font-pixel text-[8px] text-[#3c5244]">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'roster' && (
          <div className="border-3 border-[#123a1e] bg-[#05160b]" style={{ borderWidth: 3 }}>
            <div className="font-pixel border-b border-[#0c2a15] px-3 py-2 text-[8px] text-[#7aa383]">
              {f.roster?.length ?? 0} PLAYERS  —  SEASON {f.season}
            </div>
            <div className="score-scroll max-h-[380px] overflow-y-auto">
              {(f.roster ?? []).map((p, i) => {
                const rCol = p.rating >= 85 ? '#aaff3c' : p.rating >= 72 ? '#ffd94d' : '#ff9f3c';
                return (
                  <div key={i} className="flex items-center gap-3 border-b border-[#0c2a15] px-3 py-2">
                    <span className="font-pixel w-8 rounded border border-[#1d3b26] px-1 py-0.5 text-center text-[7px] text-[#7aa383]">{p.pos}</span>
                    <span className="flex-1 text-[13px] font-medium text-[#eaffea]">{p.name}</span>
                    <span className="font-pixel text-[9px]" style={{ color: rCol }}>{p.rating}</span>
                    <span className="font-pixel text-[7px] text-[#5f8a66]">{p.salary}¢</span>
                    <span className="font-pixel text-[7px] text-[#5f8a66]">AGE {p.age}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'upgrades' && (
          <div className="grid gap-2.5">
            <div className="font-pixel flex items-center justify-between text-[9px]">
              <span className="text-[#9fce9f]">SPEND CREDITS TO IMPROVE YOUR TEAM</span>
              <span className="text-[#ffd94d]">{f.credits} AVAILABLE</span>
            </div>
            {(Object.keys(f.upgrades) as (keyof UpgradeState)[]).map(key => {
              const level = f.upgrades[key];
              const cost = level < MAX_LEVEL ? upgradeCost(level) : 0;
              const canBuy = level < MAX_LEVEL && f.credits >= cost;
              const maxed = level >= MAX_LEVEL;
              return (
                <div key={key} className="pix-panel flex items-center gap-3 bg-[#07220f] p-3">
                  <div className="flex-1">
                    <div className="font-pixel text-[9px] text-[#eaffea]">{UPGRADE_NAMES[key]}</div>
                    <div className="mt-1.5 flex gap-1">
                      {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                        <div
                          key={i}
                          className="h-3 w-6 border border-[#04140b]"
                          style={{ background: i < level ? '#aaff3c' : '#10261a' }}
                        />
                      ))}
                    </div>
                  </div>
                  {maxed ? (
                    <span className="font-pixel text-[8px] text-[#ffd94d]">MAXED</span>
                  ) : (
                    <button
                      onClick={() => handleBuy(key)}
                      disabled={!canBuy}
                      className={`pix-btn flex items-center gap-1.5 px-3 py-2 text-[8px] ${canBuy ? 'bg-[#1d5c33] text-[#b6f5c9]' : 'bg-[#0a1a0f] text-[#3c5244]'}`}
                    >
                      <ChevronUp size={12} /> {cost} <DollarSign size={10} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'history' && (
          <div className="border-3 border-[#123a1e] bg-[#05160b] p-3" style={{ borderWidth: 3 }}>
            {f.history.length === 0 ? (
              <div className="font-pixel p-4 text-center text-[9px] text-[#5f8a66]">NO PAST SEASONS YET</div>
            ) : (
              f.history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-[#0c2a15] py-2">
                  <span className="font-pixel w-12 text-[8px] text-[#7aa383]">S{h.season}</span>
                  <span className="font-pixel flex-1 text-[9px] text-[#eaffea]">{h.wins}W - {h.losses}L</span>
                  <span className={`font-pixel text-[8px] ${h.playoff === 'CHAMPION' ? 'text-[#ffd94d]' : h.playoff === 'MISSED' ? 'text-[#ff6b6b]' : 'text-[#4dd8ff]'}`}>
                    {h.playoff}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <button onClick={handleReset} className="mt-4 self-end text-[11px] text-[#5f4444] underline hover:text-[#ff6b6b]">
        Reset franchise
      </button>
    </div>
  );
}
