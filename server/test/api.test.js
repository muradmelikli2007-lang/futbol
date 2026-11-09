import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

// ---------------------------------------------------------------- helpers

async function start(db = openDb(':memory:')) {
  const app = createApp(db);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const close = () => new Promise((resolve) => server.close(() => resolve()));
  return { db, api, close, base };
}

const part = (ids, side, ratings = {}) =>
  ids.map((playerId, slot) => ({ playerId, side, slot, rating: ratings[playerId] ?? null }));

const goal = (side, scorerId, assistId = null, minute = null) => ({ side, scorerId, assistId, minute });

/**
 * Seeds 12 players (ids p[1]..p[12]), two seasons and four matches.
 *
 *  m1 2026-03-01  A: 1-6   B: 7-12   3-2  A wins  MVP 1   hat-trick for P1
 *  m2 2026-03-08  A: 7,2-6 B: 1,8-12 2-1  A wins  MVP 7
 *  m4 2026-03-22  A: 1,8-12 B: 7,2-6 1-1  draw    (no ratings, no MVP)
 *  m3 2027-01-10  A: 1-6   B: 7-12   2-0  A wins  (season 2027)
 */
async function seed(api) {
  const p = {};
  for (let i = 1; i <= 12; i++) {
    const r = await api('POST', '/api/players', { name: `P${i}`, position: 'MID' });
    assert.equal(r.status, 201);
    p[i] = r.body.id;
  }
  const s26 = (await api('POST', '/api/seasons', { name: '2026 Season' })).body.id;
  const s27 = (await api('POST', '/api/seasons', { name: '2027 Season' })).body.id;
  const ids = (...n) => n.map((i) => p[i]);

  const m1 = await api('POST', '/api/matches', {
    seasonId: s26, playedAt: '2026-03-01', formationA: '2-2-1', formationB: '2-1-2', mvpPlayerId: p[1],
    participants: [
      ...part(ids(1, 2, 3, 4, 5, 6), 'A', { [p[1]]: 9, [p[2]]: 7.5 }),
      ...part(ids(7, 8, 9, 10, 11, 12), 'B', { [p[7]]: 6.5 }),
    ],
    goals: [
      goal('A', p[1], p[2], 5), goal('B', p[7], p[8], 9), goal('A', p[1], p[2], 14),
      goal('B', p[8], null, 20), goal('A', p[1], null, 31),
    ],
    scoreA: 3, scoreB: 2,
  });
  assert.equal(m1.status, 201, JSON.stringify(m1.body));

  const m2 = await api('POST', '/api/matches', {
    seasonId: s26, playedAt: '2026-03-08', formationA: '2-2-1', formationB: '2-2-1', mvpPlayerId: p[7],
    participants: [
      ...part(ids(7, 2, 3, 4, 5, 6), 'A', { [p[7]]: 8 }),
      ...part(ids(1, 8, 9, 10, 11, 12), 'B', { [p[1]]: 6 }),
    ],
    goals: [goal('A', p[7], p[2]), goal('B', p[1], p[8]), goal('A', p[7])],
  });
  assert.equal(m2.status, 201, JSON.stringify(m2.body));

  const m4 = await api('POST', '/api/matches', {
    seasonId: s26, playedAt: '2026-03-22', formationA: '1-3-1', formationB: '1-3-1',
    participants: [...part(ids(1, 8, 9, 10, 11, 12), 'A'), ...part(ids(7, 2, 3, 4, 5, 6), 'B')],
    goals: [goal('A', p[8], p[1]), goal('B', p[7])],
  });
  assert.equal(m4.status, 201, JSON.stringify(m4.body));

  const m3 = await api('POST', '/api/matches', {
    seasonId: s27, playedAt: '2027-01-10', formationA: '2-2-1', formationB: '2-2-1',
    participants: [...part(ids(1, 2, 3, 4, 5, 6), 'A'), ...part(ids(7, 8, 9, 10, 11, 12), 'B')],
    goals: [goal('A', p[2], p[1]), goal('A', p[1])],
  });
  assert.equal(m3.status, 201, JSON.stringify(m3.body));

  return { p, s26, s27, m1: m1.body.match.id, m2: m2.body.match.id, m3: m3.body.match.id, m4: m4.body.match.id };
}

const statsOf = async (api, id, season = 'all') => {
  const r = await api('GET', `/api/players?season=${season}`);
  return r.body.players.find((x) => x.id === id).stats;
};

