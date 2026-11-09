import { Link, useNavigate } from 'react-router-dom';
import { Bars, ChartFrame, COLORS, type Series } from '../components/charts';
import MatchCard from '../components/MatchCard';
import { Async, Avatar, Button, EmptyState, Icon, MvpBadge, PageHeader, Panel, RatingBadge, StatTile } from '../components/ui';
import { fmtDate, fmtNum, fmtShort } from '../format';
import { useApp } from '../state/app';
import { useApi } from '../state/useApi';
import type { Dashboard, Leader } from '../types';

function LeaderCard({ label, leader, format, to }: { label: string; leader: Leader | null; format: (n: number) => string; to: string }) {
  if (!leader) {
    return (
      <div className="leader leader-empty">
        <span className="leader-label">{label}</span>
        <span className="muted">Nobody yet</span>
      </div>
    );
  }
  return (
    <Link to={to} className="leader">
      <span className="leader-label">{label}</span>
      <span className="leader-body">
        <Avatar player={leader.player} size={52} />
        <span className="leader-text">
          <span className="leader-name">{leader.player.name}</span>
          <span className="muted">{leader.tiedCount > 0 ? `tied with ${leader.tiedCount} other${leader.tiedCount === 1 ? '' : 's'}` : `${leader.stats.matches} matches`}</span>
        </span>
        <span className="leader-value num">{format(leader.value)}</span>
      </span>
    </Link>
  );
}

