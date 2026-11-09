import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api';
import MatchCard from '../components/MatchCard';
import { Async, Avatar, Button, ConfirmDialog, EmptyState, Field, Icon, Modal, PageHeader, Panel, StatTile, useToast } from '../components/ui';
import { fmtDate, fmtNum } from '../format';
import { useApp } from '../state/app';
import { useApi } from '../state/useApi';
import type { Dashboard, Ranking, Season, Statistics } from '../types';

function SeasonForm({ open, season, onClose }: { open: boolean; season: Season | null; onClose: () => void }) {
  const { changed, setSeasonKey } = useApp();
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);

  // Reset the form each time the dialog opens.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(season?.name ?? `${new Date().getFullYear()} Season`);
      setError(null);
      setBusy(false);
    }
  }

  const save = async () => {
    if (!name.trim()) {
      setError('Enter a season name.');
      return;
    }
    setBusy(true);
    try {
      if (season) {
        await api.put(`/api/seasons/${season.id}`, { name: name.trim() });
        toast('Season renamed');
      } else {
        const created = await api.post<Season>('/api/seasons', { name: name.trim() });
        setSeasonKey(String(created.id));
        toast(`${created.name} created and selected`);
      }
      await changed();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={season ? 'Rename season' : 'New season'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {season ? 'Save changes' : 'Create season'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Season name" htmlFor="season-name" error={error ?? undefined}>
          <input id="season-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function MiniList({ title, to, rows, metric }: { title: string; to: string; rows: Ranking['rows']; metric: string }) {
  return (
    <Panel title={title} action={<Link to={to} className="panel-link">Full ranking</Link>}>
      {rows.length === 0 ? (
        <p className="muted">Nothing recorded yet.</p>
      ) : (
        <ol className="mini-rank">
          {rows.slice(0, 5).map((r) => (
            <li key={r.player.id}>
              <span className="num mr-rank">{r.rank}</span>
              <Link to={`/players/${r.player.id}`} className="player-link">
                <Avatar player={r.player} size={28} />
                <span className="player-link-name">{r.player.name}</span>
              </Link>
              <span className="num mr-val" title={metric}>
                {fmtNum(r.value, metric === 'Avg rating' ? 2 : 0)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export default function Seasons() {
  const { seasons, seasonKey, setSeasonKey, currentSeason, scopeLabel, changed } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Season | null>(null);
  const [deleting, setDeleting] = useState<Season | null>(null);
  const [busy, setBusy] = useState(false);

  const scorers = useApi<Ranking>(`/api/rankings/top-scorers?season=${seasonKey}`);
  const assists = useApi<Ranking>(`/api/rankings/top-assists?season=${seasonKey}`);
  const mvps = useApi<Ranking>(`/api/rankings/most-mvp?season=${seasonKey}`);
  const best = useApi<Ranking>(`/api/rankings/best-players?season=${seasonKey}`);
  const dash = useApi<Dashboard>(`/api/dashboard?season=${seasonKey}`);
  const stats = useApi<Statistics>(`/api/statistics?season=${seasonKey}`);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/api/seasons/${deleting.id}`);
      await changed();
      toast('Season deleted');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Seasons"
        scope={false}
        subtitle="Each season keeps its own matches, rankings and records. All time combines them, and the two are never mixed."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            New season
          </Button>
        }
      />

      <ul className="season-list" aria-label="Choose what to show">
        <li>
          <button type="button" className={`season-card ${seasonKey === 'all' ? 'on' : ''}`} aria-pressed={seasonKey === 'all'} onClick={() => setSeasonKey('all')}>
            <span className="season-name">All time</span>
            <span className="muted">{seasons.reduce((n, s) => n + s.matchCount, 0)} matches in total</span>
          </button>
        </li>
        {seasons.map((s) => (
          <li key={s.id} className="season-item">
            <button type="button" className={`season-card ${seasonKey === String(s.id) ? 'on' : ''}`} aria-pressed={seasonKey === String(s.id)} onClick={() => setSeasonKey(String(s.id))}>
              <span className="season-name">{s.name}</span>
              <span className="muted">
                {s.matchCount} match{s.matchCount === 1 ? '' : 'es'}
              </span>
            </button>
            <span className="season-actions">
              <button className="icon-btn" aria-label={`Rename ${s.name}`} onClick={() => setRenaming(s)}>
                <Icon name="edit" size={18} />
              </button>
              <button className="icon-btn danger" aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}>
                <Icon name="trash" size={18} />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {seasons.length === 0 ? (
        <EmptyState title="No seasons yet" action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create the first season</Button>}>
          Every match belongs to a season, for example &ldquo;2026 Season&rdquo;.
        </EmptyState>
      ) : (
        <section className="stack season-detail" aria-label={`${scopeLabel} overview`}>
          <div className="spread">
            <h2 className="section-title">{currentSeason ? currentSeason.name : 'All time'}</h2>
            <div className="row">
              <Link to="/matches" className="btn btn-sm">Match history</Link>
              <Link to="/rankings/top-scorers" className="btn btn-sm">Rankings</Link>
              <Link to="/statistics" className="btn btn-sm">Statistics</Link>
            </div>
          </div>

          <Async data={dash.data} loading={dash.loading} error={dash.error} reload={dash.reload}>
            {(d) => (
              <div className="grid cols-4">
                <StatTile label="Matches" value={d.totals.matches} />
                <StatTile label="Goals" value={d.totals.goals} hint={d.totals.goalsPerMatch === null ? undefined : `${fmtNum(d.totals.goalsPerMatch, 1)} per match`} accent />
                <StatTile label="Assists" value={d.totals.assists} />
                <StatTile label="Players who played" value={d.totals.activePlayers} />
              </div>
            )}
          </Async>

          <div className="grid cols-2">
            {scorers.data && <MiniList title="Top scorers" to="/rankings/top-scorers" rows={scorers.data.rows} metric="Goals" />}
            {assists.data && <MiniList title="Top assists" to="/rankings/top-assists" rows={assists.data.rows} metric="Assists" />}
            {mvps.data && <MiniList title="MVP ranking" to="/rankings/most-mvp" rows={mvps.data.rows} metric="MVPs" />}
            {best.data && <MiniList title="Best players" to="/rankings/best-players" rows={best.data.rows} metric="Score" />}
          </div>

          {stats.data && stats.data.totals.matches > 0 && (
            <Panel title="Records">
              <dl className="record-list">
                {stats.data.records.highestScoringMatch && (
                  <div>
                    <dt>Highest-scoring match</dt>
                    <dd>
                      <Link to={`/matches/${stats.data.records.highestScoringMatch.match.id}`}>
                        <b className="num">
                          {stats.data.records.highestScoringMatch.match.scoreA}-{stats.data.records.highestScoringMatch.match.scoreB}
                        </b>{' '}
                        <span className="muted">{fmtDate(stats.data.records.highestScoringMatch.match.playedAt)}</span>
                      </Link>
                    </dd>
                  </div>
                )}
                {stats.data.records.biggestWin && (
                  <div>
                    <dt>Biggest winning margin</dt>
                    <dd>
                      <Link to={`/matches/${stats.data.records.biggestWin.match.id}`}>
                        <b className="num">{stats.data.records.biggestWin.margin} goals</b>{' '}
                        <span className="muted">
                          {stats.data.records.biggestWin.match.scoreA}-{stats.data.records.biggestWin.match.scoreB}, {fmtDate(stats.data.records.biggestWin.match.playedAt)}
                        </span>
                      </Link>
                    </dd>
                  </div>
                )}
                {stats.data.records.mostGoalsInMatch && (
                  <div>
                    <dt>Most goals by one player in a match</dt>
                    <dd>
                      <b className="num">{stats.data.records.mostGoalsInMatch.value}</b>{' '}
                      <span className="muted">{stats.data.records.mostGoalsInMatch.holders.map((h) => h.player.name).join(', ')}</span>
                    </dd>
                  </div>
                )}
                {stats.data.records.longestWinStreak && (
                  <div>
                    <dt>Longest winning streak</dt>
                    <dd>
                      <b className="num">{stats.data.records.longestWinStreak.length}</b> <span className="muted">{stats.data.records.longestWinStreak.player.name}</span>
                    </dd>
                  </div>
                )}
              </dl>
            </Panel>
          )}

          {dash.data && dash.data.latestMatches.length > 0 && (
            <div className="stack-sm">
              <h3 className="section-title sm">Latest matches</h3>
              {dash.data.latestMatches.slice(0, 3).map((m) => (
                <MatchCard key={m.id} match={m} showSeason={seasonKey === 'all'} />
              ))}
            </div>
          )}
        </section>
      )}

      <SeasonForm open={creating} season={null} onClose={() => setCreating(false)} />
      <SeasonForm open={!!renaming} season={renaming} onClose={() => setRenaming(null)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete season"
        message={
          deleting && deleting.matchCount > 0 ? (
            <>
              <b>{deleting.name}</b> has {deleting.matchCount} match{deleting.matchCount === 1 ? '' : 'es'}. To delete it, first{' '}
              <button type="button" className="link-btn" onClick={() => { setDeleting(null); setSeasonKey(String(deleting.id)); navigate('/matches'); }}>
                open its matches
              </button>{' '}
              and move or delete them. You can move a match by editing its season.
            </>
          ) : (
            <>
              Delete <b>{deleting?.name}</b>? It has no matches.
            </>
          )
        }
        confirmLabel="Delete season"
        blocked={!!deleting && deleting.matchCount > 0}
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
