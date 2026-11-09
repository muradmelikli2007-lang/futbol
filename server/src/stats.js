// All statistics are computed here from raw matches (participants + goal events).
// Nothing is ever stored as a running total, so edits and deletes can never leave stale numbers behind.
import { HttpError } from './validate.js';

export const POINTS = { goal: 4, assist: 3, win: 2, draw: 1, mvp: 3 };
export const DEFAULT_MIN_MATCHES = 3;

const round = (n, d = 2) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const resultOf = (f, a) => (f > a ? 'W' : f < a ? 'L' : 'D');
const formPoints = (form) => form.reduce((s, r) => s + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);

// ------------------------------------------------------------------ performances

/** One record per (player, match). `matches` must be in chronological order. */
export function buildPerformances(matches) {
  const perfs = [];
  matches.forEach((m, order) => {
    const goalCount = new Map();
    const assistCount = new Map();
    for (const g of m.goals) {
      goalCount.set(g.scorerId, (goalCount.get(g.scorerId) ?? 0) + 1);
      if (g.assistId != null) assistCount.set(g.assistId, (assistCount.get(g.assistId) ?? 0) + 1);
    }
    for (const p of m.participants) {
      const scoreFor = p.side === 'A' ? m.scoreA : m.scoreB;
      const scoreAgainst = p.side === 'A' ? m.scoreB : m.scoreA;
      const result = resultOf(scoreFor, scoreAgainst);
      const goals = goalCount.get(p.playerId) ?? 0;
      const assists = assistCount.get(p.playerId) ?? 0;
      const isMvp = m.mvpPlayerId === p.playerId;
      perfs.push({
        matchId: m.id,
        order,
        seasonId: m.seasonId,
        seasonName: m.seasonName,
        playedAt: m.playedAt,
        playerId: p.playerId,
        side: p.side,
        slot: p.slot,
        rating: p.rating,
        goals,
        assists,
        isMvp,
        result,
        scoreFor,
        scoreAgainst,
        points:
          goals * POINTS.goal +
          assists * POINTS.assist +
          (result === 'W' ? POINTS.win : result === 'D' ? POINTS.draw : 0) +
          (isMvp ? POINTS.mvp : 0),
      });
    }
  });
  return perfs;
}

export function groupByPlayer(perfs) {
  const map = new Map();
  for (const p of perfs) {
    if (!map.has(p.playerId)) map.set(p.playerId, []);
    map.get(p.playerId).push(p);
  }
  return map;
}

const cmpBest = (a, b) =>
  a.goals + a.assists - (b.goals + b.assists) ||
  (a.rating ?? -1) - (b.rating ?? -1) ||
  a.points - b.points ||
  a.order - b.order;

function perfBrief(p) {
  return {
    matchId: p.matchId,
    playedAt: p.playedAt,
    goals: p.goals,
    assists: p.assists,
    rating: p.rating,
    result: p.result,
    scoreFor: p.scoreFor,
    scoreAgainst: p.scoreAgainst,
    isMvp: p.isMvp,
  };
}

/** Aggregates one player's performances (chronological). Matches without a rating never count towards averages. */
export function summarize(perfs) {
  const n = perfs.length;
  let goals = 0, assists = 0, wins = 0, draws = 0, losses = 0, mvp = 0, points = 0;
  let ratingSum = 0, rated = 0, hi = null, lo = null, best = null;
  for (const p of perfs) {
    goals += p.goals;
    assists += p.assists;
    points += p.points;
    if (p.isMvp) mvp += 1;
    if (p.result === 'W') wins += 1;
    else if (p.result === 'D') draws += 1;
    else losses += 1;
    if (p.rating != null) {
      ratingSum += p.rating;
      rated += 1;
      hi = hi == null ? p.rating : Math.max(hi, p.rating);
      lo = lo == null ? p.rating : Math.min(lo, p.rating);
    }
    if ((p.goals + p.assists > 0 || p.rating != null) && (!best || cmpBest(p, best) > 0)) best = p;
  }
  return {
    matches: n,
    goals,
    assists,
    goalsAssists: goals + assists,
    goalsPerMatch: n ? round(goals / n) : null,
    assistsPerMatch: n ? round(assists / n) : null,
    wins,
    draws,
    losses,
    winPct: n ? round((wins / n) * 100, 1) : null,
    avgRating: rated ? round(ratingSum / rated) : null,
    ratedMatches: rated,
    highestRating: hi,
    lowestRating: lo,
    mvp,
    points,
    avgPoints: n ? round(points / n) : null,
    bestPerformance: best ? perfBrief(best) : null,
    form: perfs.slice(-5).map((p) => p.result),
  };
}

