import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { Bars, ChartFrame, COLORS, Lines, type Series } from '../components/charts';
import PlayerFormModal from '../components/PlayerForm';
import { Async, Avatar, Button, ConfirmDialog, EmptyState, FormChips, MvpBadge, PageHeader, Panel, RatingBadge, ResultTag, StatTile, useToast } from '../components/ui';
import { fmtDate, fmtNum, fmtPct, fmtShort, POSITION_LABEL } from '../format';
import { useApp } from '../state/app';
import { useApi } from '../state/useApi';
import type { PlayerProfile } from '../types';

const RATING_SERIES: Series[] = [{ key: 'rating', label: 'Rating', color: COLORS.s1 }];
const CONTRIB_SERIES: Series[] = [
  { key: 'goals', label: 'Goals', color: COLORS.s1 },
  { key: 'assists', label: 'Assists', color: COLORS.s2 },
];

export default function PlayerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { seasonParam, changed } = useApp();
  const { data, loading, error, reload } = useApi<PlayerProfile>(`/api/players/${id}?season=${seasonParam}`);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const ratingData = useMemo(() => (data?.ratingHistory ?? []).map((r, i) => ({ n: i + 1, date: r.date, rating: r.rating })), [data]);
  const contribData = useMemo(() => (data?.contributionHistory ?? []).map((r, i) => ({ n: i + 1, date: r.date, goals: r.goals, assists: r.assists })), [data]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/api/players/${id}`);
      await changed();
      toast('Player deleted');
      navigate('/players');
    } catch (e) {
      toast(errorMessage(e), 'error');
      setDeleting(false);
      setBusy(false);
    }
  };

  return (
    <Async data={data} loading={loading} error={error} reload={reload}>
      {(d) => {
        const s = d.stats;
        const best = s.bestPerformance;
        return (
          <>
            <Link to="/players" className="back-link">
              All players
            </Link>
            <PageHeader
              title={d.player.name}
              subtitle={POSITION_LABEL[d.player.position]}
              actions={
                <>
                  <Button icon="edit" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  <Button variant="danger" icon="trash" onClick={() => setDeleting(true)}>
                    Delete
                  </Button>
                </>
              }
            />

            <section className="profile-hero">
              <Avatar player={d.player} size={112} />
              <div className="profile-hero-main">
                <div className="profile-hero-rating">
                  <RatingBadge rating={s.avgRating} size="lg" />
                  <span className="muted">
                    {s.avgRating === null
                      ? 'No ratings yet'
                      : `average from ${s.ratedMatches} rated match${s.ratedMatches === 1 ? '' : 'es'}`}
                  </span>
                </div>
                <div className="profile-form">
                  <span className="muted">Last 5 matches</span>
                  <FormChips form={s.form} />
                </div>
              </div>
            </section>

            {s.matches === 0 ? (
              <EmptyState title="No matches in this view">
                {d.player.name} has not played in the selected season. Switch to All time or pick another season.
              </EmptyState>
            ) : (
              <div className="stack">
                <div className="grid cols-4">
                  <StatTile label="Matches played" value={s.matches} />
                  <StatTile label="Goals" value={s.goals} hint={`${fmtNum(s.goalsPerMatch, 2)} per match`} accent />
                  <StatTile label="Assists" value={s.assists} hint={`${fmtNum(s.assistsPerMatch, 2)} per match`} accent />
                  <StatTile label="Goals + assists" value={s.goalsAssists} />
                  <StatTile label="Wins" value={s.wins} hint={`${s.draws} draw${s.draws === 1 ? '' : 's'}, ${s.losses} loss${s.losses === 1 ? '' : 'es'}`} />
                  <StatTile label="Win percentage" value={fmtPct(s.winPct)} />
                  <StatTile label="MVP awards" value={s.mvp} />
                  <StatTile
                    label="Rating range"
                    value={s.highestRating === null ? '-' : `${s.lowestRating!.toFixed(1)} to ${s.highestRating.toFixed(1)}`}
                    hint="Lowest to highest"
                  />
                </div>

                {best && (
                  <Panel title="Best individual performance">
                    <Link to={`/matches/${best.matchId}`} className="best-perf">
                      <span className="best-perf-main">
                        <span className="num best-perf-g">
                          {best.goals} goal{best.goals === 1 ? '' : 's'}
                        </span>
                        <span className="num best-perf-a">
                          {best.assists} assist{best.assists === 1 ? '' : 's'}
                        </span>
                        {best.rating !== null && <RatingBadge rating={best.rating} />}
                        {best.isMvp && <MvpBadge />}
                      </span>
                      <span className="muted">
                        {fmtDate(best.playedAt)}, {best.result === 'W' ? 'won' : best.result === 'L' ? 'lost' : 'drew'} {best.scoreFor}-{best.scoreAgainst}
                      </span>
                    </Link>
                  </Panel>
                )}

                <div className="grid cols-2">
                  <ChartFrame
                    title="Rating history"
                    subtitle="Matches without a rating are left out"
                    series={RATING_SERIES}
                    table={{ columns: ['Match', 'Date', 'Rating'], rows: ratingData.map((r) => [r.n, fmtDate(r.date), r.rating.toFixed(1)]) }}
                  >
                    {ratingData.length === 0 ? (
                      <p className="chart-empty">No ratings recorded for this player yet.</p>
                    ) : (
                      <Lines
                        data={ratingData}
                        xKey="n"
                        series={RATING_SERIES}
                        yDomain={[0, 10]}
                        xFormat={(v) => `#${v}`}
                        labelFormat={(_, row) => fmtDate(String(row?.date))}
                        valueFormat={(v) => v.toFixed(1)}
                      />
                    )}
                  </ChartFrame>
                  <ChartFrame
                    title="Goals and assists per match"
                    series={CONTRIB_SERIES}
                    table={{ columns: ['Match', 'Date', 'Goals', 'Assists'], rows: contribData.map((r) => [r.n, fmtDate(r.date), r.goals, r.assists]) }}
                  >
                    <Bars
                      data={contribData}
                      xKey="n"
                      series={CONTRIB_SERIES}
                      stacked
                      xFormat={(v) => `#${v}`}
                      labelFormat={(_, row) => fmtDate(String(row?.date))}
                    />
                  </ChartFrame>
                </div>

                <Panel title="Seasons" flush>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Season</th>
                          <th>Played</th>
                          <th>Goals</th>
                          <th>Assists</th>
                          <th>W</th>
                          <th>D</th>
                          <th>L</th>
                          <th>Avg rating</th>
                          <th>MVP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.bySeason.map((r) => (
                          <tr key={r.seasonId}>
                            <td>{r.seasonName}</td>
                            <td className="num">{r.matches}</td>
                            <td className="num">{r.goals}</td>
                            <td className="num">{r.assists}</td>
                            <td className="num">{r.wins}</td>
                            <td className="num">{r.draws}</td>
                            <td className="num">{r.losses}</td>
                            <td className="num">{fmtNum(r.avgRating, 2)}</td>
                            <td className="num">{r.mvp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel title="Match history" flush>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Result</th>
                          <th>Score</th>
                          <th>Side</th>
                          <th>Goals</th>
                          <th>Assists</th>
                          <th>Rating</th>
                          <th>MVP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.history.map((h) => (
                          <tr key={h.matchId}>
                            <td>
                              <Link to={`/matches/${h.matchId}`} className="row-link">
                                {fmtShort(h.playedAt)} {h.playedAt.slice(0, 4)}
                              </Link>
                            </td>
                            <td>
                              <ResultTag result={h.result} />
                            </td>
                            <td className="num">
                              {h.scoreFor}-{h.scoreAgainst}
                            </td>
                            <td>{h.side}</td>
                            <td className="num">{h.goals}</td>
                            <td className="num">{h.assists}</td>
                            <td>
                              <RatingBadge rating={h.rating} size="sm" />
                            </td>
                            <td>{h.isMvp ? <MvpBadge /> : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            )}

            <PlayerFormModal open={editing} player={d.player} onClose={() => setEditing(false)} />
            <ConfirmDialog
              open={deleting}
              title="Delete player"
              message={
                <>
                  Delete <b>{d.player.name}</b>? A player who is in recorded matches cannot be deleted until those matches are edited or removed.
                </>
              }
              confirmLabel="Delete player"
              busy={busy}
              onConfirm={remove}
              onCancel={() => setDeleting(false)}
            />
          </>
        );
      }}
    </Async>
  );
}
