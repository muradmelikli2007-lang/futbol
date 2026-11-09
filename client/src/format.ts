import type { Position } from './types';

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const fmtDate = (iso: string) => dateFmt.format(asDate(iso));
export const fmtShort = (iso: string) => shortFmt.format(asDate(iso));
export const fmtLong = (iso: string) => longFmt.format(asDate(iso));

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Numbers from the API; null means "no data", never zero. */
export function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return '-';
  return decimals > 0 ? n.toFixed(decimals) : String(n);
}

export const fmtPct = (n: number | null | undefined) => (n === null || n === undefined ? '-' : `${n.toFixed(1)}%`);

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase();
}

export type RatingTone = 'elite' | 'great' | 'good' | 'fair' | 'poor';
export function ratingTone(r: number): RatingTone {
  if (r >= 8.5) return 'elite';
  if (r >= 7.5) return 'great';
  if (r >= 6.5) return 'good';
  if (r >= 5.5) return 'fair';
  return 'poor';
}

export const POSITION_LABEL: Record<Position, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
  ANY: 'Any position',
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
