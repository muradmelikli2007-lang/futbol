import type { PlayerRef, Side } from '../types';
import { Avatar } from './ui';

/** Where each of the 6 slots sits for the side defending the top goal. Slot 0 is the goalkeeper. */
export interface SlotSpot {
  slot: number;
  /** across the pitch, 0-100 */
  x: number;
  /** distance down from the top goal line, as a percentage of the whole pitch height (0-50 = own half) */
  y: number;
  label: string;
}

const LINE_NAMES: Record<number, string[]> = {
  1: ['Outfield'],
  2: ['Defence', 'Attack'],
  3: ['Defence', 'Midfield', 'Attack'],
};

export function layoutSlots(lines: number[]): SlotSpot[] {
  const names = LINE_NAMES[lines.length] ?? lines.map((_, i) => `Line ${i + 1}`);
  const spots: SlotSpot[] = [{ slot: 0, x: 50, y: 8.5, label: 'Goalkeeper' }];
  let slot = 1;
  lines.forEach((count, li) => {
    // Lines are spread between 20% and 41% of the pitch height, so the two sides' attackers stay clear of each other at the halfway line.
    const y = lines.length === 1 ? 31 : 20 + (li * (41 - 20)) / (lines.length - 1);
    for (let i = 0; i < count; i++) {
      const x = 12 + (76 * (i + 0.5)) / count;
      spots.push({ slot: slot++, x, y, label: count === 1 ? names[li] : `${names[li]} ${i + 1}` });
    }
  });
  return spots;
}

export function slotLabels(lines: number[]): string[] {
  return layoutSlots(lines).map((s) => s.label);
}

export interface PitchPlayer {
  player: PlayerRef;
  slot: number | null;
  rating?: number | null;
  goals?: number;
  assists?: number;
  isMvp?: boolean;
}

function PitchMarkings() {
  return (
    <svg className="pitch-lines" viewBox="0 0 400 620" preserveAspectRatio="none" aria-hidden="true">
      <rect x="10" y="10" width="380" height="600" rx="6" />
      <line x1="10" y1="310" x2="390" y2="310" />
      <circle cx="200" cy="310" r="46" />
      <circle cx="200" cy="310" r="3" className="dot" />
      {/* top box + goal */}
      <rect x="110" y="10" width="180" height="78" />
      <rect x="160" y="10" width="80" height="30" />
      <path d="M160 88 A40 40 0 0 0 240 88" />
      <rect x="170" y="2" width="60" height="8" className="goal" />
      {/* bottom box + goal */}
      <rect x="110" y="532" width="180" height="78" />
      <rect x="160" y="580" width="80" height="30" />
      <path d="M160 532 A40 40 0 0 1 240 532" />
      <rect x="170" y="610" width="60" height="8" className="goal" />
    </svg>
  );
}

/**
 * Both sides on one pitch. Side A defends the top goal and attacks downwards, Side B the reverse.
 * With `onSlotClick` the empty spots and players become buttons (used by the match editor).
 */
export default function Pitch({
  formationA,
  formationB,
  formations,
  playersA,
  playersB,
  onSlotClick,
  compact,
}: {
  formationA: string;
  formationB: string;
  formations: Record<string, number[]>;
  playersA: PitchPlayer[];
  playersB: PitchPlayer[];
  onSlotClick?: (side: Side, slot: number) => void;
  compact?: boolean;
}) {
  const renderSide = (side: Side, formation: string, players: PitchPlayer[]) => {
    const lines = formations[formation] ?? [2, 2, 1];
    return layoutSlots(lines).map((spot) => {
      const p = players.find((x) => x.slot === spot.slot);
      // Side A sits in the top half, Side B is mirrored into the bottom half.
      const top = side === 'A' ? spot.y : 100 - spot.y;
      const style = { left: `${spot.x}%`, top: `${top}%` };
      const interactive = !!onSlotClick;
      const common = {
        style,
        className: `spot spot-${side} ${p ? 'filled' : 'empty'} ${interactive ? 'clickable' : ''}`,
      };
      const inner = p ? (
        <>
          <span className="spot-disc">
            <Avatar player={p.player} size={compact ? 34 : 42} />
            {p.rating != null && <span className="spot-rating num">{p.rating.toFixed(1)}</span>}
            {!!p.goals && (
              <span className="spot-goals num" title={`${p.goals} goal${p.goals === 1 ? '' : 's'}`}>
                {p.goals > 1 ? `${p.goals}` : ''}
                <i aria-hidden="true">&#9917;</i>
              </span>
            )}
            {p.isMvp && <span className="spot-mvp" title="MVP">&#9733;</span>}
          </span>
          <span className="spot-name">{p.player.name}</span>
        </>
      ) : (
        <>
          <span className="spot-disc spot-disc-empty">{interactive ? '+' : ''}</span>
          <span className="spot-name spot-name-empty">{spot.slot === 0 ? 'GK' : spot.label}</span>
        </>
      );
      return interactive ? (
        <button
          key={`${side}${spot.slot}`}
          type="button"
          {...common}
          onClick={() => onSlotClick!(side, spot.slot)}
          aria-label={`Side ${side}, ${spot.label}${p ? `: ${p.player.name}` : ': empty'}`}
        >
          {inner}
        </button>
      ) : (
        <div key={`${side}${spot.slot}`} {...common}>
          {inner}
        </div>
      );
    });
  };

  return (
    <div className={`pitch ${compact ? 'pitch-compact' : ''}`}>
      <PitchMarkings />
      <span className="pitch-tag pitch-tag-a">Side A &middot; {formationA}</span>
      <span className="pitch-tag pitch-tag-b">Side B &middot; {formationB}</span>
      {renderSide('A', formationA, playersA)}
      {renderSide('B', formationB, playersB)}
    </div>
  );
}
