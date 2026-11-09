import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bars, ChartFrame, COLORS, Lines, SERIES_ORDER, type Series } from '../components/charts';
import { Async, Avatar, EmptyState, PageHeader, Panel, RatingBadge, SegmentedControl, StatTile } from '../components/ui';
import { fmtDate, fmtNum, fmtPct, fmtShort } from '../format';
import { useApp } from '../state/app';
import { useApi } from '../state/useApi';
import type { MatchView, PerformanceBrief, Statistics } from '../types';

function ScoreLink({ m }: { m: MatchView }) {
  return (
    <Link to={`/matches/${m.id}`} className="record-link">
      <b className="num">
        {m.scoreA}-{m.scoreB}
      </b>
      <span className="muted">{fmtDate(m.playedAt)}</span>
    </Link>
  );
}

function Holders({ list }: { list: PerformanceBrief[] }) {
  return (
    <ul className="holders">
      {list.map((h) => (
        <li key={`${h.player.id}-${h.matchId}`}>
          <Link to={`/players/${h.player.id}`} className="player-link">
            <Avatar player={h.player} size={28} />
            <span className="player-link-name">{h.player.name}</span>
          </Link>
          <Link to={`/matches/${h.matchId}`} className="muted">
            {fmtShort(h.playedAt)} {h.playedAt.slice(0, 4)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Record({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="record">
      <dt>{label}</dt>
      {value !== undefined && <dd className="record-value num">{value}</dd>}
      {children && <dd className="record-extra">{children}</dd>}
    </div>
  );
}

type Mode = 'match' | 'total';
type TrendMetric = 'cumulativeGA' | 'rating';

export default function StatisticsPage() {
  const { seasonParam } = useApp();
  const { data, loading, error, reload } = useApi<Statistics>(`/api/statistics?season=${seasonParam}`);
  const [goalsMode, setGoalsMode] = useState<Mode>('match');
  const [assistsMode, setAssistsMode] = useState<Mode>('match');
  const [metric, setMetric] = useState<TrendMetric>('cumulativeGA');
  const [picked, setPicked] = useState<number[] | null>(null);

  const timeline = useMemo(() => (data?.charts.timeline ?? []).map((t, i) => ({ ...t, n: i + 1 })), [data]);

  // Default the trend chart to the three players with the most goals + assists.
  const topIds = useMemo(() => {
    if (!data) return [];
    return [...data.charts.performanceTrends]
      .sort((a, b) => (b.points.at(-1)?.cumulativeGA ?? 0) - (a.points.at(-1)?.cumulativeGA ?? 0))
      .slice(0, 3)
      .map((t) => t.player.id);
  }, [data]);
  const selected = picked ?? topIds;

  const trendSeries: Series[] = useMemo(
    () =>
      (data?.charts.performanceTrends ?? [])
        .filter((t) => selected.includes(t.player.id))
        .map((t) => ({ key: `p${t.player.id}`, label: t.player.name, color: SERIES_ORDER[selected.indexOf(t.player.id) % SERIES_ORDER.length] })),
    [data, selected],
  );

  const trendData = useMemo(() => {
    if (!data) return [];
    return timeline.map((t) => {
      const row: Record<string, unknown> = { n: t.n, date: t.date };
      for (const tr of data.charts.performanceTrends) {
        if (!selected.includes(tr.player.id)) continue;
        const pt = tr.points.find((p) => p.matchId === t.matchId);
        if (pt) row[`p${tr.player.id}`] = metric === 'rating' ? pt.rating : pt.cumulativeGA;
      }
      return row;
    });
  }, [data, timeline, selected, metric]);

  const toggle = (id: number) => {
    const cur = selected;
    if (cur.includes(id)) setPicked(cur.filter((x) => x !== id));
    else if (cur.length < 4) setPicked([...cur, id]);
  };

  return (
    <>
      <PageHeader title="Statistics" subtitle="Totals, records and trends, all counted from the recorded matches and goals." />
      <Async data={data} loading={loading} error={error} reload={reload}>
        {(d) => {
          if (d.totals.matches === 0) {
            return (
              <EmptyState title="No matches in this view" action={<Link to="/matches/new" className="btn btn-primary">Record a match</Link>}>
                Records and charts appear after the first match.
              </EmptyState>
            );
          }
          const r = d.records;
          const goalSeries: Series[] = [{ key: goalsMode === 'match' ? 'goals' : 'cumulativeGoals', label: goalsMode === 'match' ? 'Goals in match' : 'Total goals', color: COLORS.s1 }];
          const assistSeries: Series[] = [{ key: assistsMode === 'match' ? 'assists' : 'cumulativeAssists', label: assistsMode === 'match' ? 'Assists in match' : 'Total assists', color: COLORS.s3 }];
          const labelFmt = (_: string, row?: Record<string, unknown>) => `Match ${row?.n}, ${fmtDate(String(row?.date))}`;
          const resultBars: Series[] = [{ key: 'count', label: 'Matches', color: COLORS.s1 }];
          const sideBars: Series[] = [{ key: 'count', label: 'Matches', color: COLORS.s2 }];
          const sideData = [
            { label: 'Side A won', count: d.charts.resultsDistribution.sideWins.A },
            { label: 'Draw', count: d.charts.resultsDistribution.sideWins.draws },
            { label: 'Side B won', count: d.charts.resultsDistribution.sideWins.B },
          ];

          return (
            <div className="stack">
              <div className="grid cols-4">
                <StatTile label="Total matches" value={d.totals.matches} />
                <StatTile label="Total goals" value={d.totals.goals} hint={`${fmtNum(d.totals.goalsPerMatch, 1)} per match`} accent />
                <StatTile label="Total assists" value={d.totals.assists} accent />
                <StatTile label="Hat-tricks" value={r.hatTricks.total} hint="3 or more goals by one player" />
              </div>

              <Panel title="Records">
                <dl className="records">
                  <Record label="Highest-scoring match">
                    {r.highestScoringMatch && (
                      <>
                        <span className="record-value num">{r.highestScoringMatch.total} goals</span>
                        <ScoreLink m={r.highestScoringMatch.match} />
                      </>
                    )}
                  </Record>
                  <Record label="Biggest winning margin">
                    {r.biggestWin ? (
                      <>
                        <span className="record-value num">{r.biggestWin.margin} goals</span>
                        <ScoreLink m={r.biggestWin.match} />
                      </>
                    ) : (
                      <span className="muted">Every match so far was a draw</span>
                    )}
                  </Record>
                  <Record label="Most goals by one player in a match">
                    {r.mostGoalsInMatch ? (
                      <>
                        <span className="record-value num">{r.mostGoalsInMatch.value}</span>
                        <Holders list={r.mostGoalsInMatch.holders} />
                        {r.mostGoalsInMatch.count > r.mostGoalsInMatch.holders.length && <span className="muted fine">and {r.mostGoalsInMatch.count - r.mostGoalsInMatch.holders.length} more</span>}
                      </>
                    ) : (
                      <span className="muted">No goals yet</span>
                    )}
                  </Record>
                  <Record label="Most assists by one player in a match">
                    {r.mostAssistsInMatch ? (
                      <>
                        <span className="record-value num">{r.mostAssistsInMatch.value}</span>
                        <Holders list={r.mostAssistsInMatch.holders} />
                        {r.mostAssistsInMatch.count > r.mostAssistsInMatch.holders.length && <span className="muted fine">and {r.mostAssistsInMatch.count - r.mostAssistsInMatch.holders.length} more</span>}
                      </>
                    ) : (
                      <span className="muted">No assists yet</span>
                    )}
                  </Record>
                  <Record label="Most MVP awards">
                    {r.mostMvp ? (
                      <>
                        <span className="record-value num">{r.mostMvp.value}</span>
                        <ul className="holders">
                          {r.mostMvp.leaders.map((l) => (
                            <li key={l.player.id}>
                              <Link to={`/players/${l.player.id}`} className="player-link">
                                <Avatar player={l.player} size={28} />
                                <span className="player-link-name">{l.player.name}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <span className="muted">No MVP picked yet</span>
                    )}
                  </Record>
                  <Record label="Hat-tricks">
                    {r.hatTricks.total === 0 ? (
                      <span className="muted">None yet</span>
                    ) : (
                      <>
                        <span className="record-value num">{r.hatTricks.total}</span>
                        <ul className="holders">
                          {r.hatTricks.byPlayer.slice(0, 4).map((h) => (
                            <li key={h.player.id}>
                              <Link to={`/players/${h.player.id}`} className="player-link">
                                <Avatar player={h.player} size={28} />
                                <span className="player-link-name">{h.player.name}</span>
                              </Link>
                              <span className="num">{h.count}x</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </Record>
                  <Record label="Most consecutive wins">
                    {r.longestWinStreak ? (
                      <>
                        <span className="record-value num">{r.longestWinStreak.length}</span>
                        <ul className="holders">
                          {r.winStreaks
                            .filter((w) => w.length === r.longestWinStreak!.length)
                            .slice(0, 4)
                            .map((w) => (
                              <li key={w.player.id}>
                                <Link to={`/players/${w.player.id}`} className="player-link">
                                  <Avatar player={w.player} size={28} />
                                  <span className="player-link-name">{w.player.name}</span>
                                </Link>
                                <span className="muted">{w.current === w.length ? 'ongoing' : fmtShort(w.to)}</span>
                              </li>
                            ))}
                        </ul>
                      </>
                    ) : (
                      <span className="muted">No wins recorded</span>
                    )}
                  </Record>
                  <Record label="Best win percentage">
                    {r.bestWinPercentage ? (
                      <>
                        <span className="record-value num">{fmtPct(r.bestWinPercentage.leaders[0].value)}</span>
                        <ul className="holders">
                          {r.bestWinPercentage.leaders.slice(0, 4).map((l) => (
                            <li key={l.player.id}>
                              <Link to={`/players/${l.player.id}`} className="player-link">
                                <Avatar player={l.player} size={28} />
                                <span className="player-link-name">{l.player.name}</span>
                              </Link>
                              <span className="muted">{l.stats.matches} played</span>
                            </li>
                          ))}
                        </ul>
                        <span className="muted fine">
                          At least {r.bestWinPercentage.ranking.minMatches} matches{r.bestWinPercentage.ranking.relaxed ? ' (nobody has more yet)' : ''}
                        </span>
                      </>
                    ) : (
                      <span className="muted">No data</span>
                    )}
                  </Record>
                </dl>
              </Panel>

              <div className="grid cols-2">
                <ChartFrame
                  title="Goals over time"
                  series={goalSeries}
                  controls={<SegmentedControl label="Goals chart mode" value={goalsMode} onChange={setGoalsMode} options={[{ value: 'match', label: 'Per match' }, { value: 'total', label: 'Running total' }]} />}
                  table={{ columns: ['Match', 'Date', 'Goals', 'Total'], rows: timeline.map((t) => [t.n, fmtDate(t.date), t.goals, t.cumulativeGoals]) }}
                >
                  {goalsMode === 'match' ? (
                    <Bars data={timeline} xKey="n" series={goalSeries} xFormat={(v) => `#${v}`} labelFormat={labelFmt} />
                  ) : (
                    <Lines data={timeline} xKey="n" series={goalSeries} xFormat={(v) => `#${v}`} labelFormat={labelFmt} yAllowDecimals={false} />
                  )}
                </ChartFrame>
                <ChartFrame
                  title="Assists over time"
                  series={assistSeries}
                  controls={<SegmentedControl label="Assists chart mode" value={assistsMode} onChange={setAssistsMode} options={[{ value: 'match', label: 'Per match' }, { value: 'total', label: 'Running total' }]} />}
                  table={{ columns: ['Match', 'Date', 'Assists', 'Total'], rows: timeline.map((t) => [t.n, fmtDate(t.date), t.assists, t.cumulativeAssists]) }}
                >
                  {assistsMode === 'match' ? (
                    <Bars data={timeline} xKey="n" series={assistSeries} xFormat={(v) => `#${v}`} labelFormat={labelFmt} />
                  ) : (
                    <Lines data={timeline} xKey="n" series={assistSeries} xFormat={(v) => `#${v}`} labelFormat={labelFmt} yAllowDecimals={false} />
                  )}
                </ChartFrame>
              </div>

              <ChartFrame
                title="Player performance trends"
                subtitle="Pick up to four players. Points appear only for matches a player took part in."
                series={trendSeries}
                height={300}
                controls={<SegmentedControl label="Trend metric" value={metric} onChange={setMetric} options={[{ value: 'cumulativeGA', label: 'Goals + assists' }, { value: 'rating', label: 'Rating' }]} />}
                table={{
                  columns: ['Match', 'Date', ...trendSeries.map((s) => s.label)],
                  rows: trendData.map((row) => [row.n as number, fmtDate(String(row.date)), ...trendSeries.map((s) => (row[s.key] as number | null | undefined) ?? null)]),
                }}
              >
                {trendSeries.length === 0 ? (
                  <p className="chart-empty">Choose a player below.</p>
                ) : (
                  <Lines
                    data={trendData}
                    xKey="n"
                    series={trendSeries}
                    xFormat={(v) => `#${v}`}
                    labelFormat={labelFmt}
                    yDomain={metric === 'rating' ? [0, 10] : [0, 'auto']}
                    yAllowDecimals={metric === 'rating'}
                    valueFormat={(v) => (metric === 'rating' ? v.toFixed(1) : String(v))}
                  />
                )}
              </ChartFrame>
              <div className="chips" role="group" aria-label="Players shown in the trend chart">
                {d.charts.performanceTrends.map((t) => {
                  const on = selected.includes(t.player.id);
                  const color = on ? SERIES_ORDER[selected.indexOf(t.player.id) % SERIES_ORDER.length] : undefined;
                  return (
                    <button key={t.player.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} disabled={!on && selected.length >= 4} onClick={() => toggle(t.player.id)}>
                      {color && <span className="legend-swatch" style={{ background: color }} />}
                      {t.player.name}
                    </button>
                  );
                })}
              </div>

              <div className="grid cols-2">
                <ChartFrame
                  title="Match results by margin"
                  series={resultBars}
                  height={220}
                  table={{ columns: ['Result', 'Matches'], rows: d.charts.resultsDistribution.margins.map((m) => [m.label, m.count]) }}
                >
                  <Bars data={d.charts.resultsDistribution.margins} xKey="label" series={resultBars} />
                </ChartFrame>
                <ChartFrame
                  title="Match results by side"
                  subtitle="Sides are drawn fresh for every match"
                  series={sideBars}
                  height={220}
                  table={{ columns: ['Result', 'Matches'], rows: sideData.map((m) => [m.label, m.count]) }}
                >
                  <Bars data={sideData} xKey="label" series={sideBars} />
                </ChartFrame>
              </div>

              {r.hatTricks.recent.length > 0 && (
                <Panel title="Recent hat-tricks" flush>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Date</th>
                          <th>Goals</th>
                          <th>Assists</th>
                          <th>Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.hatTricks.recent.map((h) => (
                          <tr key={`${h.player.id}-${h.matchId}`}>
                            <td>
                              <Link to={`/players/${h.player.id}`} className="player-link">
                                <Avatar player={h.player} size={28} />
                                <span className="player-link-name">{h.player.name}</span>
                              </Link>
                            </td>
                            <td>
                              <Link to={`/matches/${h.matchId}`} className="row-link">
                                {fmtDate(h.playedAt)}
                              </Link>
                            </td>
                            <td className="num strong">{h.goals}</td>
                            <td className="num">{h.assists}</td>
                            <td>
                              <RatingBadge rating={h.rating} size="sm" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
            </div>
          );
        }}
      </Async>
    </>
  );
}