export default function Home() {
  const { seasonParam, scopeLabel, seasons, meta } = useApp();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi<Dashboard>(`/api/dashboard?season=${seasonParam}`);

  return (
    <>
      <PageHeader
        title="Home"
        subtitle="The latest from your 6 vs 6 matches."
        actions={
          <Button variant="primary" icon="plus" onClick={() => navigate('/matches/new')}>
            New match
          </Button>
        }
      />
      <Async data={data} loading={loading} error={error} reload={reload}>
        {(d) => {
          if (d.totals.matches === 0) {
            const steps = [
              { done: d.totals.players >= 12, text: `Add your players (${d.totals.players} so far, 12 needed for a match)`, to: '/players' },
              { done: seasons.length > 0, text: 'Create a season, for example 2026 Season', to: '/seasons' },
              { done: false, text: 'Record the first match with its goals', to: '/matches/new' },
            ];
            return (
              <EmptyState title={seasons.length > 0 && scopeLabel !== 'All time' ? `No matches in ${scopeLabel} yet` : 'Nothing recorded yet'}>
                <span>Three steps to fill this page:</span>
                <ul className="steps">
                  {steps.map((s) => (
                    <li key={s.to} className={s.done ? 'done' : ''}>
                      <Link to={s.to}>
                        {s.done && <Icon name="check" size={16} />} {s.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              </EmptyState>
            );
          }

          const goalSeries: Series[] = [{ key: 'goals', label: 'Goals', color: COLORS.s1 }];
          const trend = d.goalsTrend.map((t, i) => ({ ...t, n: i + 1 }));
          const margins: Series[] = [{ key: 'count', label: 'Matches', color: COLORS.s2 }];

          return (
            <div className="stack">
              <section className="leaders" aria-label="Leaders">
                <LeaderCard label="Most valuable player" leader={d.mvp} format={(n) => `${n} MVP`} to={`/rankings/most-mvp`} />
                <LeaderCard label="Top scorer" leader={d.topScorer} format={(n) => `${n} goals`} to="/rankings/top-scorers" />
                <LeaderCard label="Top assist provider" leader={d.topAssister} format={(n) => `${n} assists`} to="/rankings/top-assists" />
                <LeaderCard label="Highest average rating" leader={d.topRated} format={(n) => n.toFixed(2)} to="/rankings/best-rating" />
              </section>
              {d.topRatedRelaxed && d.topRated && <p className="notice">Nobody has {d.topRatedMinMatches === 1 ? 'a' : 'enough'} rated matches yet, so the rating leader is based on very few.</p>}

              <div className="grid cols-4">
                <StatTile label="Matches played" value={d.totals.matches} />
                <StatTile label="Goals scored" value={d.totals.goals} hint={`${fmtNum(d.totals.goalsPerMatch, 1)} per match`} accent />
                <StatTile label="Assists" value={d.totals.assists} accent />
                <StatTile label="Registered players" value={d.totals.players} hint={`${d.totals.activePlayers} have played`} />
              </div>

              <div className="grid cols-main-side">
                <Panel title="Latest matches" action={<Link to="/matches" className="panel-link">All matches</Link>}>
                  <div className="stack-sm">
                    {d.latestMatches.slice(0, 3).map((m) => (
                      <MatchCard key={m.id} match={m} showSeason={seasonParam === 'all'} />
                    ))}
                  </div>
                </Panel>

                <Panel title="Top 5 players" action={<Link to="/rankings/best-players" className="panel-link">Full ranking</Link>}>
                  {d.topPlayers.length === 0 ? (
                    <p className="muted">Rankings appear once players have played.</p>
                  ) : (
                    <ol className="top5">
                      {d.topPlayers.map((r) => (
                        <li key={r.player.id}>
                          <span className="top5-rank num">{r.rank}</span>
                          <Link to={`/players/${r.player.id}`} className="player-link">
                            <Avatar player={r.player} size={38} />
                            <span className="player-link-text">
                              <span className="player-link-name">{r.player.name}</span>
                              <span className="player-link-sub">
                                {r.stats.goals}G {r.stats.assists}A in {r.stats.matches}
                              </span>
                            </span>
                          </Link>
                          <span className="top5-score">
                            <span className="num">{r.value.toFixed(2)}</span>
                            <span className="muted fine">per match</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {meta && (
                    <p className="muted fine" style={{ marginTop: 14 }}>
                      Score per match: goal {meta.points.goal}, assist {meta.points.assist}, win {meta.points.win}, draw {meta.points.draw}, MVP {meta.points.mvp}.
                      {d.topPlayersRelaxed ? ' Based on very few matches so far.' : ''}
                    </p>
                  )}
                </Panel>
              </div>

              <div className="grid cols-2">
                <ChartFrame
                  title="Goals in recent matches"
                  series={goalSeries}
                  height={220}
                  table={{ columns: ['Match', 'Date', 'Goals'], rows: trend.map((t) => [t.n, fmtDate(t.date), t.goals]) }}
                >
                  <Bars data={trend} xKey="n" series={goalSeries} xFormat={(v) => fmtShort(trend[Number(v) - 1]?.date ?? '')} labelFormat={(_, row) => fmtDate(String(row?.date))} />
                </ChartFrame>
                <ChartFrame
                  title="How matches finished"
                  subtitle="Number of matches by winning margin"
                  series={margins}
                  height={220}
                  table={{ columns: ['Result', 'Matches'], rows: d.resultsDistribution.margins.map((m) => [m.label, m.count]) }}
                >
                  <Bars data={d.resultsDistribution.margins} xKey="label" series={margins} />
                </ChartFrame>
              </div>

              <Panel title="Recent performances" flush>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Match</th>
                        <th>Goals</th>
                        <th>Assists</th>
                        <th>Rating</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.recentPerformances.map((p) => (
                        <tr key={`${p.player.id}-${p.matchId}`}>
                          <td>
                            <Link to={`/players/${p.player.id}`} className="player-link">
                              <Avatar player={p.player} size={30} />
                              <span className="player-link-name">{p.player.name}</span>
                            </Link>
                          </td>
                          <td>
                            <Link to={`/matches/${p.matchId}`} className="row-link">
                              {fmtDate(p.playedAt)}
                            </Link>{' '}
                            <span className="muted num">
                              {p.scoreFor}-{p.scoreAgainst}
                            </span>
                          </td>
                          <td className={`num ${p.goals ? 'strong' : ''}`}>{p.goals}</td>
                          <td className={`num ${p.assists ? 'strong' : ''}`}>{p.assists}</td>
                          <td>
                            <RatingBadge rating={p.rating} size="sm" />
                          </td>
                          <td>{p.isMvp ? <MvpBadge /> : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          );
        }}
      </Async>
    </>
  );
}
