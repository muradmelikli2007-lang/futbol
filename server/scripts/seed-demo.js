// Fills a SEPARATE demo database with made-up players and matches so you can preview the app.
//   npm run seed:demo --prefix server           (writes server/data/demo.db)
//   DB_PATH=server/data/demo.db npm start       (runs the app on the demo data)
// It never touches your real database (server/data/football.db) and refuses to run on a non-empty file.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db.js';
import * as repo from '../src/repo.js';
import { validateMatchInput } from '../src/validate.js';
import { FORMATIONS } from '../src/formations.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.DB_PATH ?? path.join(here, '..', 'data', 'demo.db');
const db = openDb(file);

if (repo.listPlayers(db).length > 0) {
  console.error(`${file} already has players. Delete it first if you want a fresh demo.`);
  process.exit(1);
}

// small deterministic random generator so the demo looks the same every time
let seed = 20260;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const NAMES = [
  ['Elvin', 'FWD'], ['Rauf', 'MID'], ['Tural', 'DEF'], ['Kamran', 'GK'], ['Orxan', 'FWD'], ['Samir', 'MID'],
  ['Nihad', 'DEF'], ['Ceyhun', 'MID'], ['Vüsal', 'FWD'], ['Ramin', 'DEF'], ['Emin', 'MID'], ['Fuad', 'GK'],
  ['Altay', 'FWD'], ['Murad', 'MID'],
];
const players = NAMES.map(([name, position]) => repo.createPlayer(db, { name, position, photo: null }));
const s26 = repo.createSeason(db, { name: '2026 Season' });
const s27 = repo.createSeason(db, { name: '2027 Season' });

const ctx = { seasonExists: () => true, playerIds: repo.playerIdSet(db) };
const formations = Object.keys(FORMATIONS);

function makeMatch(seasonId, playedAt) {
  const shuffled = [...players].sort(() => rnd() - 0.5).slice(0, 12);
  const sides = { A: shuffled.slice(0, 6), B: shuffled.slice(6) };
  const strength = { A: 0.8 + rnd() * 0.8, B: 0.8 + rnd() * 0.8 };
  const goals = [];
  for (const side of ['A', 'B']) {
    const n = Math.round(strength[side] * (2 + rnd() * 4));
    for (let i = 0; i < n; i++) {
      // forwards score more often
      const pool = sides[side].flatMap((p) => (p.position === 'FWD' ? [p, p, p] : p.position === 'GK' ? [] : [p]));
      const scorer = pick(pool.length ? pool : sides[side]);
      const mates = sides[side].filter((p) => p.id !== scorer.id);
      goals.push({ side, scorerId: scorer.id, assistId: rnd() < 0.6 ? pick(mates).id : null, minute: rnd() < 0.7 ? Math.floor(rnd() * 40) + 1 : null });
    }
  }
  const scoreA = goals.filter((g) => g.side === 'A').length;
  const scoreB = goals.length - scoreA;
  const rated = rnd() < 0.8; // some matches have no ratings on purpose
  const participants = ['A', 'B'].flatMap((side) =>
    sides[side].map((p, slot) => {
      const own = side === 'A' ? scoreA : scoreB;
      const other = side === 'A' ? scoreB : scoreA;
      const bonus = own > other ? 0.7 : own < other ? -0.5 : 0;
      const scored = goals.filter((g) => g.scorerId === p.id).length;
      const rating = rated ? Math.max(4, Math.min(10, Math.round((6.3 + bonus + scored * 0.7 + (rnd() - 0.5) * 1.6) * 10) / 10)) : null;
      return { playerId: p.id, side, slot: rnd() < 0.9 ? slot : null, rating };
    }),
  );
  const best = [...participants].filter((p) => p.rating !== null).sort((a, b) => b.rating - a.rating)[0];
  const data = validateMatchInput(
    {
      seasonId: seasonId,
      playedAt,
      formationA: pick(formations),
      formationB: pick(formations),
      mvpPlayerId: best && rnd() < 0.85 ? best.playerId : null,
      notes: rnd() < 0.25 ? 'Played under lights, tight second half.' : '',
      participants,
      goals,
    },
    { ...ctx, seasonExists: (id) => id === seasonId },
  );
  repo.createMatch(db, data);
  return `${scoreA}-${scoreB}`;
}

const dates26 = ['2026-03-07', '2026-03-14', '2026-03-28', '2026-04-11', '2026-04-25', '2026-05-09', '2026-05-23', '2026-06-06', '2026-06-20', '2026-07-04'];
const dates27 = ['2027-01-16', '2027-01-30', '2027-02-13', '2027-02-27'];
const scores = [...dates26.map((d) => makeMatch(s26.id, d)), ...dates27.map((d) => makeMatch(s27.id, d))];
console.log(`Demo database written to ${file}`);
console.log(`${players.length} players, 2 seasons, ${scores.length} matches: ${scores.join(', ')}`);
db.close();