export function statsByPlayer(players, perfs) {
  const grouped = groupByPlayer(perfs);
  const out = new Map();
  for (const pl of players) out.set(pl.id, summarize(grouped.get(pl.id) ?? []));
  return out;
}

// ------------------------------------------------------------------ presentation

export function makeRefs(players) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const ref = (id) => {
    if (id == null) return null;
    const p = byId.get(id);
    return p
      ? { id: p.id, name: p.name, position: p.position, photoUrl: p.photoUrl }
      : { id, name: 'Unknown player', position: 'ANY', photoUrl: null };
  };
  return { byId, ref };
}

export function presentMatch(m, refs) {
  const perfs = buildPerformances([m]);
  const perfOf = new Map(perfs.map((p) => [p.playerId, p]));
  const side = (s) =>
    m.participants
      .filter((p) => p.side === s)
      .map((p) => {
        const perf = perfOf.get(p.playerId);
        return {
          player: refs.ref(p.playerId),
          slot: p.slot,
          isGoalkeeper: p.slot === 0,
          rating: p.rating,
          goals: perf.goals,
          assists: perf.assists,
          isMvp: perf.isMvp,
        };
      });
  const sideA = side('A');
  const sideB = side('B');

  let a = 0;
  let b = 0;
  const goals = m.goals.map((g) => {
    if (g.side === 'A') a += 1;
    else b += 1;
    return {
      id: g.id,
      side: g.side,
      minute: g.minute,
      scorer: refs.ref(g.scorerId),
      assist: refs.ref(g.assistId),
      scoreAfter: { a, b },
    };
  });

  const rated = [...sideA, ...sideB].filter((p) => p.rating != null);
  rated.sort((x, y) => y.rating - x.rating || y.goals + y.assists - (x.goals + x.assists));
  const top = rated[0] ?? null;

  return {
    id: m.id,
    seasonId: m.seasonId,
    seasonName: m.seasonName,
    playedAt: m.playedAt,
    formationA: m.formationA,
    formationB: m.formationB,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    result: m.scoreA > m.scoreB ? 'A' : m.scoreA < m.scoreB ? 'B' : 'draw',
    notes: m.notes,
    mvp: refs.ref(m.mvpPlayerId),
    sideA,
    sideB,
    goals,
    ratedCount: rated.length,
    bestRated: top ? { player: top.player, rating: top.rating } : null,
  };
}

// ------------------------------------------------------------------ match filters

export function filterMatches(matches, { playerId, result, from, to } = {}) {
  let out = matches;
  if (from) out = out.filter((m) => m.playedAt >= from);
  if (to) out = out.filter((m) => m.playedAt <= to);
  if (playerId != null) out = out.filter((m) => m.participants.some((p) => p.playerId === playerId));
  if (result) {
    const valid = playerId != null ? ['win', 'draw', 'loss'] : ['draw', 'decisive', 'A', 'B'];
    if (!valid.includes(result)) {
      throw new HttpError(
        400,
        playerId != null
          ? 'With a player selected, the result filter must be win, draw or loss.'
          : 'Without a player selected, the result filter must be draw, decisive, A or B.',
      );
    }
    out = out.filter((m) => {
      if (playerId != null) {
        const side = m.participants.find((p) => p.playerId === playerId).side;
        const f = side === 'A' ? m.scoreA : m.scoreB;
        const a = side === 'A' ? m.scoreB : m.scoreA;
        return result === 'win' ? f > a : result === 'loss' ? f < a : f === a;
      }
      if (result === 'draw') return m.scoreA === m.scoreB;
      if (result === 'decisive') return m.scoreA !== m.scoreB;
      return result === 'A' ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
    });
  }
  return out;
}

// ------------------------------------------------------------------ rankings

const desc = (v) => (v == null ? -Infinity : v);

