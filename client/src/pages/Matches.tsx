import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import MatchCard from '../components/MatchCard';
import SeasonSelect from '../components/SeasonSelect';
import { Async, Button, ConfirmDialog, EmptyState, Field, Icon, PageHeader, useToast } from '../components/ui';
import { fmtDate } from '../format';
import { useApp } from '../state/app';
import { useApi } from '../state/useApi';
import type { MatchView, PlayerWithStats, Scope } from '../types';
import { useNavigate } from 'react-router-dom';

export default function Matches() {
  const { seasonParam, changed } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [player, setPlayer] = useState('');
  const [result, setResult] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [deleting, setDeleting] = useState<MatchView | null>(null);
  const [busy, setBusy] = useState(false);

  const params = new URLSearchParams({ season: seasonParam });
  if (player) params.set('player', player);
  if (result) params.set('result', result);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const list = useApi<Scope & { count: number; matches: MatchView[] }>(`/api/matches?${params}`);
  const players = useApi<Scope & { players: PlayerWithStats[] }>('/api/players?season=all');
  const filtered = !!(player || result || from || to);

  const changePlayer = (value: string) => {
    setPlayer(value);
    // The result filter means something different with and without a player, so reset it.
    setResult('');
  };

  const clear = () => {
    setPlayer('');
    setResult('');
    setFrom('');
    setTo('');
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/api/matches/${deleting.id}`);
      await changed();
      toast('Match deleted. Every ranking and profile has been updated.');
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
        title="Matches"
        subtitle="Every match played, newest first. Open one for goals, ratings and formations."
        actions={
          <Button variant="primary" icon="plus" onClick={() => navigate('/matches/new')}>
            New match
          </Button>
        }
      />

      <div className="filters">
        <SeasonSelect id="m-season" />
        <Field label="Player" htmlFor="m-player">
          <select id="m-player" className="select" value={player} onChange={(e) => changePlayer(e.target.value)}>
            <option value="">Everyone</option>
            {(players.data?.players ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Result" htmlFor="m-result">
          <select id="m-result" className="select" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">Any result</option>
            {player ? (
              <>
                <option value="win">Won by this player</option>
                <option value="draw">Drawn</option>
                <option value="loss">Lost by this player</option>
              </>
            ) : (
              <>
                <option value="decisive">Had a winner</option>
                <option value="draw">Drawn</option>
              </>
            )}
          </select>
        </Field>
        <Field label="From" htmlFor="m-from">
          <input id="m-from" className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To" htmlFor="m-to">
          <input id="m-to" className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </Field>
        {filtered && (
          <Button variant="ghost" onClick={clear}>
            Clear filters
          </Button>
        )}
      </div>

      <Async data={list.data} loading={list.loading} error={list.error} reload={list.reload}>
        {(d) =>
          d.matches.length === 0 ? (
            filtered ? (
              <EmptyState title="No matches fit these filters" action={<Button onClick={clear}>Clear filters</Button>}>
                Widen the dates, or pick another player or season.
              </EmptyState>
            ) : (
              <EmptyState title="No matches in this view" action={<Link to="/matches/new" className="btn btn-primary"><Icon name="plus" size={18} />New match</Link>}>
                Record a match with 12 players and every statistic updates by itself.
              </EmptyState>
            )
          ) : (
            <>
              <p className="muted list-count">
                {d.count} match{d.count === 1 ? '' : 'es'}
              </p>
              <div className="stack-sm">
                {d.matches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    actions={
                      <>
                        <Link to={`/matches/${m.id}/edit`} className="icon-btn" aria-label={`Edit match on ${fmtDate(m.playedAt)}`}>
                          <Icon name="edit" size={18} />
                        </Link>
                        <button className="icon-btn danger" aria-label={`Delete match on ${fmtDate(m.playedAt)}`} onClick={() => setDeleting(m)}>
                          <Icon name="trash" size={18} />
                        </button>
                      </>
                    }
                  />
                ))}
              </div>
            </>
          )
        }
      </Async>

      <ConfirmDialog
        open={!!deleting}
        title="Delete match"
        message={
          deleting && (
            <>
              Delete the match on <b>{fmtDate(deleting.playedAt)}</b> ({deleting.scoreA}-{deleting.scoreB})? Its goals, assists, ratings and MVP are removed from every ranking and player profile.
            </>
          )
        }
        confirmLabel="Delete match"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
