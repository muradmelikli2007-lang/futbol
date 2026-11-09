import { isFormation, SIDE_SIZE, POSITIONS } from './formations.js';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends HttpError {
  constructor(details) {
    super(400, details[0], details);
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const isInt = (v) => Number.isInteger(v);

function toNullableInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

function toNullableRating(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10) return NaN;
  return Math.round(n * 10) / 10;
}

export function validatePlayerInput(input) {
  const errors = [];
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (!name) errors.push('Player name is required.');
  if (name.length > 60) errors.push('Player name must be 60 characters or fewer.');
  const position = input?.position ?? 'ANY';
  if (!POSITIONS.includes(position)) errors.push('Invalid preferred position.');
  let photo; // undefined = leave unchanged, null = remove, string = replace
  if (input && 'photo' in input) {
    if (input.photo === null || input.photo === '') photo = null;
    else if (typeof input.photo === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(input.photo)) {
      if (input.photo.length > 700_000) errors.push('Photo is too large (max ~500 KB).');
      else photo = input.photo;
    } else errors.push('Photo must be a PNG, JPEG or WebP image.');
  }
  if (errors.length) throw new ValidationError(errors);
  return { name, position, photo };
}

export function validateSeasonInput(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const errors = [];
  if (!name) errors.push('Season name is required.');
  if (name.length > 60) errors.push('Season name must be 60 characters or fewer.');
  if (errors.length) throw new ValidationError(errors);
  return { name };
}

/**
 * Validates and normalises a match payload.
 * ctx.seasonExists(id) -> boolean, ctx.playerIds -> Set of existing player ids.
 */
export function validateMatchInput(input, ctx) {
  const errors = [];
  if (!input || typeof input !== 'object') throw new ValidationError(['Match data is missing.']);

  const seasonId = Number(input.seasonId);
  if (!isInt(seasonId) || !ctx.seasonExists(seasonId)) errors.push('Select a valid season.');

  if (!isValidDate(input.playedAt)) errors.push('Match date must be a valid date (YYYY-MM-DD).');

  if (!isFormation(input.formationA)) errors.push('Select a valid formation for Side A.');
  if (!isFormation(input.formationB)) errors.push('Select a valid formation for Side B.');

  // ---- participants ----
  const participants = [];
  const rawParts = Array.isArray(input.participants) ? input.participants : [];
  if (rawParts.length !== SIDE_SIZE * 2) {
    errors.push(`A match needs exactly ${SIDE_SIZE * 2} different players (got ${rawParts.length}).`);
  }
  const seen = new Map();
  const slotsUsed = { A: new Set(), B: new Set() };
  for (const raw of rawParts) {
    const playerId = Number(raw?.playerId);
    const side = raw?.side;
    if (!isInt(playerId) || !ctx.playerIds.has(playerId)) {
      errors.push('One of the selected players does not exist.');
      continue;
    }
    if (side !== 'A' && side !== 'B') {
      errors.push('Every player must be assigned to Side A or Side B.');
      continue;
    }
    if (seen.has(playerId)) {
      errors.push(
        seen.get(playerId) === side
          ? 'The same player is selected twice.'
          : 'A player cannot appear on both sides of the same match.',
      );
      continue;
    }
    seen.set(playerId, side);

    const slot = toNullableInt(raw.slot);
    if (Number.isNaN(slot) || (slot !== null && (slot < 0 || slot > SIDE_SIZE - 1))) {
      errors.push('Invalid pitch position.');
      continue;
    }
    if (slot !== null) {
      if (slotsUsed[side].has(slot)) {
        errors.push(`Two players on Side ${side} share the same pitch position.`);
        continue;
      }
      slotsUsed[side].add(slot);
    }

    const rating = toNullableRating(raw.rating);
    if (Number.isNaN(rating)) {
      errors.push('Ratings must be numbers between 0 and 10.');
      continue;
    }
    participants.push({ playerId, side, slot, rating });
  }
  // Count from `seen` (every valid, unique player) so a wrong split is reported
  // even when another problem, such as a clashing pitch position, was also found.
  if (seen.size === SIDE_SIZE * 2) {
    for (const side of ['A', 'B']) {
      const n = [...seen.values()].filter((s) => s === side).length;
      if (n !== SIDE_SIZE) errors.push(`Side ${side} must have exactly ${SIDE_SIZE} players (has ${n}).`);
    }
  }

  const sideOf = new Map(participants.map((p) => [p.playerId, p.side]));

  // ---- goals ----
  const goals = [];
  const rawGoals = Array.isArray(input.goals) ? input.goals : [];
  rawGoals.forEach((raw, i) => {
    const n = i + 1;
    const side = raw?.side;
    const scorerId = Number(raw?.scorerId);
    const assistId = toNullableInt(raw?.assistId);
    const minute = toNullableInt(raw?.minute);
    if (side !== 'A' && side !== 'B') return errors.push(`Goal ${n}: choose the scoring side.`);
    if (!isInt(scorerId) || sideOf.get(scorerId) !== side) {
      return errors.push(`Goal ${n}: the scorer must be a player on Side ${side}.`);
    }
    if (Number.isNaN(assistId)) return errors.push(`Goal ${n}: invalid assist provider.`);
    if (assistId !== null) {
      if (assistId === scorerId) return errors.push(`Goal ${n}: a player cannot assist their own goal.`);
      if (sideOf.get(assistId) !== side) {
        return errors.push(`Goal ${n}: the assist provider must be on the same side as the scorer.`);
      }
    }
    if (Number.isNaN(minute) || (minute !== null && (minute < 0 || minute > 120))) {
      return errors.push(`Goal ${n}: the goal time must be a minute between 0 and 120.`);
    }
    goals.push({ side, scorerId, assistId, minute });
  });

  const scoreA = goals.filter((g) => g.side === 'A').length;
  const scoreB = goals.filter((g) => g.side === 'B').length;

  // The final score is derived from the goal events. If the client sends one, it must agree.
  for (const [key, derived, side] of [['scoreA', scoreA, 'A'], ['scoreB', scoreB, 'B']]) {
    if (input[key] !== undefined && input[key] !== null && input[key] !== '') {
      if (Number(input[key]) !== derived) {
        errors.push(
          `Side ${side}'s score (${input[key]}) does not match its recorded goals (${derived}). ` +
            'Add or remove goal events so they agree.',
        );
      }
    }
  }

  // ---- MVP, notes ----
  const mvpPlayerId = toNullableInt(input.mvpPlayerId);
  if (Number.isNaN(mvpPlayerId) || (mvpPlayerId !== null && !sideOf.has(mvpPlayerId))) {
    errors.push('The MVP must be one of the 12 players in the match.');
  }
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > 2000) errors.push('Match notes must be 2000 characters or fewer.');

  if (errors.length) throw new ValidationError([...new Set(errors)]);

  return {
    seasonId,
    playedAt: input.playedAt,
    formationA: input.formationA,
    formationB: input.formationB,
    mvpPlayerId,
    notes,
    participants,
    goals,
  };
}