// ---------------------------------------------------------------- players & seasons

test('players: create, edit, duplicate names rejected, delete', async () => {
  const { api, close } = await start();
  try {
    const a = await api('POST', '/api/players', { name: 'Murad', position: 'FWD' });
    assert.equal(a.status, 201);
    assert.equal((await api('POST', '/api/players', { name: 'murad' })).status, 409);
    assert.equal((await api('POST', '/api/players', { name: '  ' })).status, 400);
    const e = await api('PUT', `/api/players/${a.body.id}`, { name: 'Murad M', position: 'MID' });
    assert.equal(e.body.name, 'Murad M');
    assert.equal(e.body.position, 'MID');
    assert.equal((await api('DELETE', `/api/players/${a.body.id}`)).status, 204);
    assert.equal((await api('GET', `/api/players/${a.body.id}`)).status, 404);
  } finally {
    await close();
  }
});

test('players: a photo is stored and served as an image', async () => {
  const { api, close, base } = await start();
  try {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const a = await api('POST', '/api/players', { name: 'Photo', photo: png });
    assert.match(a.body.photoUrl, /^\/api\/players\/\d+\/photo\?v=1$/);
    const img = await fetch(base + a.body.photoUrl);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.ok((await img.arrayBuffer()).byteLength > 20);
    const removed = await api('PUT', `/api/players/${a.body.id}`, { name: 'Photo', photo: null });
    assert.equal(removed.body.photoUrl, null);
    assert.equal((await api('PUT', `/api/players/${a.body.id}`, { name: 'Photo', photo: 'nope' })).status, 400);
  } finally {
    await close();
  }
});

