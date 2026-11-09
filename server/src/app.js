import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import * as repo from './repo.js';
import { FORMATIONS, POSITIONS, SIDE_SIZE } from './formations.js';
import {
  HttpError,
  validateMatchInput,
  validatePlayerInput,
  validateSeasonInput,
} from './validate.js';
import {
  DEFAULT_MIN_MATCHES,
  POINTS,
  buildComparison,
  buildDashboard,
  buildHeadToHead,
  buildPerformances,
  buildPlayerProfile,
  buildRanking,
  buildStatistics,
  filterMatches,
  makeRefs,
  presentMatch,
  rankingList,
  statsByPlayer,
} from './stats.js';

function toId(raw, what = 'id') {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${what}.`);
  return n;
}

function optionalId(raw, what) {
  if (raw === undefined || raw === '') return null;
  return toId(raw, what);
}

export function createApp(db, { clientDist } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Wraps a handler so thrown errors reach the error middleware and returned values become JSON.
  const h = (fn) => (req, res, next) => {
    try {
      const out = fn(req, res);
      if (out !== undefined) res.json(out);
    } catch (e) {
      next(e);
    }
  };

  /** Loads everything a stats endpoint needs, scoped to one season or all-time. */
  function context(rawSeason) {
    let seasonId = null;
    let season = null;
    if (rawSeason !== undefined && rawSeason !== '' && rawSeason !== 'all') {
      seasonId = toId(rawSeason, 'season');
      season = repo.getSeason(db, seasonId);
      if (!season) throw new HttpError(404, 'Season not found.');
    }
    const players = repo.listPlayers(db);
    const refs = makeRefs(players);
    const matches = repo.loadMatches(db, seasonId);
    const perfs = buildPerformances(matches);
    const statsMap = statsByPlayer(players, perfs);
    return { season, players, refs, matches, perfs, statsMap };
  }

  const matchFormData = (m) => ({
    seasonId: m.seasonId,
    playedAt: m.playedAt,
    formationA: m.formationA,
    formationB: m.formationB,
    notes: m.notes,
    mvpPlayerId: m.mvpPlayerId,
    participants: m.participants.map((p) => ({ playerId: p.playerId, side: p.side, slot: p.slot, rating: p.rating })),
    goals: m.goals.map((g) => ({ side: g.side, scorerId: g.scorerId, assistId: g.assistId, minute: g.minute })),
  });

  // ---------------------------------------------------------------- meta
  app.get('/api/health', h(() => ({ ok: true })));
  app.get(
    '/api/meta',
    h(() => ({
      formations: FORMATIONS,
      positions: POSITIONS,
      sideSize: SIDE_SIZE,
      points: POINTS,
      defaultMinMatches: DEFAULT_MIN_MATCHES,
      rankings: rankingList(),
    })),
  );

  // ---------------------------------------------------------------- seasons
  app.get('/api/seasons', h(() => repo.listSeasons(db)));
  app.post('/api/seasons', h((req, res) => {
    res.status(201).json(repo.createSeason(db, validateSeasonInput(req.body)));
  }));
  app.put('/api/seasons/:id', h((req) => repo.updateSeason(db, toId(req.params.id), validateSeasonInput(req.body))));
  app.delete('/api/seasons/:id', h((req, res) => {
    repo.deleteSeason(db, toId(req.params.id));
    res.status(204).end();
  }));

  // ---------------------------------------------------------------- players
  app.get('/api/players', h((req) => {
    const { season, players, statsMap } = context(req.query.season);
    return { season, players: players.map((p) => ({ ...p, stats: statsMap.get(p.id) })) };
  }));

  app.get('/api/players/:id/photo', (req, res, next) => {
    try {
      const photo = repo.getPlayerPhoto(db, toId(req.params.id));
      const m = photo && /^data:(image\/[a-z+]+);base64,(.*)$/s.exec(photo);
      if (!m) throw new HttpError(404, 'No photo.');
      res.set('Content-Type', m[1]);
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(Buffer.from(m[2], 'base64'));
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/players/:id', h((req) => {
    const id = toId(req.params.id);
    const player = repo.getPlayer(db, id);
    if (!player) throw new HttpError(404, 'Player not found.');
    const { season, matches, refs } = context(req.query.season);
    const allMatches = season ? repo.loadMatches(db, null) : matches;
    return { season, ...buildPlayerProfile({ player, matches, allMatches, refs }) };
  }));

  app.post('/api/players', h((req, res) => {
    res.status(201).json(repo.createPlayer(db, validatePlayerInput(req.body)));
  }));
  app.put('/api/players/:id', h((req) => repo.updatePlayer(db, toId(req.params.id), validatePlayerInput(req.body))));
  app.delete('/api/players/:id', h((req, res) => {
    repo.deletePlayer(db, toId(req.params.id));
    res.status(204).end();
  }));

  // ---------------------------------------------------------------- matches
  app.get('/api/matches', h((req) => {
    const { season, matches, refs } = context(req.query.season);
    const playerId = optionalId(req.query.player, 'player');
    const from = req.query.from || undefined;
    const to = req.query.to || undefined;
    const result = req.query.result || undefined;
    const filtered = filterMatches(matches, { playerId, result, from, to });
    return {
      season,
      count: filtered.length,
      matches: [...filtered].reverse().map((m) => presentMatch(m, refs)),
    };
  }));

  app.get('/api/matches/:id', h((req) => {
    const id = toId(req.params.id);
    const raw = repo.getMatchRaw(db, id);
    if (!raw) throw new HttpError(404, 'Match not found.');
    const refs = makeRefs(repo.listPlayers(db));
    return { match: presentMatch(raw, refs), form: matchFormData(raw) };
  }));

  const matchValidationContext = () => ({
    seasonExists: (id) => !!repo.getSeason(db, id),
    playerIds: repo.playerIdSet(db),
  });

  app.post('/api/matches', h((req, res) => {
    const data = validateMatchInput(req.body, matchValidationContext());
    const id = repo.createMatch(db, data);
    const refs = makeRefs(repo.listPlayers(db));
    res.status(201).json({ match: presentMatch(repo.getMatchRaw(db, id), refs) });
  }));

  app.put('/api/matches/:id', h((req) => {
    const id = toId(req.params.id);
    if (!repo.getMatchRaw(db, id)) throw new HttpError(404, 'Match not found.');
    const data = validateMatchInput(req.body, matchValidationContext());
    repo.updateMatch(db, id, data);
    const refs = makeRefs(repo.listPlayers(db));
    return { match: presentMatch(repo.getMatchRaw(db, id), refs) };
  }));

  app.delete('/api/matches/:id', h((req, res) => {
    repo.deleteMatch(db, toId(req.params.id));
    res.status(204).end();
  }));

  // ---------------------------------------------------------------- analytics
  app.get('/api/dashboard', h((req) => {
    const ctx = context(req.query.season);
    return { season: ctx.season, ...buildDashboard(ctx) };
  }));

  app.get('/api/rankings/:type', h((req) => {
    const ctx = context(req.query.season);
    const min = req.query.minMatches === undefined ? DEFAULT_MIN_MATCHES : Number(req.query.minMatches);
    if (!Number.isInteger(min) || min < 1 || min > 100) throw new HttpError(400, 'minMatches must be a whole number from 1 to 100.');
    return { season: ctx.season, ...buildRanking(req.params.type, ctx.players, ctx.statsMap, ctx.refs, min) };
  }));

  app.get('/api/statistics', h((req) => {
    const ctx = context(req.query.season);
    return { season: ctx.season, ...buildStatistics(ctx) };
  }));

  const pickTwo = (req, ctx) => {
    const a = toId(req.query.a, 'first player');
    const b = toId(req.query.b, 'second player');
    const playerA = ctx.players.find((p) => p.id === a);
    const playerB = ctx.players.find((p) => p.id === b);
    if (!playerA || !playerB) throw new HttpError(404, 'Player not found.');
    return { playerA, playerB };
  };

  app.get('/api/compare', h((req) => {
    const ctx = context(req.query.season);
    return { season: ctx.season, ...buildComparison({ ...pickTwo(req, ctx), perfs: ctx.perfs, refs: ctx.refs }) };
  }));

  app.get('/api/head-to-head', h((req) => {
    const ctx = context(req.query.season);
    return { season: ctx.season, ...buildHeadToHead({ ...pickTwo(req, ctx), matches: ctx.matches, refs: ctx.refs }) };
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // ---------------------------------------------------------------- static client (production)
  if (clientDist && fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  // ---------------------------------------------------------------- errors
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
