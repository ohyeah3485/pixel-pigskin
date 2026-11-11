export type ModeId = 'arcade' | 'seven7' | 'one1' | 'two2' | 'practice';
export type DrillSide = 'wr' | 'db';
export type DrillOpponent = 'ai' | 'local';
export type ActionKind = 'call_ball' | null;

export interface Mods {
  bigHead: boolean;
  moonBall: boolean;
  turbo: boolean;
  blitz: boolean;
}
export const NO_MODS: Mods = { bigHead: false, moonBall: false, turbo: false, blitz: false };

export function modsTag(m: Mods): string {
  let s = '';
  if (m.turbo) s += 'T';
  if (m.moonBall) s += 'M';
  if (m.blitz) s += 'B';
  if (m.bigHead) s += 'H';
  return s;
}

export interface ModeCfg {
  id: ModeId;
  key: string;
  name: string;
  tag: string;
  desc: string;
  wr: number;
  db: number;
  dl: number;
  canScramble: boolean;
  clocked: boolean;
  halfLen: number;
  cpuSim: boolean;
  conv: 'kick' | 'play' | 'none';
  tdPoints: number;
  drives: number;
  practice: boolean;
  specialTeams: boolean;
  drill: boolean;
  reps: number;
  color: string;
}

export const MODES: Record<ModeId, ModeCfg> = {
  arcade: {
    id: 'arcade', key: 'arcade', name: 'SEASON GAME', tag: 'SSN',
    desc: 'Pick your franchise and go. Two halves, 4th-down calls, punts, field goals, live CPU drives.',
    wr: 5, db: 4, dl: 2, canScramble: true,
    clocked: true, halfLen: 100, cpuSim: true,
    conv: 'kick', tdPoints: 6, drives: 0, practice: false,
    specialTeams: true, drill: false, reps: 0, color: '#aaff3c',
  },
  seven7: {
    id: 'seven7', key: 'seven7', name: '7 ON 7', tag: '7V7',
    desc: 'All-pass shootout vs loaded coverage. No QB runs — read it out and rip it.',
    wr: 6, db: 6, dl: 1, canScramble: false,
    clocked: true, halfLen: 80, cpuSim: true,
    conv: 'play', tdPoints: 6, drives: 0, practice: false,
    specialTeams: false, drill: false, reps: 0, color: '#4dd8ff',
  },
  one1: {
    id: 'one1', key: 'one1', name: '1 V 1 DRILL', tag: '1V1',
    desc: 'Press-coverage island. Receiver vs defender with an AI quarterback — CPU or same-keyboard 2P.',
    wr: 1, db: 1, dl: 0, canScramble: false,
    clocked: false, halfLen: 0, cpuSim: false,
    conv: 'none', tdPoints: 6, drives: 0, practice: false,
    specialTeams: false, drill: true, reps: 8, color: '#ff9f3c',
  },
  two2: {
    id: 'two2', key: 'two2', name: '2 PLAYER', tag: '2P',
    desc: 'Same-device duel. Pick a team each and alternate offensive drives with full special teams.',
    wr: 5, db: 4, dl: 2, canScramble: true,
    clocked: false, halfLen: 0, cpuSim: false,
    conv: 'kick', tdPoints: 6, drives: 3, practice: false,
    specialTeams: true, drill: false, reps: 0, color: '#ff4dd8',
  },
  practice: {
    id: 'practice', key: 'practice', name: 'PRACTICE', tag: 'PRAC',
    desc: 'Unlimited downs vs a soft scout team. Lab your reads and routes. R resets the rep.',
    wr: 5, db: 3, dl: 1, canScramble: true,
    clocked: false, halfLen: 0, cpuSim: false,
    conv: 'none', tdPoints: 6, drives: 0, practice: true,
    specialTeams: false, drill: false, reps: 0, color: '#c5ff6b',
  },
};

export type Shell = 'man' | 'cover2' | 'cover3' | 'blitz';

export const SHELL_NAME: Record<Shell, string> = {
  man: 'MAN PRESS',
  cover2: 'COVER 2',
  cover3: 'COVER 3',
  blitz: 'ALL-OUT BLITZ',
};

export interface FinalStats {
  mode: ModeId;
  scoreUs: number;
  scoreThem: number;
  p2: [number, number];
  winner: 0 | 1 | -1 | -2;
  passYds: number;
  rushYds: number;
  completions: number;
  attempts: number;
  tds: number;
  ints: number;
  catches: number;
  pancakes: number;
  jukes: number;
  longest: number;
  sacks: number;
  drill: boolean;
  drillSide: DrillSide;
  reps: number;
  wins: number;
  breakups: number;
  twoP: boolean;
  teamId: string;
  oppId: string;
}
