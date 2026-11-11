import { Team, TEAMS, getTeam } from './teams';
import { buildRoster, RosterPlayer } from './names';

const FRAN_KEY = 'pixel-pigskin.franchise.v2';

export interface FranchiseState {
  teamId: string;
  season: number;
  week: number;
  wins: number;
  losses: number;
  credits: number;
  upgrades: UpgradeState;
  roster: RosterPlayer[];
  schedule: ScheduleGame[];
  playoffSeed: number;     // 0 = not in, 1-7
  playoffRound: number;    // 0 = regular, 1 = wild card, 2 = divisional, 3 = conf, 4 = super bowl
  playoffResult: 'none' | 'won' | 'lost';
  history: SeasonRecord[];
}

export interface ScheduleGame {
  oppId: string;
  result: 'pending' | 'win' | 'loss';
  scoreUs: number;
  scoreThem: number;
}

export interface SeasonRecord {
  season: number;
  wins: number;
  losses: number;
  playoff: string;
}

export interface UpgradeState {
  qbArm: number;       // 0-5
  wrSpeed: number;
  wrCatch: number;
  olBlock: number;
  coaching: number;     // affects CPU drive odds
}

export const UPGRADE_NAMES: Record<keyof UpgradeState, string> = {
  qbArm: 'QB ARM',
  wrSpeed: 'WR SPEED',
  wrCatch: 'WR HANDS',
  olBlock: 'O-LINE',
  coaching: 'COACHING',
};

export const UPGRADE_COST = [100, 200, 350, 550, 800];
export const MAX_LEVEL = 5;

export function upgradeCost(level: number): number {
  return UPGRADE_COST[Math.min(level, MAX_LEVEL - 1)];
}

export function freshFranchise(teamId: string): FranchiseState {
  const team = getTeam(teamId);
  return {
    teamId,
    season: 1,
    week: 1,
    wins: 0,
    losses: 0,
    credits: 150,
    upgrades: { qbArm: 0, wrSpeed: 0, wrCatch: 0, olBlock: 0, coaching: 0 },
    roster: buildRoster(team.off, team.def),
    schedule: buildSchedule(teamId),
    playoffSeed: 0,
    playoffRound: 0,
    playoffResult: 'none',
    history: [],
  };
}

export function buildSchedule(teamId: string): ScheduleGame[] {
  const pool = TEAMS.filter(t => t.id !== teamId);
  const games: ScheduleGame[] = [];
  // 12 game season, randomized opponents with a mix of good and bad teams
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (let i = 0; i < 12; i++) {
    games.push({ oppId: shuffled[i % shuffled.length].id, result: 'pending', scoreUs: 0, scoreThem: 0 });
  }
  return games;
}

export function creditsForWin(scoreDiff: number): number {
  const base = 150;
  const bonus = Math.min(200, Math.max(0, scoreDiff) * 8);
  return base + bonus;
}

export function creditsForLoss(): number {
  return 50;
}

export function canMakePlayoffs(f: FranchiseState): boolean {
  return f.wins >= 7; // need winning record to make playoffs
}

export function advanceWeek(f: FranchiseState): FranchiseState {
  const next = { ...f, week: f.week + 1 };
  if (next.week > 12 && next.playoffRound === 0) {
    // end of regular season
    if (canMakePlayoffs(next)) {
      next.playoffSeed = Math.max(1, 8 - next.wins);
      next.playoffRound = 1;
    } else {
      next.playoffResult = 'lost';
      finishSeason(next);
    }
  }
  return next;
}

export function advancePlayoff(f: FranchiseState, won: boolean): FranchiseState {
  const next = { ...f };
  if (!won) {
    next.playoffResult = 'lost';
    finishSeason(next);
    return next;
  }
  next.credits += 250; // playoff win bonus
  if (next.playoffRound >= 4) {
    next.playoffResult = 'won';
    next.credits += 500; // championship bonus
    finishSeason(next);
    return next;
  }
  next.playoffRound++;
  return next;
}

function finishSeason(f: FranchiseState) {
  f.history.push({
    season: f.season,
    wins: f.wins,
    losses: f.losses,
    playoff: f.playoffResult === 'won' ? 'CHAMPION' : f.playoffRound > 0 ? `ROUND ${f.playoffRound}` : 'MISSED',
  });
}

export function newSeason(f: FranchiseState): FranchiseState {
  const team = getTeam(f.teamId);
  // Apply upgrades to effective ratings for roster generation
  const ups = f.upgrades;
  const effOff = Math.min(99, team.off + ups.wrSpeed * 2 + ups.qbArm * 2);
  const effDef = Math.min(99, team.def + ups.olBlock * 2 + ups.coaching * 2);
  return {
    ...f,
    season: f.season + 1,
    week: 1,
    wins: 0,
    losses: 0,
    roster: buildRoster(effOff, effDef),
    schedule: buildSchedule(f.teamId),
    playoffSeed: 0,
    playoffRound: 0,
    playoffResult: 'none',
  };
}

/** Speed multiplier bonuses from franchise upgrades */
export function upgradeMultipliers(f: FranchiseState | null) {
  if (!f) return { offSpeed: 1, wrCatch: 0, olShed: 0, cpuReduction: 0 };
  const u = f.upgrades;
  return {
    offSpeed: 1 + (u.qbArm + u.wrSpeed) * 0.015,
    wrCatch: u.wrCatch * 0.15,
    olShed: u.olBlock * 0.15,
    cpuReduction: u.coaching * 0.03,
  };
}

export function buyUpgrade(f: FranchiseState, key: keyof UpgradeState): FranchiseState {
  const level = f.upgrades[key];
  if (level >= MAX_LEVEL) return f;
  const cost = upgradeCost(level);
  if (f.credits < cost) return f;
  return {
    ...f,
    credits: f.credits - cost,
    upgrades: { ...f.upgrades, [key]: level + 1 },
  };
}

export function saveFranchise(f: FranchiseState) {
  try { localStorage.setItem(FRAN_KEY, JSON.stringify(f)); } catch {}
}

export function loadFranchise(): FranchiseState | null {
  try {
    const raw = localStorage.getItem(FRAN_KEY);
    if (!raw) return null;
    const f = JSON.parse(raw);
    if (f && typeof f.teamId === 'string') return f as FranchiseState;
  } catch {}
  return null;
}

export function deleteFranchise() {
  try { localStorage.removeItem(FRAN_KEY); } catch {}
}

export function currentOpponent(f: FranchiseState): Team | null {
  if (f.playoffRound > 0) {
    // playoff opponent scales with round
    const sorted = [...TEAMS].filter(t => t.id !== f.teamId).sort((a, b) => (b.off + b.def) - (a.off + a.def));
    const idx = Math.min(f.playoffRound - 1, sorted.length - 1);
    return sorted[idx];
  }
  const game = f.schedule[f.week - 1];
  if (!game || game.result !== 'pending') return null;
  return getTeam(game.oppId);
}

export function playoffRoundName(round: number): string {
  return ['', 'WILD CARD', 'DIVISIONAL', 'CONFERENCE', 'CHAMPIONSHIP'][round] ?? '';
}

/** Apply franchise upgrades to engine speed/rating params */
export function applyUpgrades(upgrades: UpgradeState) {
  return {
    qbSpeedBonus: 1 + upgrades.qbArm * 0.03,
    wrSpeedBonus: 1 + upgrades.wrSpeed * 0.025,
    catchRadiusBonus: upgrades.wrCatch * 0.12,
    olShedBonus: upgrades.olBlock * 0.15,
    cpuDriveReduction: upgrades.coaching * 0.025,
  };
}
