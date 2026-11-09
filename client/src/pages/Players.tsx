import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import PlayerFormModal from '../components/PlayerForm';
import { Async, Avatar, Button, ConfirmDialog, EmptyState, Field, FormChips, Icon, PageHeader, RatingBadge, useToast } from '../components/ui';
import { fmtNum, POSITION_LABEL } from '../format';
import { useApp } from '../state/app';
import { useApi } from '../state/useApi';
import type { PlayerWithStats, Scope } from '../types';

type SortKey = 'name' | 'goals' | 'assists' | 'goalsAssists' | 'avgRating' | 'matches' | 'winPct' | 'mvp';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'goalsAssists', label: 'Goals + assists' },
  { value: 'goals', label: 'Goals' },
  { value: 'assists', label: 'Assists' },
  { value: 'avgRating', label: 'Average rating' },
  { value: 'matches', label: 'Matches played' },
  { value: 'winPct', label: 'Win percentage' },
  { value: 'mvp', label: 'MVP awards' },
];

export default function Players() {
  const { seasonParam, changed } = useApp();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<Scope & { players: PlayerWithStats[] }>(`/api/players?season=${seasonParam}`);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [editing, setEditing] = useState<PlayerWithStats | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<PlayerWithStats | null>(null);
  const [busy, setBusy] = useState(false);

  const players = useMemo(() => {
    const list = (data?.players ?? []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return [...list].sort((a, b) => (b.stats[sort] ?? -1) - (a.stats[sort] ?? -1) || a.name.localeCompare(b.name));
  }, [data, query, sort]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/api/players/${deleting.id}`);
      await changed();
      toast(`${deleting.name} deleted`);
      setDeleting(null);
    } catch (e) {
      toast(errorMessage(e), 'error');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Players"
        subtitle="Everyone who has played. Numbers come from the matches you record."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
            Add player
          </Button>
        }
      />
      <Async data={data} loading={loading} error={error} reload={reload}>
        {(d) =>
          d.players.length === 0 ? (
            <EmptyState
              title="No players yet"
              action={
                <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
                  Add the first player
                </Button>
              }
            >
              Add everyone who plays, then record a match with 12 of them.
            </EmptyState>
          ) : (
            <>
              <div className="filters">
                <Field label="Search" htmlFor="player-search">
                  <input id="player-search" className="input" type="search" placeholder="Player name" value={query} onChange={(e) => setQuery(e.target.value)} />
                </Field>
                <Field label="Sort by" htmlFor="player-sort">
                  <select id="player-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {players.length === 0 ? (
                <EmptyState title="No player matches that search">Try a different name.</EmptyState>
              ) : (
                <ul className="player-grid">
                  {players.map((p) => (
                    <li key={p.id} className="player-card">
                      <Link to={`/players/${p.id}`} className="player-card-link">
                        <div className="player-card-top">
                          <Avatar player={p} size={56} />
                          <div className="player-card-id">
                            <span className="player-card-name">{p.name}</span>
                            <span className="muted">{POSITION_LABEL[p.position]}</span>
                          </div>
                          <RatingBadge rating={p.stats.avgRating} />
                        </div>
                        <dl className="mini-stats">
                          <div>
                            <dt>Played</dt>
                            <dd className="num">{p.stats.matches}</dd>
                          </div>
                          <div>
                            <dt>Goals</dt>
                            <dd className="num">{p.stats.goals}</dd>
                          </div>
                          <div>
                            <dt>Assists</dt>
                            <dd className="num">{p.stats.assists}</dd>
                          </div>
                          <div>
                            <dt>Win %</dt>
                            <dd className="num">{p.stats.winPct === null ? '-' : fmtNum(Math.round(p.stats.winPct))}</dd>
                          </div>
                        </dl>
                        <FormChips form={p.stats.form} size="sm" />
                      </Link>
                      <div className="player-card-actions">
                        <button className="icon-btn" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                          <Icon name="edit" size={18} />
                        </button>
                        <button className="icon-btn danger" aria-label={`Delete ${p.name}`} onClick={() => setDeleting(p)}>
                          <Icon name="trash" size={18} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }
      </Async>

      <PlayerFormModal open={adding} onClose={() => setAdding(false)} />
      <PlayerFormModal open={!!editing} player={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete player"
        message={
          <>
            Delete <b>{deleting?.name}</b>? This cannot be undone. A player who is in recorded matches cannot be deleted until those matches are edited or removed.
          </>
        }
        confirmLabel="Delete player"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
