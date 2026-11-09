import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Scores are NOT stored: they are always derived from the goal events,
// so the score and the event list can never disagree.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS seasons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  position       TEXT NOT NULL DEFAULT 'ANY' CHECK (position IN ('GK','DEF','MID','FWD','ANY')),
  photo          TEXT,
  photo_version  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matches (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id      INTEGER NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  played_at      TEXT NOT NULL,
  formation_a    TEXT NOT NULL,
  formation_b    TEXT NOT NULL,
  mvp_player_id  INTEGER REFERENCES players(id) ON DELETE RESTRICT,
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_matches_season ON matches(season_id);
CREATE INDEX IF NOT EXISTS ix_matches_date ON matches(played_at);

-- (match_id, player_id) is the primary key, so one player can never appear twice in a match
-- (and therefore never on both sides).
CREATE TABLE IF NOT EXISTS match_players (
  match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  side       TEXT NOT NULL CHECK (side IN ('A','B')),
  slot       INTEGER CHECK (slot BETWEEN 0 AND 5),
  rating     REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  PRIMARY KEY (match_id, player_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_match_slot
  ON match_players(match_id, side, slot) WHERE slot IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_match_players_player ON match_players(player_id);

CREATE TABLE IF NOT EXISTS goals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  side        TEXT NOT NULL CHECK (side IN ('A','B')),
  scorer_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  assist_id   INTEGER REFERENCES players(id) ON DELETE RESTRICT,
  minute      INTEGER CHECK (minute IS NULL OR (minute >= 0 AND minute <= 120)),
  seq         INTEGER NOT NULL,
  CHECK (assist_id IS NULL OR assist_id <> scorer_id)
);
CREATE INDEX IF NOT EXISTS ix_goals_match ON goals(match_id);
`;

export function openDb(file) {
  const target = file ?? process.env.DB_PATH ?? path.join(here, '..', 'data', 'football.db');
  if (target !== ':memory:') fs.mkdirSync(path.dirname(target), { recursive: true });
  const db = new Database(target);
  if (target !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