test('seasons: create, rename, duplicate rejected, cannot delete a season that has matches', async () => {
  const { api, close } = await start();
  try {
    const { s26, s27 } = await seed(api);
    assert.equal((await api('POST', '/api/seasons', { name: '2026 season' })).status, 409);
    assert.equal((await api('PUT', `/api/seasons/${s27}`, { name: '2027 Spring' })).body.name, '2027 Spring');
    const del = await api('DELETE', `/api/seasons/${s26}`);
    assert.equal(del.status, 409);
    const fresh = (await api('POST', '/api/seasons', { name: 'Empty' })).body.id;
    assert.equal((await api('DELETE', `/api/seasons/${fresh}`)).status, 204);
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------- match validation

test('match validation rejects every kind of bad input', async () => {
  const { api, close } = await start();
  try {
    const { p, s26 } = await seed(api);
    const ids = (...n) => n.map((i) => p[i]);
    const base = () => ({
      seasonId: s26, playedAt: '2026-04-01', formationA: '2-2-1', formationB: '2-2-1',
      participants: [...part(ids(1, 2, 3, 4, 5, 6), 'A'), ...part(ids(7, 8, 9, 10, 11, 12), 'B')],
      goals: [goal('A', p[1]), goal('B', p[7])],
    });
    const expectBad = async (mutate, pattern) => {
      const body = base();
      mutate(body);
      const r = await api('POST', '/api/matches', body);
      assert.equal(r.status, 400, `expected 400 for ${pattern}, got ${r.status} ${JSON.stringify(r.body)}`);
      assert.match(JSON.stringify(r.body.details), pattern);
    };

    assert.equal((await api('POST', '/api/matches', base())).status, 201); // the base case itself is valid

    await expectBad((b) => b.participants.pop(), /exactly 12/);
    await expectBad((b) => { b.participants[11] = { ...b.participants[11], playerId: p[1] }; }, /both sides/);
    await expectBad((b) => { b.participants[1] = { ...b.participants[1], playerId: p[1], side: 'A' }; }, /twice/);
    await expectBad((b) => { b.participants[5].side = 'B'; }, /exactly 6/);
    await expectBad((b) => { b.participants[0].slot = 1; }, /same pitch position/);
    await expectBad((b) => { b.participants[0].rating = 11; }, /between 0 and 10/);
    await expectBad((b) => { b.scoreA = 4; }, /does not match its recorded goals/);
    await expectBad((b) => { b.goals[0] = goal('A', p[7]); }, /scorer must be a player on Side A/);
    await expectBad((b) => { b.goals[0] = goal('A', p[1], p[1]); }, /own goal/);
    await expectBad((b) => { b.goals[0] = goal('A', p[1], p[8]); }, /same side/);
    await expectBad((b) => { b.goals[0] = goal('A', p[1], null, 400); }, /minute/);
    await expectBad((b) => { b.mvpPlayerId = 99999; }, /MVP/);
    await expectBad((b) => { b.formationA = '5-5'; }, /formation/);
    await expectBad((b) => { b.playedAt = '2026-02-30'; }, /valid date/);
    await expectBad((b) => { b.seasonId = 12345; }, /season/);
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------- statistics

test('player stats are calculated from matches and goals (season vs all-time)', async () => {
  const { api, close } = await start();
  try {
    const { p } = await seed(api);

    const p1 = await statsOf(api, p[1], 'all');
    assert.equal(p1.matches, 4);
    assert.equal(p1.goals, 5); // 3 + 1 + 0 + 1
    assert.equal(p1.assists, 2);
    assert.equal(p1.goalsAssists, 7);
    assert.deepEqual([p1.wins, p1.draws, p1.losses], [2, 1, 1]);
    assert.equal(p1.winPct, 50);
    assert.equal(p1.mvp, 1);
    assert.equal(p1.avgRating, 7.5); // only the two rated matches count: (9 + 6) / 2
    assert.equal(p1.ratedMatches, 2);
    assert.equal(p1.highestRating, 9);
    assert.equal(p1.lowestRating, 6);
    assert.equal(p1.bestPerformance.goals, 3);
    assert.deepEqual(p1.form, ['W', 'L', 'D', 'W']); // chronological: 03-01, 03-08, 03-22, 2027-01-10

    const s26 = await statsOf(api, p[1], (await api('GET', '/api/seasons')).body.find((s) => s.name === '2026 Season').id);
    assert.equal(s26.matches, 3);
    assert.equal(s26.goals, 4);
    assert.equal(s26.assists, 1);
    assert.equal(s26.winPct, 33.3);
    assert.equal(s26.avgPoints, 8.33); // (17 + 4 + 4) / 3

    const s27 = await statsOf(api, p[1], (await api('GET', '/api/seasons')).body.find((s) => s.name === '2027 Season').id);
    assert.equal(s27.matches, 1);
    assert.equal(s27.goals, 1);
    assert.equal(s27.assists, 1);
    assert.equal(s27.avgRating, null); // no rated matches => no average, not 0
  } finally {
    await close();
  }
});

test('rankings: ties share a rank, ratings ignore unrated matches, minimum matches applies', async () => {
  const { api, close } = await start();
  try {
    const { p, s26 } = await seed(api);

    const scorers = (await api('GET', `/api/rankings/top-scorers?season=${s26}`)).body;
    assert.deepEqual(scorers.rows.slice(0, 2).map((r) => [r.player.name, r.value, r.rank]), [['P1', 4, 1], ['P7', 4, 1]]);
    assert.equal(scorers.rows[2].rank, 3);
    assert.ok(scorers.rows.every((r) => r.value >= 1)); // players with no goals are not listed

    const rating = (await api('GET', `/api/rankings/best-rating?season=${s26}&minMatches=2`)).body;
    assert.deepEqual(rating.rows.map((r) => [r.player.name, r.value]), [['P1', 7.5], ['P7', 7.25]]);
    assert.equal(rating.relaxed, false);

    // nobody has 3 rated matches -> the ranking relaxes and says so
    const relaxed = (await api('GET', `/api/rankings/best-rating?season=${s26}&minMatches=3`)).body;
    assert.equal(relaxed.relaxed, true);
    assert.equal(relaxed.minMatches, 1);
    assert.equal(relaxed.rows[0].player.name, 'P1');

    const mvp = (await api('GET', `/api/rankings/most-mvp?season=${s26}`)).body;
    assert.deepEqual(mvp.rows.map((r) => [r.player.name, r.value, r.rank]), [['P1', 1, 1], ['P7', 1, 1]]);

    const wins = (await api('GET', `/api/rankings/most-wins?season=${s26}`)).body;
    assert.equal(wins.rows[0].value, 2); // P2..P6 won twice in 2026
    assert.equal((await api('GET', '/api/rankings/unknown')).status, 404);
    assert.equal((await api('GET', '/api/rankings/top-scorers?minMatches=abc')).status, 400);
    assert.ok(p[1]);
  } finally {
    await close();
  }
});

test('head-to-head only counts matches on opposite sides', async () => {
  const { api, close } = await start();
  try {
    const { p, s26 } = await seed(api);

    // P1 vs P7 were on opposite sides in all four matches.
    const all = (await api('GET', `/api/head-to-head?a=${p[1]}&b=${p[7]}`)).body;
    assert.equal(all.matches, 4);
    assert.deepEqual([all.a.wins, all.draws, all.b.wins], [2, 1, 1]); // P1 won m1 and m3, P7 won m2, m4 drawn
    assert.deepEqual([all.a.goals, all.b.goals], [5, 4]);
    assert.deepEqual([all.a.assists, all.b.assists], [2, 0]);
    assert.deepEqual([all.a.avgRating, all.b.avgRating], [7.5, 7.25]);
    assert.equal(all.latest.length, 4);
    assert.equal(all.latest[0].match.playedAt, '2027-01-10'); // newest first

    // Only 2026 matches when a season is selected.
    const s = (await api('GET', `/api/head-to-head?a=${p[1]}&b=${p[7]}&season=${s26}`)).body;
    assert.equal(s.matches, 3);
    assert.deepEqual([s.a.wins, s.draws, s.b.wins], [1, 1, 1]);

    // P1 and P2 were teammates in m1 and m3, so only m2 and m4 count.
    const mates = (await api('GET', `/api/head-to-head?a=${p[1]}&b=${p[2]}`)).body;
    assert.equal(mates.matches, 2);
    assert.deepEqual([mates.a.wins, mates.draws, mates.b.wins], [0, 1, 1]);

    // P3 and P4 were teammates in m1, m2, m3 and m4 (A, A, A, B/B) -> never opponents.
    const never = (await api('GET', `/api/head-to-head?a=${p[3]}&b=${p[4]}`)).body;
    assert.equal(never.matches, 0);
    assert.equal(never.a.winPct, null);

    assert.equal((await api('GET', `/api/head-to-head?a=${p[1]}&b=${p[1]}`)).status, 400);
  } finally {
    await close();
  }
});

test('comparison highlights the stronger statistic and handles missing ratings', async () => {
  const { api, close } = await start();
  try {
    const { p } = await seed(api);
    const c = (await api('GET', `/api/compare?a=${p[1]}&b=${p[2]}`)).body;
    const row = (key) => c.rows.find((r) => r.key === key);
    assert.deepEqual([row('goals').a, row('goals').b, row('goals').better], [5, 1, 'a']);
    assert.deepEqual([row('assists').a, row('assists').b, row('assists').better], [2, 3, 'b']);
    assert.equal(row('matches').better, 'tie');
    assert.equal(row('wins').better, 'b'); // P2: 3 wins, P1: 2
    assert.equal(row('avgRating').a, 7.5);
    assert.equal(row('avgRating').b, 7.5); // P2 has a single rated match (7.5)
    assert.equal(row('avgRating').better, 'tie');
    assert.equal(c.a.trend.length, 4);

    // P3 never received a rating: nothing to compare, and it is null rather than 0.
    const c2 = (await api('GET', `/api/compare?a=${p[1]}&b=${p[3]}`)).body;
    assert.equal(c2.rows.find((r) => r.key === 'avgRating').b, null);
    assert.equal(c2.rows.find((r) => r.key === 'avgRating').better, null);
  } finally {
    await close();
  }
});

test('records and charts', async () => {
  const { api, close } = await start();
  try {
    const { p, m1, m3 } = await seed(api);
    const s = (await api('GET', '/api/statistics')).body;
    assert.deepEqual(s.totals, { matches: 4, goals: 12, assists: 7, goalsPerMatch: 3 });
    assert.equal(s.records.highestScoringMatch.total, 5);
    assert.equal(s.records.highestScoringMatch.match.id, m1);
    assert.equal(s.records.biggestWin.margin, 2);
    assert.equal(s.records.biggestWin.match.id, m3);
    assert.equal(s.records.mostGoalsInMatch.value, 3);
    assert.equal(s.records.mostGoalsInMatch.holders[0].player.id, p[1]);
    assert.equal(s.records.mostAssistsInMatch.value, 2);
    assert.equal(s.records.mostAssistsInMatch.holders[0].player.id, p[2]);
    assert.equal(s.records.hatTricks.total, 1);
    assert.equal(s.records.hatTricks.byPlayer[0].player.id, p[1]);
    // P2-P6 won m1 and m2, drew m4 (2026-03-22) and won m3 (2027-01-10): the best run is 2.
    assert.equal(s.records.longestWinStreak.length, 2);
    assert.equal(s.records.longestWinStreak.from, '2026-03-01');
    assert.equal(s.records.longestWinStreak.to, '2026-03-08');
    assert.equal(s.records.winStreaks.filter((w) => w.length === 2).length, 5);
    assert.equal(s.records.mostMvp.value, 1);

    assert.equal(s.charts.timeline.length, 4);
    assert.deepEqual(s.charts.timeline.map((t) => t.cumulativeGoals), [5, 8, 10, 12]);
    assert.deepEqual(s.charts.resultsDistribution.sideWins, { A: 3, B: 0, draws: 1 });
    assert.deepEqual(s.charts.resultsDistribution.margins.map((m) => m.count), [1, 2, 1, 0]);
    assert.equal(s.charts.performanceTrends.length, 12);
  } finally {
    await close();
  }
});

test('dashboard shows totals and leaders', async () => {
  const { api, close } = await start();
  try {
    const { p } = await seed(api);
    const d = (await api('GET', '/api/dashboard')).body;
    assert.deepEqual(
      [d.totals.matches, d.totals.goals, d.totals.assists, d.totals.players],
      [4, 12, 7, 12],
    );
    assert.equal(d.topScorer.player.id, p[1]);
    assert.equal(d.topScorer.value, 5);
    assert.equal(d.topAssister.player.id, p[2]);
    assert.equal(d.topAssister.value, 3);
    assert.equal(d.latestMatches.length, 4);
    assert.equal(d.latestMatches[0].playedAt, '2027-01-10');
    assert.equal(d.topPlayers.length, 5);
    assert.ok(d.recentPerformances.length > 0);

    const empty = await start();
    try {
      const e = (await empty.api('GET', '/api/dashboard')).body;
      assert.equal(e.totals.matches, 0);
      assert.equal(e.topScorer, null);
      assert.deepEqual(e.latestMatches, []);
      assert.equal((await empty.api('GET', '/api/statistics')).body.records.highestScoringMatch, null);
    } finally {
      await empty.close();
    }
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------- editing & deleting

test('editing a match updates every statistic; moving it to another season moves its stats', async () => {
  const { api, close } = await start();
  try {
    const { p, s26, s27, m4 } = await seed(api);
    assert.equal((await statsOf(api, p[1], s26)).matches, 3);
    assert.equal((await statsOf(api, p[1], s27)).matches, 1);

    // Move the draw (m4) from 2026 to 2027.
    const { body } = await api('GET', `/api/matches/${m4}`);
    const moved = await api('PUT', `/api/matches/${m4}`, { ...body.form, seasonId: s27 });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal((await statsOf(api, p[1], s26)).matches, 2);
    assert.equal((await statsOf(api, p[1], s27)).matches, 2);
    assert.equal((await statsOf(api, p[1], 'all')).matches, 4);

    // Change a scorer: the goal moves from P8 to P9.
    const form = (await api('GET', `/api/matches/${m4}`)).body.form;
    form.goals = form.goals.map((g) => (g.scorerId === p[8] ? { ...g, scorerId: p[9] } : g));
    assert.equal((await api('PUT', `/api/matches/${m4}`, form)).status, 200);
    assert.equal((await statsOf(api, p[8])).goals, 1); // only his goal from m1 remains
    assert.equal((await statsOf(api, p[9])).goals, 1);

    // An invalid edit is rejected and changes nothing.
    const bad = { ...form, scoreA: 9 };
    assert.equal((await api('PUT', `/api/matches/${m4}`, bad)).status, 400);
    assert.equal((await statsOf(api, p[9])).goals, 1);
    assert.equal((await api('PUT', '/api/matches/99999', form)).status, 404);
  } finally {
    await close();
  }
});

test('deleting a match removes it from rankings and profiles', async () => {
  const { api, close } = await start();
  try {
    const { p, m1 } = await seed(api);
    assert.equal((await statsOf(api, p[1])).goals, 5);
    assert.equal((await statsOf(api, p[1])).mvp, 1);

    assert.equal((await api('DELETE', `/api/matches/${m1}`)).status, 204);
    const after = await statsOf(api, p[1]);
    assert.equal(after.matches, 3);
    assert.equal(after.goals, 2);
    assert.equal(after.mvp, 0);
    assert.equal(after.avgRating, 6); // only the 6.0 from m2 is left

    const scorers = (await api('GET', '/api/rankings/top-scorers')).body;
    assert.equal(scorers.rows[0].value, 3); // P7: 2 + 1
    assert.equal((await api('GET', `/api/matches/${m1}`)).status, 404);
    assert.equal((await api('DELETE', `/api/matches/${m1}`)).status, 404);

    const profile = (await api('GET', `/api/players/${p[1]}`)).body;
    assert.equal(profile.history.length, 3);
    assert.ok(profile.history.every((h) => h.matchId !== m1));
  } finally {
    await close();
  }
});

test('a player with recorded matches cannot be deleted; an unused one can', async () => {
  const { api, close } = await start();
  try {
    const { p } = await seed(api);
    const del = await api('DELETE', `/api/players/${p[1]}`);
    assert.equal(del.status, 409);
    assert.match(del.body.error, /4 recorded matches/);
    const extra = (await api('POST', '/api/players', { name: 'Spare' })).body.id;
    assert.equal((await api('DELETE', `/api/players/${extra}`)).status, 204);
  } finally {
    await close();
  }
});

test('match list filters: season, player, result, dates', async () => {
  const { api, close } = await start();
  try {
    const { p, s26, s27 } = await seed(api);
    const list = async (q) => (await api('GET', `/api/matches?${q}`)).body;

    const all = await list('');
    assert.equal(all.count, 4);
    assert.deepEqual(all.matches.map((m) => m.playedAt), ['2027-01-10', '2026-03-22', '2026-03-08', '2026-03-01']);
    assert.equal((await list(`season=${s26}`)).count, 3);
    assert.equal((await list(`season=${s27}`)).count, 1);
    assert.equal((await list('from=2026-03-05&to=2026-03-30')).count, 2);
    assert.equal((await list('result=draw')).count, 1);
    assert.equal((await list('result=decisive')).count, 3);
    assert.equal((await list(`player=${p[7]}&result=win`)).count, 1); // P7 only won m2
    assert.equal((await list(`player=${p[7]}&result=loss`)).count, 2);
    assert.equal((await list(`player=${p[12]}`)).count, 4);
    assert.equal((await api('GET', `/api/matches?player=${p[1]}&result=decisive`)).status, 400);
    assert.equal((await api('GET', '/api/matches?result=win')).status, 400);
  } finally {
    await close();
  }
});

test('match detail has goals in order with a running score, plus the best-rated player', async () => {
  const { api, close } = await start();
  try {
    const { p, m1 } = await seed(api);
    const { match } = (await api('GET', `/api/matches/${m1}`)).body;
    assert.deepEqual([match.scoreA, match.scoreB, match.result], [3, 2, 'A']);
    assert.deepEqual(match.goals.map((g) => g.minute), [5, 9, 14, 20, 31]);
    assert.deepEqual(match.goals.map((g) => `${g.scoreAfter.a}-${g.scoreAfter.b}`), ['1-0', '1-1', '2-1', '2-2', '3-2']);
    assert.equal(match.mvp.id, p[1]);
    assert.equal(match.bestRated.player.id, p[1]);
    assert.equal(match.bestRated.rating, 9);
    assert.equal(match.ratedCount, 3);
    assert.equal(match.sideA.length, 6);
    assert.equal(match.sideB.length, 6);
    assert.equal(match.sideA[0].isGoalkeeper, true);
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------- persistence

test('data survives closing and reopening the database file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fstats-'));
  const file = path.join(dir, 'test.db');
  try {
    let t = await start(openDb(file));
    const seeded = await seed(t.api);
    await t.close();
    t.db.close();

    t = await start(openDb(file));
    const d = (await t.api('GET', '/api/dashboard')).body;
    assert.equal(d.totals.matches, 4);
    assert.equal(d.totals.goals, 12);
    assert.equal((await statsOf(t.api, seeded.p[1])).goals, 5);
    await t.close();
    t.db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('database constraints back up the API rules', async () => {
  const { db, api, close } = await start();
  try {
    const { p, m1 } = await seed(api);
    // The same player cannot be inserted twice into one match, even bypassing the API.
    assert.throws(() =>
      db.prepare("INSERT INTO match_players (match_id, player_id, side, slot, rating) VALUES (?, ?, 'B', NULL, NULL)").run(m1, p[1]),
    );
    // Two players cannot share a pitch slot on one side.
    assert.throws(() => db.prepare('UPDATE match_players SET slot = 0 WHERE match_id = ? AND player_id = ?').run(m1, p[2]));
  } finally {
    await close();
  }
});