export const RANKINGS = {
  'top-scorers': {
    label: 'Top Scorers',
    metric: 'Goals',
    description: 'Most goals scored.',
    value: (s) => s.goals,
    ties: [(s) => s.goalsPerMatch, (s) => s.assists],
    minValue: 1,
  },
  'top-assists': {
    label: 'Top Assists',
    metric: 'Assists',
    description: 'Most assists provided.',
    value: (s) => s.assists,
    ties: [(s) => s.assistsPerMatch, (s) => s.goals],
    minValue: 1,
  },
  'goals-assists': {
    label: 'Goals + Assists',
    metric: 'G+A',
    description: 'Goals and assists combined.',
    value: (s) => s.goalsAssists,
    ties: [(s) => s.goals, (s) => s.matches * -1],
    minValue: 1,
  },
  'best-rating': {
    label: 'Best Average Rating',
    metric: 'Avg rating',
    description: 'Average match rating. Matches without a rating are ignored.',
    value: (s) => s.avgRating,
    ties: [(s) => s.ratedMatches],
    needs: 'ratedMatches',
    decimals: 2,
  },
  'most-mvp': {
    label: 'Most MVP Awards',
    metric: 'MVPs',
    description: 'Most man-of-the-match awards.',
    value: (s) => s.mvp,
    ties: [(s) => s.avgRating, (s) => s.matches * -1],
    minValue: 1,
  },
  'most-wins': {
    label: 'Most Wins',
    metric: 'Wins',
    description: 'Most matches won.',
    value: (s) => s.wins,
    ties: [(s) => s.winPct, (s) => s.matches * -1],
    minValue: 1,
  },
  'win-percentage': {
    label: 'Highest Win Percentage',
    metric: 'Win %',
    description: 'Share of matches won.',
    value: (s) => s.winPct,
    ties: [(s) => s.matches],
    needs: 'matches',
    decimals: 1,
  },
  'best-players': {
    label: 'Best Players',
    metric: 'Score / match',
    description: `Average points per match: goal ${POINTS.goal}, assist ${POINTS.assist}, win ${POINTS.win}, draw ${POINTS.draw}, MVP ${POINTS.mvp}.`,
    value: (s) => s.avgPoints,
    ties: [(s) => s.points],
    needs: 'matches',
    decimals: 2,
  },
};

function rankRows(def, players, statsMap, refs, minMatches) {
  const rows = [];
  for (const pl of players) {
    const s = statsMap.get(pl.id);
    if (!s || s.matches === 0) continue;
    if (def.needs && s[def.needs] < minMatches) continue;
    const v = def.value(s);
    if (v == null) continue;
    if (def.minValue != null && v < def.minValue) continue;
    rows.push({ player: refs.ref(pl.id), value: v, stats: s });
  }
  rows.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    for (const t of def.ties) {
      const d = desc(t(b.stats)) - desc(t(a.stats));
      if (d !== 0) return d;
    }
    return a.player.name.localeCompare(b.player.name);
  });
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.value !== rows[i - 1].value) rank = i + 1;
    return { rank, ...r };
  });
}

export function buildRanking(type, players, statsMap, refs, minMatches = DEFAULT_MIN_MATCHES) {
  const def = RANKINGS[type];
  if (!def) throw new HttpError(404, `Unknown ranking "${type}".`);
  let used = minMatches;
  let rows = rankRows(def, players, statsMap, refs, used);
  let relaxed = false;
  if (!rows.length && def.needs && used > 1) {
    used = 1;
    rows = rankRows(def, players, statsMap, refs, 1);
    relaxed = rows.length > 0;
  }
  return {
    type,
    label: def.label,
    metric: def.metric,
    description: def.description,
    decimals: def.decimals ?? 0,
    minMatches: def.needs ? used : null,
    minMatchesRequested: def.needs ? minMatches : null,
    relaxed,
    rows,
  };
}

export function rankingList() {
  return Object.entries(RANKINGS).map(([type, d]) => ({ type, label: d.label, metric: d.metric }));
}

function leader(ranking) {
  const rows = ranking.rows;
  if (!rows.length) return null;
  return { ...rows[0], tiedCount: rows.filter((r) => r.rank === 1).length - 1 };
}

// ------------------------------------------------------------------ dashboard

