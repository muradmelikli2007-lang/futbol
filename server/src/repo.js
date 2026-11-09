import { HttpError } from './validate.js';

// ---------- seasons ----------

export function listSeasons(db) {
  return db
    .prepare(
      `SELECT s.id, s.name, s.created_at AS createdAt,
              (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id) AS matchCount
         FROM seasons s
        ORDER BY s.name COLLATE NOCASE DESC`,
    )
    .all();
}

export function getSeason(db, id) {
  return db.prepare('SELECT id, name FROM seasons WHERE id = ?').get(id);
}

export function createSeason(db, { name }) {
  try {
    const info = db.prepare('INSERT INTO seasons (name) VALUES (?)').run(name);
    return getSeason(db, info.lastInsertRowid);
  } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) throw new HttpError(409, `A season named "${name}" already exists.`);
    throw e;
  }
}

export function updateSeason(db, id, { name }) {
  if (!getSeason(db, id)) throw new HttpError(404, 'Season not found.');
  try {
    db.prepare('UPDATE seasons SET name = ? WHERE id = ?').run(name, id);
  } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) throw new HttpError(409, `A season named "${name}" already exists.`);
    throw e;
  }
  return getSeason(db, id);
}

export function deleteSeason(db, id) {
  if (!getSeason(db, id)) throw new HttpError(404, 'Season not found.');
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM matches WHERE season_id = ?').get(id);
  if (n > 0) {
    throw new HttpError(
      409,
      `This season has ${n} match${n === 1 ? '' : 'es'}. Move them to another season or delete them first.`,
    );
  }
  db.prepare('DELETE FROM seasons WHERE id = ?').run(id);
}

// ---------- players ----------

const PLAYER_COLS = `id, name, position, created_at AS createdAt,
  CASE WHEN photo IS NULL THEN NULL ELSE '/api/players/' || id || '/photo?v=' || photo_version END AS photoUrl`;

export function listPlayers(db) {
  return db.prepare(`SELECT ${PLAYER_COLS} FROM players ORDER BY name COLLATE NOCASE`).all();
}

