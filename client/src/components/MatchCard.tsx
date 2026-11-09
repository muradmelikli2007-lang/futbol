import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../format';
import type { MatchView } from '../types';
import { Icon, RatingBadge } from './ui';

export function matchAverage(m: MatchView): number | null {
  const rated = [...m.sideA, ...m.sideB].map((p) => p.rating).filter((r): r is number => r != null);
  if (!rated.length) return null;
  return Math.round((rated.reduce((s, r) => s + r, 0) / rated.length) * 100) / 100;
}

function Names({ players, mvpId }: { players: MatchView['sideA']; mvpId?: number }) {
  return (
    <ul className="names">
      {players.map((p) => (
        <li key={p.player.id} className={p.player.id === mvpId ? 'is-mvp' : undefined}>
          {p.player.name}
          {p.goals > 0 && (
            <span className="names-goals num">
              {' '}
              {p.goals > 1 ? `${p.goals}x` : ''}&#9917;
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function MatchCard({
  match: m,
  showSeason = true,
  actions,
}: {
  match: MatchView;
  showSeason?: boolean;
  /** Buttons shown top right. They sit outside the link so they stay valid HTML. */
  actions?: ReactNode;
}) {
  const avg = matchAverage(m);
  return (
    <article className="match-card">
      {actions && <div className="match-card-actions">{actions}</div>}
      <Link to={`/matches/${m.id}`} className="match-card-link" aria-label={`Open match on ${fmtDate(m.playedAt)}, ${m.scoreA} to ${m.scoreB}`}>
        <div className="match-card-meta">
          <span>{fmtDate(m.playedAt)}</span>
          {showSeason && <span className="muted">{m.seasonName}</span>}
        </div>
        <div className="match-card-body">
          <div className={`mc-side mc-a ${m.result === 'A' ? 'won' : ''}`}>
            <span className="mc-side-title">Side A</span>
            <Names players={m.sideA} mvpId={m.mvp?.id} />
          </div>
          <div className="mc-score num" aria-hidden="true">
            <span className={m.result === 'A' ? 'win' : m.result === 'draw' ? 'draw' : ''}>{m.scoreA}</span>
            <span className="mc-dash">-</span>
            <span className={m.result === 'B' ? 'win' : m.result === 'draw' ? 'draw' : ''}>{m.scoreB}</span>
          </div>
          <div className={`mc-side mc-b ${m.result === 'B' ? 'won' : ''}`}>
            <span className="mc-side-title">Side B</span>
            <Names players={m.sideB} mvpId={m.mvp?.id} />
          </div>
        </div>
        <div className="match-card-foot">
          {m.mvp ? (
            <span className="foot-item">
              <Icon name="star" size={14} className="gold" /> MVP <b>{m.mvp.name}</b>
            </span>
          ) : (
            <span className="foot-item muted">No MVP picked</span>
          )}
          {m.bestRated ? (
            <span className="foot-item">
              Top rated <b>{m.bestRated.player.name}</b> <RatingBadge rating={m.bestRated.rating} size="sm" />
            </span>
          ) : (
            <span className="foot-item muted">No ratings</span>
          )}
          {avg !== null && (
            <span className="foot-item muted">
              Average {avg.toFixed(1)} from {m.ratedCount} rating{m.ratedCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
