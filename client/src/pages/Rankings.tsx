import { useMemo, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import SeasonSelect from '../components/SeasonSelect';
import { Async, Avatar, EmptyState, Field, FormChips, PageHeader, RatingBadge } from '../components/ui';
import { fmtNum, fmtPct, POSITION_LABEL } from '../format';
import { useApp } from '../state/app';
import { useApi } from '../state/useApi';
import type { Ranking, RankingRow } from '../types';

type ColKey = 'matches' | 'goals' | 'assists' | 'goalsAssists' | 'avgRating' | 'mvp' | 'wins' | 'winPct' | 'avgPoints';

const COLS: { key: ColKey; label: string; render: (r: RankingRow) => string }[] = [
  { key: 'matches', label: 'Played', render: (r) => String(r.stats.matches) },
  { key: 'goals', label: 'Goals', render: (r) => String(r.stats.goals) },
  { key: 'assists', label: 'Assists', render: (r) => String(r.stats.assists) },
  { key: 'goalsAssists', label: 'G+A', render: (r) => String(r.stats.goalsAssists) },
  { key: 'avgRating', label: 'Rating', render: (r) => fmtNum(r.stats.avgRating, 2) },
  { key: 'mvp', label: 'MVP', render: (r) => String(r.stats.mvp) },
  { key: 'wins', label: 'Wins', render: (r) => String(r.stats.wins) },
  { key: 'winPct', label: 'Win %', render: (r) => fmtPct(r.stats.winPct) },
  { key: 'avgPoints', label: 'Score', render: (r) => fmtNum(r.stats.avgPoints, 2) },
];

const TAB_LABEL: Record<string, string> = {
  'top-scorers': 'Top scorers',
  'top-assists': 'Top assists',
  'goals-assists': 'Goals + assists',
  'best-rating': 'Best rating',
  'most-mvp': 'Most MVPs',
  'most-wins': 'Most wins',
  'win-percentage': 'Win percentage',
  'best-players': 'Best players',
};

const MEDAL = ['gold', 'silver', 'bronze'];

export default function Rankings() {
  const { type = 'top-scorers' } = useParams();
  const { seasonParam, meta, scopeLabel, seasonKey } = useApp();
  const [minMatches, setMinMatches] = useState<number>(meta?.defaultMinMatches ?? 3);
  const [sortKey, setSortKey] = useState<ColKey | null>(null);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const { data, loading, error, reload } = useApi<Ranking>(`/api/rankings/${type}?season=${seasonParam}&minMatches=${minMatches}`);

  const rows = useMemo(() => {
    if (!data) return [];
    if (!sortKey) return data.rows;
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...data.rows].sort((a, b) => {
      const av = a.stats[sortKey];
      const bv = b.stats[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir || a.rank - b.rank;
    });
  }, [data, sortKey, sortDir]);

  const toggleSort = (k: ColKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  const title = type === 'best-players' && seasonKey !== 'all' ? `Best players of ${scopeLabel}` : (meta?.rankings.find((r) => r.type === type)?.label ?? 'Rankings');
  const podium = data ? data.rows.filter((r) => r.rank <= 3).slice(0, 3) : [];

  return (
    <>
      <PageHeader title={title} subtitle={data?.description} />

      <nav className="tabs" aria-label="Rankings">
        {(meta?.rankings ?? []).map((r) => (
          <NavLink key={r.type} to={`/rankings/${r.type}`} className={({ isActive }) => (isActive ? 'active' : undefined)} onClick={() => setSortKey(null)}>
            {TAB_LABEL[r.type] ?? r.label}
          </NavLink>
        ))}
      </nav>

      <div className="filters">
        <SeasonSelect id="r-season" />
        {data && data.minMatchesRequested !== null && (
          <Field label="Minimum matches" htmlFor="r-min" hint={type === 'best-rating' ? 'Counts rated matches only' : undefined}>
            <input
              id="r-min"
              className="input"
              type="number"
              min={1}
              max={100}
              value={minMatches}
              onChange={(e) => setMinMatches(Math.max(1, Math.min(100, Math.round(Number(e.target.value)) || 1)))}
            />
          </Field>
        )}
      </div>

      <Async data={data} loading={loading} error={error} reload={reload}>
        {(d) => {
          if (d.rows.length === 0) {
            return (
              <EmptyState title="Nobody ranks here yet">
                {d.minMatchesRequested !== null
                  ? `No player has ${minMatches} or more ${type === 'best-rating' ? 'rated ' : ''}matches in this view. Lower the minimum, or record more matches.`
                  : 'Record a match, and this table fills itself in.'}
              </EmptyState>
            );
          }
          return (
            <div className="stack">
              {d.relaxed && (
                <p className="notice">
                  Nobody has {d.minMatchesRequested} {type === 'best-rating' ? 'rated ' : ''}matches yet, so every player with at least one is shown.
                </p>
              )}

              <ol className="podium">
                {podium.map((r, i) => (
                  <li key={r.player.id} className={`podium-card podium-${MEDAL[r.rank - 1] ?? 'gold'}`} style={{ order: podium.length === 3 ? [1, 0, 2][i] : i }}>
                    <Link to={`/players/${r.player.id}`} className="podium-link">
                      <span className="podium-rank num">{r.rank}</span>
                      <Avatar player={r.player} size={64} />
                      <span className="podium-name">{r.player.name}</span>
                      <span className="podium-value num">{fmtNum(r.value, d.decimals)}{type === 'win-percentage' ? '%' : ''}</span>
                      <span className="muted">{d.metric}</span>
                    </Link>
                  </li>
                ))}
              </ol>

              <div className="panel">
                <div className="table-wrap">
                  <table className="table rank-table">
                    <thead>
                      <tr>
                        <th className="rank">#</th>
                        <th className="left">Player</th>
                        <th className="main-col">{d.metric}</th>
                        {COLS.map((c) => (
                          <th key={c.key} className={sortKey === c.key ? 'sorted' : undefined} aria-sort={sortKey === c.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}>
                            <button type="button" onClick={() => toggleSort(c.key)} title={`Sort by ${c.label}`}>
                              {c.label}
                              {sortKey === c.key ? (sortDir === 'desc' ? ' ▾' : ' ▴') : ''}
                            </button>
                          </th>
                        ))}
                        <th className="left">Form</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.player.id} className={r.rank === 1 ? 'is-first' : undefined}>
                          <td className="rank num">{r.rank}</td>
                          <td className="left">
                            <Link to={`/players/${r.player.id}`} className="player-link">
                              <Avatar player={r.player} size={34} />
                              <span className="player-link-text">
                                <span className="player-link-name">{r.player.name}</span>
                                <span className="player-link-sub">{POSITION_LABEL[r.player.position]}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="num strong main-col">
                            {fmtNum(r.value, d.decimals)}
                            {type === 'win-percentage' ? '%' : ''}
                          </td>
                          {COLS.map((c) => (
                            <td key={c.key} className="num">
                              {c.key === 'avgRating' && r.stats.avgRating !== null ? <RatingBadge rating={r.stats.avgRating} size="sm" /> : c.render(r)}
                            </td>
                          ))}
                          <td className="left">
                            <FormChips form={r.stats.form} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="muted fine">
                Ties share a rank. Column headers sort the table; the # column always shows the official rank for this list.
                {d.minMatches !== null && ` Showing players with at least ${d.minMatches} ${type === 'best-rating' ? 'rated ' : ''}match${d.minMatches === 1 ? '' : 'es'}.`}
              </p>
            </div>
          );
        }}
      </Async>
    </>
  );
}