export function getPlayer(db, id) {
  return db.prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`).get(id);
}

export function getPlayerPhoto(db, id) {
  return db.prepare('SELECT photo FROM players WHERE id = ?').get(id)?.photo ?? null;
}

export function createPlayer(db, { name, position, photo }) {
  try {
    const info = db
      .prepare('INSERT INTO players (name, position, photo, photo_version) VALUES (?, ?, ?, ?)')
      .run(name, position, photo ?? null, photo ? 1 : 0);
    return getPlayer(db, info.lastInsertRowid);
  } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) throw new HttpError(409, `A player named "${name}" already exists.`);
    throw e;
  }
}

export function updatePlayer(db, id, { name, position, photo }) {
  if (!getPlayer(db, id)) throw new HttpError(404, 'Player not found.');
  try {
    db.prepare('UPDATE players SET name = ?, position = ? WHERE id = ?').run(name, position, id);
    if (photo !== undefined) {
      db.prepare('UPDATE players SET photo = ?, photo_version = photo_version + 1 WHERE id = ?').run(photo, id);
    }
  } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) throw new HttpError(409, `A player named "${name}" already exists.`);
    throw e;
  }
  return getPlayer(db, id);
}

export function deletePlayer(db, id) {
  if (!getPlayer(db, id)) throw new HttpError(404, 'Player not found.');
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM match_players WHERE player_id = ?').get(id);
  if (n > 0) {
    throw new HttpError(
      409,
      `This player appears in ${n} recorded match${n === 1 ? '' : 'es'}. ` +
        'Deleting them would break those matches, so delete or edit the matches first.',
    );
  }
  db.prepare('DELETE FROM players WHERE id = ?').run(id);
}

export function playerIdSet(db) {
  return new Set(db.prepare('SELECT id FROM players').all().map((r) => r.id));
}

// ---------- matches ----------

/**
 * Loads raw matches (optionally for one season) with participants and goals attached.
 * Scores are derived here from the goal events.
 */
export function loadMatches(db, seasonId = null) {
  const where = seasonId == null ? '' : 'WHERE m.season_id = ?';
  const args = seasonId == null ? [] : [seasonId];
  const matches = db
    .prepare(
      `SELECT m.id, m.season_id AS seasonId, s.name AS seasonName, m.played_at AS playedAt,
              m.formation_a AS formationA, m.formation_b AS formationB,
              m.mvp_player_id AS mvpPlayerId, m.notes
         FROM matches m JOIN seasons s ON s.id = m.season_id
         ${where}
        ORDER BY m.played_at ASC, m.id ASC`,
    )
    .all(...args);
  if (!matches.length) return [];

  const byId = new Map(matches.map((m) => [m.id, { ...m, participants: [], goals: [], scoreA: 0, scoreB: 0 }]));

  const parts = db
    .prepare(
      `SELECT mp.match_id AS matchId, mp.player_id AS playerId, mp.side, mp.slot, mp.rating
         FROM match_players mp
         ${seasonId == null ? '' : 'JOIN matches m ON m.id = mp.match_id WHERE m.season_id = ?'}
        ORDER BY mp.side, COALESCE(mp.slot, 99), mp.player_id`,
    )
    .all(...args);
  for (const p of parts) byId.get(p.matchId)?.participants.push({
    playerId: p.playerId, side: p.side, slot: p.slot, rating: p.rating,
  });

  const goals = db
    .prepare(
      `SELECT g.id, g.match_id AS matchId, g.side, g.scorer_id AS scorerId, g.assist_id AS assistId,
              g.minute, g.seq
         FROM goals g
         ${seasonId == null ? '' : 'JOIN matches m ON m.id = g.match_id WHERE m.season_id = ?'}
        ORDER BY g.seq`,
    )
    .all(...args);
  for (const g of goals) {
    const m = byId.get(g.matchId);
    if (!m) continue;
    m.goals.push({ id: g.id, side: g.side, scorerId: g.scorerId, assistId: g.assistId, minute: g.minute, seq: g.seq });
    if (g.side === 'A') m.scoreA += 1;
    else m.scoreB += 1;
  }
  return [...byId.values()];
}

export function getMatchRaw(db, id) {
  const row = db.prepare('SELECT season_id AS seasonId FROM matches WHERE id = ?').get(id);
  if (!row) return null;
  return loadMatches(db, row.seasonId).find((m) => m.id === id) ?? null;
}

function writeMatchChildren(db, matchId, data) {
  const insPart = db.prepare(
    'INSERT INTO match_players (match_id, player_id, side, slot, rating) VALUES (?, ?, ?, ?, ?)',
  );
  for (const p of data.participants) insPart.run(matchId, p.playerId, p.side, p.slot, p.rating);

  // Keep goals in chronological order: by minute when known, otherwise as entered.
  const ordered = data.goals
    .map((g, i) => ({ ...g, i }))
    .sort((a, b) => (a.minute ?? 1e9) - (b.minute ?? 1e9) || a.i - b.i);
  const insGoal = db.prepare(
    'INSERT INTO goals (match_id, side, scorer_id, assist_id, minute, seq) VALUES (?, ?, ?, ?, ?, ?)',
  );
  ordered.forEach((g, seq) => insGoal.run(matchId, g.side, g.scorerId, g.assistId, g.minute, seq));
}

export function createMatch(db, data) {
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO matches (season_id, played_at, formation_a, formation_b, mvp_player_id, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(data.seasonId, data.playedAt, data.formationA, data.formationB, data.mvpPlayerId, data.notes);
    const id = Number(info.lastInsertRowid);
    writeMatchChildren(db, id, data);
    return id;
  });
  return tx();
}

export function updateMatch(db, id, data) {
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `UPDATE matches SET season_id = ?, played_at = ?, formation_a = ?, formation_b = ?,
                mvp_player_id = ?, notes = ?, updated_at = datetime('now')
          WHERE id = ?`,
      )
      .run(data.seasonId, data.playedAt, data.formationA, data.formationB, data.mvpPlayerId, data.notes, id);
    if (info.changes === 0) throw new HttpError(404, 'Match not found.');
    db.prepare('DELETE FROM goals WHERE match_id = ?').run(id);
    db.prepare('DELETE FROM match_players WHERE match_id = ?').run(id);
    writeMatchChildren(db, id, data);
  });
  tx();
}

export function deleteMatch(db, id) {
  const info = db.prepare('DELETE FROM matches WHERE id = ?').run(id); // children cascade
  if (info.changes === 0) throw new HttpError(404, 'Match not found.');
}