export function buildDashboard({ players, matches, refs, perfs, statsMap }) {
  const totals = {
    matches: matches.length,
    goals: matches.reduce((s, m) => s + m.scoreA + m.scoreB, 0),
    assists: matches.reduce((s, m) => s + m.goals.filter((g) => g.assistId != null).length, 0),
    players: players.length,
    activePlayers: new Set(perfs.map((p) => p.playerId)).size,
  };
  totals.goalsPerMatch = totals.matches ? round(totals.goals / totals.matches) : null;

  const rk = (type) => buildRanking(type, players, statsMap, refs);
  const best = rk('best-players');
  const rating = rk('best-rating');

  const recentMatches = matches.slice(-3).map((m) => m.id);
  const recentPerformances = perfs
    .filter((p) => recentMatches.includes(p.matchId))
    .sort((a, b) => b.points - a.points || (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 8)
    .map((p) => ({ player: refs.ref(p.playerId), ...perfBrief(p) }));

  const latest = [...matches].reverse().slice(0, 5).map((m) => presentMatch(m, refs));

  return {
    totals,
    mvp: leader(rk('most-mvp')),
    topScorer: leader(rk('top-scorers')),
    topAssister: leader(rk('top-assists')),
    topRated: leader(rating),
    topRatedRelaxed: rating.relaxed,
    topRatedMinMatches: rating.minMatches,
    latestMatches: latest,
    topPlayers: best.rows.slice(0, 5),
    topPlayersRelaxed: best.relaxed,
    recentPerformances,
    goalsTrend: matches.slice(-12).map((m) => ({
      matchId: m.id,
      date: m.playedAt,
      goalsA: m.scoreA,
      goalsB: m.scoreB,
      goals: m.scoreA + m.scoreB,
    })),
    resultsDistribution: resultsDistribution(matches),
  };
}

function resultsDistribution(matches) {
  const sideWins = { A: 0, B: 0, draws: 0 };
  const margins = { draws: 0, one: 0, two: 0, threePlus: 0 };
  for (const m of matches) {
    const diff = Math.abs(m.scoreA - m.scoreB);
    if (diff === 0) {
      sideWins.draws += 1;
      margins.draws += 1;
    } else {
      sideWins[m.scoreA > m.scoreB ? 'A' : 'B'] += 1;
      if (diff === 1) margins.one += 1;
      else if (diff === 2) margins.two += 1;
      else margins.threePlus += 1;
    }
  }
  return {
    sideWins,
    margins: [
      { label: 'Draw', count: margins.draws },
      { label: '1 goal', count: margins.one },
      { label: '2 goals', count: margins.two },
      { label: '3+ goals', count: margins.threePlus },
    ],
  };
}

// ------------------------------------------------------------------ records & charts

function holders(perfs, key, refs, limit = 5) {
  const max = perfs.reduce((m, p) => Math.max(m, p[key]), 0);
  if (max === 0) return null;
  const list = perfs
    .filter((p) => p[key] === max)
    .sort((a, b) => b.order - a.order)
    .map((p) => ({ player: refs.ref(p.playerId), ...perfBrief(p) }));
  return { value: max, count: list.length, holders: list.slice(0, limit) };
}

function winStreaks(perfs, refs) {
  const out = [];
  for (const [playerId, list] of groupByPlayer(perfs)) {
    let run = 0, best = 0, bestStart = null, bestEnd = null, start = null;
    for (const p of list) {
      if (p.result === 'W') {
        if (run === 0) start = p;
        run += 1;
        if (run > best) {
          best = run;
          bestStart = start;
          bestEnd = p;
        }
      } else run = 0;
    }
    if (best > 0) out.push({ player: refs.ref(playerId), length: best, from: bestStart.playedAt, to: bestEnd.playedAt, current: run });
  }
  return out.sort((a, b) => b.length - a.length || a.to.localeCompare(b.to) || a.player.name.localeCompare(b.player.name));
}

export function buildStatistics({ players, matches, refs, perfs, statsMap }) {
  const goalsTotal = matches.reduce((s, m) => s + m.scoreA + m.scoreB, 0);
  const assistsTotal = matches.reduce((s, m) => s + m.goals.filter((g) => g.assistId != null).length, 0);

  let highest = null;
  let biggest = null;
  for (const m of matches) {
    const total = m.scoreA + m.scoreB;
    if (!highest || total >= highest.total) highest = { total, m };
    const margin = Math.abs(m.scoreA - m.scoreB);
    if (margin > 0 && (!biggest || margin > biggest.margin || (margin === biggest.margin && total >= biggest.total))) {
      biggest = { margin, total, m };
    }
  }

  const hatTrickPerfs = perfs.filter((p) => p.goals >= 3);
  const hatByPlayer = new Map();
  for (const p of hatTrickPerfs) hatByPlayer.set(p.playerId, (hatByPlayer.get(p.playerId) ?? 0) + 1);

  const streaks = winStreaks(perfs, refs);
  const winPct = buildRanking('win-percentage', players, statsMap, refs);
  const mvp = buildRanking('most-mvp', players, statsMap, refs);

  let cumGoals = 0;
  let cumAssists = 0;
  const timeline = matches.map((m) => {
    const goals = m.scoreA + m.scoreB;
    const assists = m.goals.filter((g) => g.assistId != null).length;
    cumGoals += goals;
    cumAssists += assists;
    return {
      matchId: m.id,
      date: m.playedAt,
      goals,
      goalsA: m.scoreA,
      goalsB: m.scoreB,
      assists,
      cumulativeGoals: cumGoals,
      cumulativeAssists: cumAssists,
    };
  });

  const grouped = groupByPlayer(perfs);
  const trends = players
    .filter((p) => grouped.has(p.id))
    .map((p) => {
      let cum = 0;
      return {
        player: refs.ref(p.id),
        points: grouped.get(p.id).map((x) => {
          cum += x.goals + x.assists;
          return {
            matchId: x.matchId,
            date: x.playedAt,
            rating: x.rating,
            goals: x.goals,
            assists: x.assists,
            cumulativeGA: cum,
          };
        }),
      };
    });

  return {
    totals: {
      matches: matches.length,
      goals: goalsTotal,
      assists: assistsTotal,
      goalsPerMatch: matches.length ? round(goalsTotal / matches.length) : null,
    },
    records: {
      highestScoringMatch: highest ? { total: highest.total, match: presentMatch(highest.m, refs) } : null,
      biggestWin: biggest ? { margin: biggest.margin, match: presentMatch(biggest.m, refs) } : null,
      mostGoalsInMatch: holders(perfs, 'goals', refs),
      mostAssistsInMatch: holders(perfs, 'assists', refs),
      mostMvp: mvp.rows.length ? { value: mvp.rows[0].value, leaders: mvp.rows.filter((r) => r.rank === 1) } : null,
      hatTricks: {
        total: hatTrickPerfs.length,
        byPlayer: [...hatByPlayer.entries()]
          .map(([id, count]) => ({ player: refs.ref(id), count }))
          .sort((a, b) => b.count - a.count || a.player.name.localeCompare(b.player.name)),
        recent: hatTrickPerfs
          .sort((a, b) => b.order - a.order)
          .slice(0, 5)
          .map((p) => ({ player: refs.ref(p.playerId), ...perfBrief(p) })),
      },
      longestWinStreak: streaks[0] ?? null,
      winStreaks: streaks.slice(0, 5),
      bestWinPercentage: winPct.rows.length ? { ranking: { minMatches: winPct.minMatches, relaxed: winPct.relaxed }, leaders: winPct.rows.filter((r) => r.rank === 1) } : null,
    },
    charts: {
      timeline,
      resultsDistribution: resultsDistribution(matches),
      performanceTrends: trends,
    },
  };
}

// ------------------------------------------------------------------ player profile

export function buildPlayerProfile({ player, matches, allMatches, refs }) {
  const perfs = buildPerformances(matches).filter((p) => p.playerId === player.id);
  const stats = summarize(perfs);
  const byMatch = new Map(matches.map((m) => [m.id, m]));

  const history = [...perfs].reverse().map((p) => {
    const m = byMatch.get(p.matchId);
    const mine = m.participants.filter((x) => x.side === p.side && x.playerId !== player.id);
    const theirs = m.participants.filter((x) => x.side !== p.side);
    return {
      ...perfBrief(p),
      seasonName: p.seasonName,
      side: p.side,
      slot: p.slot,
      teammates: mine.map((x) => refs.ref(x.playerId)),
      opponents: theirs.map((x) => refs.ref(x.playerId)),
    };
  });

  const allPerfs = buildPerformances(allMatches).filter((p) => p.playerId === player.id);
  const seasonsMap = new Map();
  for (const p of allPerfs) {
    if (!seasonsMap.has(p.seasonId)) seasonsMap.set(p.seasonId, { name: p.seasonName, perfs: [] });
    seasonsMap.get(p.seasonId).perfs.push(p);
  }
  const bySeason = [...seasonsMap.entries()].map(([seasonId, v]) => {
    const s = summarize(v.perfs);
    return {
      seasonId,
      seasonName: v.name,
      matches: s.matches,
      goals: s.goals,
      assists: s.assists,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      avgRating: s.avgRating,
      mvp: s.mvp,
    };
  });

  return {
    player: refs.ref(player.id),
    stats,
    history,
    ratingHistory: perfs.filter((p) => p.rating != null).map((p) => ({ matchId: p.matchId, date: p.playedAt, rating: p.rating })),
    contributionHistory: perfs.map((p) => ({ matchId: p.matchId, date: p.playedAt, goals: p.goals, assists: p.assists })),
    bySeason,
  };
}

// ------------------------------------------------------------------ comparison & head-to-head

function compareRow(key, label, a, b, format) {
  let better = null;
  if (a != null && b != null) better = a > b ? 'a' : b > a ? 'b' : 'tie';
  return { key, label, a, b, better, format };
}

export function buildComparison({ playerA, playerB, perfs, refs }) {
  if (playerA.id === playerB.id) throw new HttpError(400, 'Choose two different players.');
  const grouped = groupByPlayer(perfs);
  const sa = summarize(grouped.get(playerA.id) ?? []);
  const sb = summarize(grouped.get(playerB.id) ?? []);

  const fa = formPoints(sa.form) / Math.max(sa.form.length, 1);
  const fb = formPoints(sb.form) / Math.max(sb.form.length, 1);
  const formRow = {
    key: 'form',
    label: 'Recent form',
    a: sa.form,
    b: sb.form,
    better: !sa.form.length || !sb.form.length ? null : fa > fb ? 'a' : fb > fa ? 'b' : 'tie',
    format: 'form',
  };

  const rows = [
    compareRow('matches', 'Matches played', sa.matches, sb.matches, 'int'),
    compareRow('goals', 'Goals', sa.goals, sb.goals, 'int'),
    compareRow('assists', 'Assists', sa.assists, sb.assists, 'int'),
    compareRow('goalsAssists', 'Goals + assists', sa.goalsAssists, sb.goalsAssists, 'int'),
    compareRow('goalsPerMatch', 'Goals per match', sa.goalsPerMatch, sb.goalsPerMatch, 'dec'),
    compareRow('assistsPerMatch', 'Assists per match', sa.assistsPerMatch, sb.assistsPerMatch, 'dec'),
    compareRow('avgRating', 'Average rating', sa.avgRating, sb.avgRating, 'dec'),
    compareRow('mvp', 'MVP awards', sa.mvp, sb.mvp, 'int'),
    compareRow('wins', 'Wins', sa.wins, sb.wins, 'int'),
    compareRow('winPct', 'Win percentage', sa.winPct, sb.winPct, 'pct'),
    formRow,
  ];

  const trend = (id) =>
    (grouped.get(id) ?? []).map((p) => ({ matchId: p.matchId, date: p.playedAt, rating: p.rating, goals: p.goals, assists: p.assists }));

  return {
    a: { player: refs.ref(playerA.id), stats: sa, trend: trend(playerA.id) },
    b: { player: refs.ref(playerB.id), stats: sb, trend: trend(playerB.id) },
    rows,
  };
}

export function buildHeadToHead({ playerA, playerB, matches, refs }) {
  if (playerA.id === playerB.id) throw new HttpError(400, 'Choose two different players.');
  const meetings = [];
  for (const m of matches) {
    const pa = m.participants.find((p) => p.playerId === playerA.id);
    const pb = m.participants.find((p) => p.playerId === playerB.id);
    if (!pa || !pb || pa.side === pb.side) continue; // only opposite sides count
    meetings.push(m);
  }
  const perfs = buildPerformances(meetings);
  const grouped = groupByPlayer(perfs);
  const pa = grouped.get(playerA.id) ?? [];
  const pb = grouped.get(playerB.id) ?? [];
  const sa = summarize(pa);
  const sb = summarize(pb);

  const latest = [...meetings].reverse().slice(0, 10).map((m) => {
    const x = pa.find((p) => p.matchId === m.id);
    const y = pb.find((p) => p.matchId === m.id);
    return {
      match: presentMatch(m, refs),
      winner: x.result === 'W' ? 'a' : x.result === 'L' ? 'b' : 'draw',
      a: { side: x.side, goals: x.goals, assists: x.assists, rating: x.rating },
      b: { side: y.side, goals: y.goals, assists: y.assists, rating: y.rating },
    };
  });

  return {
    matches: meetings.length,
    a: {
      player: refs.ref(playerA.id),
      wins: sa.wins,
      draws: sa.draws,
      losses: sa.losses,
      winPct: sa.winPct,
      goals: sa.goals,
      assists: sa.assists,
      avgRating: sa.avgRating,
      ratedMatches: sa.ratedMatches,
    },
    b: {
      player: refs.ref(playerB.id),
      wins: sb.wins,
      draws: sb.draws,
      losses: sb.losses,
      winPct: sb.winPct,
      goals: sb.goals,
      assists: sb.assists,
      avgRating: sb.avgRating,
      ratedMatches: sb.ratedMatches,
    },
    draws: sa.draws,
    latest,
  };
}
