export interface Team {
  id: string;
  city: string;
  name: string;
  abbr: string;
  conf: 'AFC' | 'NFC';
  div: 'East' | 'North' | 'South' | 'West';
  /** 55-99 */
  off: number;
  def: number;
  /** jersey */
  c1: string;   // primary (jersey)
  c2: string;   // secondary (helmet / trim)
  c3: string;   // accent (stripe)
}

const T = (
  id: string, city: string, name: string, abbr: string,
  conf: Team['conf'], div: Team['div'],
  off: number, def: number, c1: string, c2: string, c3: string
): Team => ({ id, city, name, abbr, conf, div, off, def, c1, c2, c3 });

export const TEAMS: Team[] = [
  // AFC East
  T('buf', 'Buffalo', 'Bills', 'BUF', 'AFC', 'East', 90, 84, '#00338D', '#C60C30', '#FFFFFF'),
  T('mia', 'Miami', 'Dolphins', 'MIA', 'AFC', 'East', 84, 78, '#008E97', '#FC4C02', '#FFFFFF'),
  T('nyj', 'New York', 'Jets', 'NYJ', 'AFC', 'East', 70, 86, '#125740', '#FFFFFF', '#000000'),
  T('ne', 'New England', 'Patriots', 'NE', 'AFC', 'East', 66, 74, '#002244', '#C60C30', '#B0B7BC'),
  // AFC North
  T('bal', 'Baltimore', 'Ravens', 'BAL', 'AFC', 'North', 92, 88, '#241773', '#000000', '#9E7C0C'),
  T('cin', 'Cincinnati', 'Bengals', 'CIN', 'AFC', 'North', 89, 74, '#FB4F14', '#000000', '#FFFFFF'),
  T('pit', 'Pittsburgh', 'Steelers', 'PIT', 'AFC', 'North', 74, 89, '#FFB612', '#101820', '#FFFFFF'),
  T('cle', 'Cleveland', 'Browns', 'CLE', 'AFC', 'North', 68, 85, '#311D00', '#FF3C00', '#FFFFFF'),
  // AFC South
  T('hou', 'Houston', 'Texans', 'HOU', 'AFC', 'South', 85, 83, '#03202F', '#A71930', '#FFFFFF'),
  T('jax', 'Jacksonville', 'Jaguars', 'JAX', 'AFC', 'South', 76, 70, '#006778', '#101820', '#D7A22A'),
  T('ind', 'Indianapolis', 'Colts', 'IND', 'AFC', 'South', 75, 73, '#002C5F', '#FFFFFF', '#A2AAAD'),
  T('ten', 'Tennessee', 'Titans', 'TEN', 'AFC', 'South', 65, 72, '#0C2340', '#4B92DB', '#C8102E'),
  // AFC West
  T('kc', 'Kansas City', 'Chiefs', 'KC', 'AFC', 'West', 93, 86, '#E31837', '#FFB81C', '#FFFFFF'),
  T('lac', 'Los Angeles', 'Chargers', 'LAC', 'AFC', 'West', 82, 80, '#0080C6', '#FFC20E', '#FFFFFF'),
  T('den', 'Denver', 'Broncos', 'DEN', 'AFC', 'West', 73, 82, '#FB4F14', '#002244', '#FFFFFF'),
  T('lv', 'Las Vegas', 'Raiders', 'LV', 'AFC', 'West', 71, 69, '#000000', '#A5ACAF', '#FFFFFF'),
  // NFC East
  T('phi', 'Philadelphia', 'Eagles', 'PHI', 'NFC', 'East', 94, 87, '#004C54', '#A5ACAF', '#000000'),
  T('dal', 'Dallas', 'Cowboys', 'DAL', 'NFC', 'East', 83, 76, '#041E42', '#869397', '#FFFFFF'),
  T('was', 'Washington', 'Commanders', 'WAS', 'NFC', 'East', 81, 72, '#5A1414', '#FFB612', '#FFFFFF'),
  T('nyg', 'New York', 'Giants', 'NYG', 'NFC', 'East', 64, 71, '#0B2265', '#A71930', '#A5ACAF'),
  // NFC North
  T('det', 'Detroit', 'Lions', 'DET', 'NFC', 'North', 95, 79, '#0076B6', '#B0B7BC', '#FFFFFF'),
  T('gb', 'Green Bay', 'Packers', 'GB', 'NFC', 'North', 88, 83, '#203731', '#FFB612', '#FFFFFF'),
  T('min', 'Minnesota', 'Vikings', 'MIN', 'NFC', 'North', 84, 85, '#4F2683', '#FFC62F', '#FFFFFF'),
  T('chi', 'Chicago', 'Bears', 'CHI', 'NFC', 'North', 72, 81, '#0B162A', '#C83803', '#FFFFFF'),
  // NFC South
  T('tb', 'Tampa Bay', 'Buccaneers', 'TB', 'NFC', 'South', 83, 74, '#D50A0A', '#34302B', '#FF7900'),
  T('atl', 'Atlanta', 'Falcons', 'ATL', 'NFC', 'South', 77, 70, '#A71930', '#000000', '#A5ACAF'),
  T('no', 'New Orleans', 'Saints', 'NO', 'NFC', 'South', 70, 75, '#D3BC8D', '#101820', '#FFFFFF'),
  T('car', 'Carolina', 'Panthers', 'CAR', 'NFC', 'South', 62, 65, '#0085CA', '#101820', '#BFC0BF'),
  // NFC West
  T('sf', 'San Francisco', '49ers', 'SF', 'NFC', 'West', 91, 85, '#AA0000', '#B3995D', '#FFFFFF'),
  T('lar', 'Los Angeles', 'Rams', 'LAR', 'NFC', 'West', 87, 76, '#003594', '#FFA300', '#FFFFFF'),
  T('sea', 'Seattle', 'Seahawks', 'SEA', 'NFC', 'West', 80, 77, '#002244', '#69BE28', '#A5ACAF'),
  T('ari', 'Arizona', 'Cardinals', 'ARI', 'NFC', 'West', 74, 68, '#97233F', '#000000', '#FFB612'),
];

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

export function getTeam(id: string): Team {
  return TEAM_BY_ID[id] ?? TEAMS[0];
}

export function overall(t: Team): number {
  return Math.round((t.off + t.def) / 2);
}

/** 1-5 star display rating */
export function stars(v: number): number {
  return Math.max(1, Math.min(5, Math.round((v - 55) / 9)));
}

export function randomOpponent(exclude: string): Team {
  const pool = TEAMS.filter((t) => t.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** readable text color on a given jersey */
export function inkOn(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#07140c' : '#ffffff';
}
