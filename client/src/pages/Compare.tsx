import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChartFrame, COLORS, Lines, type Series } from '../components/charts';
import SeasonSelect from '../components/SeasonSelect';
import { Async, Avatar, EmptyState, Field, FormChips, PageHeader, Panel, RatingBadge, SegmentedControl, TugBar } from '../components/ui';
import { fmtDate, fmtNum, POSITION_LABEL } from '../format';
import { useApp } from '../state/app';
import { useApi } from '../state/useApi';
import type { CompareRow, Comparison, HeadToHead, PlayerWithStats, Result, Scope } from '../types';

type Mode = 'compare' | 'h2h';

const fmtRow = (row: CompareRow) => (n: number) => (row.format === 'pct' ? `${n.toFixed(1)}%` : row.format === 'dec' ? n.toFixed(2) : String(n));

function PlayerHead({ player, color, align }: { player: PlayerWithStats | undefined; color: string; align: 'left' | 'right' }) {
  if (!player) return <div className={`vs-head vs-${align}`} />;
  return (
    <Link to={`/players/${player.id}`} className={`vs-head vs-${align}`} style={{ ['--bib' as string]: color }}>
      <Avatar player={player} size={72} />
      <span className="vs-text">
        <span className="vs-name">{player.name}</span>
        <span className="muted">{POSITION_LABEL[player.position]}</span>
      </span>
    </Link>
  );
}

function CompareView({ a, b }: { a: number; b: number }) {
  const { seasonParam } = useApp();
  const { data, loading, error, reload } = useApi<Comparison>(`/api/compare?a=${a}&b=${b}&season=${seasonParam}`);

  const series: Series[] = useMemo(
    () => (data ? [{ key: 'a', label: data.a.player.name, color: COLORS.s1 }, { key: 'b', label: data.b.player.name, color: COLORS.s2 }] : []),
    [data],
  );

  // Both players' ratings on one chronology: every match either of them played, in order.
  const ratingRows = useMemo(() => {
    if (!data) return [];
    const ids = new Map<number, { date: string; a?: number | null; b?: number | null }>();
    for (const t of data.a.trend) ids.set(t.matchId, { date: t.date, a: t.rating, b: ids.get(t.matchId)?.b });
    for (const t of data.b.trend) ids.set(t.matchId, { date: t.date, a: ids.get(t.matchId)?.a, b: t.rating });
    return [...ids.entries()]
      .sort((x, y) => x[1].date.localeCompare(y[1].date) || x[0] - y[0])
      .map(([matchId, v], i) => ({ n: i + 1, matchId, date: v.date, a: v.a ?? null, b: v.b ?? null }));
  }, [data]);

  return (
    <Async data={data} loading={loading} error={error} reload={reload}>
      {(d) => {
        const empty = d.a.stats.matches === 0 && d.b.stats.matches === 0;
        if (empty) return <EmptyState title="Neither player has matches in this view">Switch to All time or pick another season.</EmptyState>;
        const wins = { a: 0, b: 0 };
        for (const r of d.rows) {
          if (r.better === 'a') wins.a += 1;
          if (r.better === 'b') wins.b += 1;
        }
        return (
          <div className="stack">
            <Panel>
              <div className="verdict" aria-live="polite">
                <span className="num verdict-n" style={{ color: COLORS.s1 }}>{wins.a}</span>
                <span className="muted">
                  categories led
                </span>
                <span className="num verdict-n" style={{ color: COLORS.s2 }}>{wins.b}</span>
              </div>
              <div className="compare-rows">
                {d.rows.map((r) => (
                  <div key={r.key} className="compare-row">
                    <span className="compare-label">{r.label}</span>
                    {r.format === 'form' ? (
                      <div className="compare-form">
                        <span className={r.better === 'a' ? 'is-better-box' : ''}>
                          <FormChips form={r.a as Result[]} size="sm" />
                        </span>
                        <span className={r.better === 'b' ? 'is-better-box' : ''}>
                          <FormChips form={r.b as Result[]} size="sm" />
                        </span>
                      </div>
                    ) : r.a === null || r.b === null ? (
                      <div className="compare-na">
                        <span className="num">{r.a === null ? '-' : fmtRow(r)(r.a as number)}</span>
                        <span className="muted fine">No rating to compare</span>
                        <span className="num">{r.b === null ? '-' : fmtRow(r)(r.b as number)}</span>
                      </div>
                    ) : (
                      <TugBar a={r.a as number} b={r.b as number} better={r.better} format={fmtRow(r)} />
                    )}
                  </div>
                ))}
              </div>
              <p className="muted fine">The stronger value in each row is highlighted. Matches without a rating are left out of average ratings.</p>
            </Panel>

            <ChartFrame
              title="Match ratings"
              subtitle="Each point is one match; a player has a point only for matches they were rated in"
              series={series}
              height={280}
              table={{ columns: ['Match', 'Date', d.a.player.name, d.b.player.name], rows: ratingRows.map((r) => [r.n, fmtDate(r.date), r.a === null ? null : r.a.toFixed(1), r.b === null ? null : r.b.toFixed(1)]) }}
            >
              {ratingRows.some((r) => r.a !== null || r.b !== null) ? (
                <Lines
                  data={ratingRows}
                  xKey="n"
                  series={series}
                  yDomain={[0, 10]}
                  xFormat={(v) => `#${v}`}
                  labelFormat={(_, row) => fmtDate(String(row?.date))}
                  valueFormat={(v) => v.toFixed(1)}
                />
              ) : (
                <p className="chart-empty">Neither player has ratings yet.</p>
              )}
            </ChartFrame>
          </div>
        );
      }}
    </Async>
  );
}

