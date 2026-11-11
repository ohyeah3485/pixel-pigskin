// Player name data sourced from Retro Bowl name lists
const FIRST = [
  'Aaron','Adrian','Al','Andre','Anthony','Ant','Antwan','Brandin','Brock',
  'Byron','Calvin','Cameron','Carlos','Chad','Charles','Chris','Christian',
  'Curtis','Da\'Ron','Dalvin','Damon','Dante','Darius','DK','DeAndre',
  'DeSean','DeVante','DeVonta','Deebo','Deshaun','Devin','Devon','Devontae',
  'Diontae','Dre','Dwayne','Earl','Elijah','Eric','Ezekiel','Germain',
  'Gus','Hunter','Isaiah','Ja\'Marr','Jakobi','Jalen','James','Jamison',
  'Jarvis','Jaylen','JK','Joe','John','Josh','Justin','KC','Keenan',
  'Kendall','Kenneth','Kenny','Kirk','Kyle','Latavius','Laviska','Leonard',
  'Lil\'Jordan','Logan','Luke','Mack','Marcus','Mark','Marlon','Marshon',
  'Martin','Matt','Michael','Miles','Mohamed','Montez','Murray','Najee',
  'Nick','Nico','Odell','Patrick','Peyton','Pharoh','Phillip','Raheem',
  'Ramon','Randy','Rashaad','Rashad','Roquan','Russ','Ryan','Samuel',
  'Scott','Stefon','Saquon','Sterling','Stevie','Taysom','Terry','Tee',
  'Tim','Todd','Tom','Tony','Torin','Travis','Trevon','Tyreek','Tyreke',
  'Tyrell','Tyler','Van','Vince','Wan','Will','Williams','Wyatt','Xavier',
  'Zack','Zay',
];

const LAST = [
  'Adams','Aiyuk','Alexander','Allen','Andrews','Amos','Barkley','Bell',
  'Brown','Burrow','Butler','Campbell','Chase','Chubb','Clark','Collins',
  'Cook','Cooper','Cousins','Davis','Davante','Diggs','Edwards','Elliott',
  'Evans','Fournette','Freeman','Golladay','Gonzalez','Goodwin','Graham',
  'Green','Gurley','Hall','Hampton','Harris','Henderson','Henry','Hill',
  'Hopkins','Howard','Hunt','Hunter','Jackson','Johnson','Jones','Jordan',
  'Kelce','Kupp','Lamb','Landry','Leonard','Lewis','Lockett','Marshall',
  'Martin','Matthews','McCaffrey','McLaurin','Miller','Mitchell','Moore',
  'Murray','Nelson','Newton','Nichols','Parker','Patterson','Pitts',
  'Robinson','Rodgers','Ross','Samuel','Sanders','Scott','Sherman',
  'Shepard','Smith','Suh','Sutton','Swift','Taylor','Thomas','Thompson',
  'Thielen','Toney','Tucker','Walker','Ward','Washington','Watson','White',
  'Williams','Wilson','Wynn','Younghoe',
];

const QB_FIRST = ['Patrick','Josh','Lamar','Joe','Justin','Dak','Matthew','Russell','Kirk','Ryan','Jalen'];
const QB_LAST = ['Mahomes','Allen','Jackson','Burrow','Herbert','Prescott','Stafford','Wilson','Cousins','Tannehill','Hurts'];
const RB_LAST = ['Henry','McCaffrey','Elliott','Barkley','Cook','Taylor','Jones','Robinson','Chubb','Hunt'];
const WR_LAST = ['Hill','Adams','Diggs','Kupp','Jefferson','Lamb','Evans','Hopkins','Brown','Chase','Kelce','Davante'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function randomName(): string {
  return `${pick(FIRST)} ${pick(LAST)}`;
}

export function randomQBName(): string {
  const i = Math.floor(Math.random() * QB_FIRST.length);
  return `${QB_FIRST[i]} ${QB_LAST[i]}`;
}

export function randomRBName(): string {
  return `${pick(FIRST)} ${pick(RB_LAST)}`;
}

export function randomWRName(): string {
  return `${pick(FIRST)} ${pick(WR_LAST)}`;
}

export interface RosterPlayer {
  name: string;
  pos: 'QB' | 'WR' | 'RB' | 'OL' | 'DL' | 'DB';
  rating: number;  // 60-99
  salary: number;  // credits per season
  age: number;
}

export function buildRoster(offRating: number, defRating: number): RosterPlayer[] {
  const off = (offRating - 55) / 44;    // 0..1
  const def = (defRating - 55) / 44;

  function mkRating(base: number, spread = 10) {
    return Math.round(clamp(base + (Math.random() - 0.5) * spread, 60, 99));
  }

  function salary(r: number) { return Math.round((r - 60) * 12 + 100); }

  const qbR = mkRating(72 + off * 22, 8);
  const roster: RosterPlayer[] = [
    { name: randomQBName(),  pos: 'QB', rating: qbR,  salary: salary(qbR),  age: 24 + Math.floor(Math.random() * 8) },
  ];
  for (let i = 0; i < 4; i++) {
    const r = mkRating(70 + off * 20, 10);
    roster.push({ name: randomWRName(), pos: 'WR', rating: r, salary: salary(r), age: 22 + Math.floor(Math.random() * 7) });
  }
  const rbR = mkRating(70 + off * 18, 8);
  roster.push({ name: randomRBName(), pos: 'RB', rating: rbR, salary: salary(rbR), age: 22 + Math.floor(Math.random() * 6) });
  for (let i = 0; i < 4; i++) {
    const r = mkRating(68 + off * 16, 8);
    roster.push({ name: randomName(), pos: 'OL', rating: r, salary: salary(r), age: 24 + Math.floor(Math.random() * 8) });
  }
  for (let i = 0; i < 4; i++) {
    const r = mkRating(68 + def * 20, 10);
    roster.push({ name: randomName(), pos: 'DB', rating: r, salary: salary(r), age: 22 + Math.floor(Math.random() * 7) });
  }
  for (let i = 0; i < 2; i++) {
    const r = mkRating(70 + def * 18, 8);
    roster.push({ name: randomName(), pos: 'DL', rating: r, salary: salary(r), age: 23 + Math.floor(Math.random() * 7) });
  }
  return roster;
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
