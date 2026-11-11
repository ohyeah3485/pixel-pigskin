export interface ScoreEntry {
  s: number;   // score
  i: string;   // initials
  m: string;   // mod tag
  d: number;   // timestamp
}

const KEY = 'pixel-pigskin.scores.v1';
export const MAX_ENTRIES = 5;

type Table = Record<string, ScoreEntry[]>;

export function loadTable(): Table {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const t = JSON.parse(raw);
    return typeof t === 'object' && t ? t : {};
  } catch {
    return {};
  }
}

function saveTable(t: Table) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch { /* storage unavailable */ }
}

export function getScores(modeKey: string): ScoreEntry[] {
  const t = loadTable();
  return (t[modeKey] ?? []).slice(0, MAX_ENTRIES);
}

export function bestScore(modeKey: string): number {
  const s = getScores(modeKey);
  return s.length ? s[0].s : 0;
}

export function qualifies(modeKey: string, score: number): boolean {
  if (score <= 0) return false;
  const s = getScores(modeKey);
  return s.length < MAX_ENTRIES || score > s[s.length - 1].s;
}

export function submitScore(modeKey: string, entry: ScoreEntry): ScoreEntry[] {
  const t = loadTable();
  const list = [...(t[modeKey] ?? []), entry]
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_ENTRIES);
  t[modeKey] = list;
  saveTable(t);
  return list;
}

export function anyScores(table: Table): boolean {
  return Object.values(table).some((l) => (l?.length ?? 0) > 0);
}