function H2HView({ a, b }: { a: number; b: number }) {
  const { seasonParam } = useApp();
  const { data, loading, error, reload } = useApi<HeadToHead>(`/api/head-to-head?a=${a}&b=${b}&season=${seasonParam}`);
  return (
    <Async data={data} loading={loading} error={error} reload={reload}>
      {(d) => {
        if (d.matches === 0) {
          return (
            <EmptyState title="No head-to-head matches yet">
              {d.a.player.name} and {d.b.player.name} have not played on opposite sides in this view. Matches where they were teammates are not counted.
            </EmptyState>
          );
        }
        const total = d.matches;
        const pa = (d.a.wins / total) * 100;
        const pd = (d.draws / total) * 100;
        const pb = (d.b.wins / total) * 100;
        const leader = d.a.wins === d.b.wins ? null : d.a.wins > d.b.wins ? d.a.player.name : d.b.player.name;
        const rows: { label: string; a: number | null; b: number | null; dec?: boolean }[] = [
          { label: 'Wins', a: d.a.wins, b: d.b.wins },
          { label: 'Goals scored', a: d.a.goals, b: d.b.goals },
          { label: 'Assists', a: d.a.assists, b: d.b.assists },
          { label: 'Average rating', a: d.a.avgRating, b: d.b.avgRating, dec: true },
        ];
        return (
          <div className="stack">
            <Panel>
              <div className="h2h-record">
                <div className="h2h-side">
                  <span className="num h2h-num" style={{ color: COLORS.s1 }}>{d.a.wins}</span>
                  <span className="muted">{d.a.player.name} wins</span>
                </div>
                <div className="h2h-side h2h-mid">
                  <span className="num h2h-num">{d.draws}</span>
                  <span className="muted">draws</span>
                </div>
                <div className="h2h-side">
                  <span className="num h2h-num" style={{ color: COLORS.s2 }}>{d.b.wins}</span>
                  <span className="muted">{d.b.player.name} wins</span>
                </div>
              </div>
              <div className="h2h-bar" role="img" aria-label={`Record over ${total} matches: ${d.a.wins} wins, ${d.draws} draws, ${d.b.wins} losses for ${d.a.player.name}`}>
                {pa > 0 && <span style={{ width: `${pa}%`, background: COLORS.s1 }} />}
                {pd > 0 && <span style={{ width: `${pd}%`, background: '#8b9d95' }} />}
                {pb > 0 && <span style={{ width: `${pb}%`, background: COLORS.s2 }} />}
              </div>
              <p className="sub h2h-summary">
                {total} match{total === 1 ? '' : 'es'} on opposite sides.{' '}
                {leader ? <><b>{leader}</b> leads the record.</> : 'The record is level.'}
              </p>
            </Panel>

            <Panel title="In these matches">
              <div className="compare-rows">
                {rows.map((r) => {
                  const better = r.a === null || r.b === null ? null : r.a > r.b ? 'a' : r.b > r.a ? 'b' : 'tie';
                  return (
                    <div key={r.label} className="compare-row">
                      <span className="compare-label">{r.label}</span>
                      {r.a === null || r.b === null ? (
                        <div className="compare-na">
                          <span className="num">{r.a === null ? '-' : fmtNum(r.a, 2)}</span>
                          <span className="muted fine">No rating to compare</span>
                          <span className="num">{r.b === null ? '-' : fmtNum(r.b, 2)}</span>
                        </div>
                      ) : (
                        <TugBar a={r.a} b={r.b} better={better as 'a' | 'b' | 'tie'} format={(n) => (r.dec ? n.toFixed(2) : String(n))} />
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Latest meetings" flush>
              <ul className="meetings">
                {d.latest.map((m) => (
                  <li key={m.match.id}>
                    <Link to={`/matches/${m.match.id}`} className="meeting">
                      <span className="meeting-date">{fmtDate(m.match.playedAt)}</span>
                      <span className="meeting-score num">
                        {m.match.scoreA}-{m.match.scoreB}
                      </span>
                      <span className="meeting-who">
                        {m.winner === 'draw' ? <span className="muted">Draw</span> : <b>{m.winner === 'a' ? d.a.player.name : d.b.player.name} won</b>}
                      </span>
                      <span className="meeting-lines muted">
                        <span style={{ color: COLORS.s1 }}>{d.a.player.name.split(' ')[0]}</span> {m.a.goals}G {m.a.assists}A <RatingBadge rating={m.a.rating} size="sm" />
                        {' · '}
                        <span style={{ color: COLORS.s2 }}>{d.b.player.name.split(' ')[0]}</span> {m.b.goals}G {m.b.assists}A <RatingBadge rating={m.b.rating} size="sm" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        );
      }}
    </Async>
  );
}

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mode') === 'h2h' ? 'h2h' : 'compare';
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';
  const players = useApi<Scope & { players: PlayerWithStats[] }>('/api/players?season=all');
  const list = players.data?.players ?? [];

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const pa = list.find((p) => String(p.id) === a);
  const pb = list.find((p) => String(p.id) === b);
  const ready = !!pa && !!pb && pa.id !== pb.id;

  return (
    <>
      <PageHeader
        title={mode === 'h2h' ? 'Head-to-head' : 'Player comparison'}
        subtitle={mode === 'h2h' ? 'How two players did in matches where they were on opposite sides.' : 'Two players side by side, over the selected season or all time.'}
        actions={
          <SegmentedControl
            label="Mode"
            value={mode}
            onChange={(m) => update({ mode: m === 'h2h' ? 'h2h' : '' })}
            options={[{ value: 'compare', label: 'Compare' }, { value: 'h2h', label: 'Head-to-head' }]}
          />
        }
      />

      <div className="filters">
        <Field label="First player" htmlFor="cmp-a">
          <select id="cmp-a" className="select" value={a} onChange={(e) => update({ a: e.target.value })}>
            <option value="">Choose a player</option>
            {list.map((p) => (
              <option key={p.id} value={p.id} disabled={String(p.id) === b}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" className="icon-btn swap-btn" aria-label="Swap players" onClick={() => update({ a: b, b: a })} disabled={!a && !b}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4" />
          </svg>
        </button>
        <Field label="Second player" htmlFor="cmp-b">
          <select id="cmp-b" className="select" value={b} onChange={(e) => update({ b: e.target.value })}>
            <option value="">Choose a player</option>
            {list.map((p) => (
              <option key={p.id} value={p.id} disabled={String(p.id) === a}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <SeasonSelect id="cmp-season" />
      </div>

      {players.loading && !players.data ? null : list.length < 2 ? (
        <EmptyState title="Add at least two players" action={<Link to="/players" className="btn btn-primary">Go to players</Link>}>
          Comparison needs two players with recorded matches.
        </EmptyState>
      ) : !ready ? (
        <EmptyState title="Choose two players">Pick a first and a second player above to see them side by side.</EmptyState>
      ) : (
        <div className="stack">
          <div className="vs">
            <PlayerHead player={pa} color={COLORS.s1} align="left" />
            <span className="vs-mark">vs</span>
            <PlayerHead player={pb} color={COLORS.s2} align="right" />
          </div>
          {mode === 'h2h' ? <H2HView a={pa.id} b={pb.id} /> : <CompareView a={pa.id} b={pb.id} />}
        </div>
      )}
    </>
  );
}
