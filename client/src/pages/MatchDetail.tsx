import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import Pitch, { type PitchPlayer } from '../components/Pitch';
import { Async, Avatar, Button, ConfirmDialog, Icon, MvpBadge, PageHeader, Panel, RatingBadge, useToast } from '../components/ui';
import { fmtLong, POSITION_LABEL } from '../format';
import { useApp } from '../state/app';
import { useApi } from '../state/useApi';
import type { MatchParticipant, MatchView } from '../types';

function toPitch(players: MatchParticipant[]): PitchPlayer[] {
  return players.map((p) => ({ player: p.player, slot: p.slot, rating: p.rating, goals: p.goals, assists: p.assists, isMvp: p.isMvp }));
}

function SideTable({ title, side, players, won }: { title: string; side: 'A' | 'B'; players: MatchParticipant[]; won: boolean }) {
  const sorted = [...players].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.goals + b.assists - (a.goals + a.assists));
  return (
    <Panel title={title} action={won ? <span className="winner-tag">Winners</span> : undefined} flush className={`side-panel side-panel-${side}`}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Goals</th>
              <th>Assists</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.player.id}>
                <td>
                  <Link to={`/players/${p.player.id}`} className="player-link">
                    <Avatar player={p.player} size={30} />
                    <span className="player-link-text">
                      <span className="player-link-name">
                        {p.player.name} {p.isMvp && <MvpBadge />}
                      </span>
                      <span className="player-link-sub">{p.isGoalkeeper ? 'Goalkeeper' : POSITION_LABEL[p.player.position]}</span>
                    </span>
                  </Link>
                </td>
                <td className={`num ${p.goals ? 'strong' : ''}`}>{p.goals}</td>
                <td className={`num ${p.assists ? 'strong' : ''}`}>{p.assists}</td>
                <td>
                  <RatingBadge rating={p.rating} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { meta, changed } = useApp();
  const { data, loading, error, reload } = useApi<{ match: MatchView }>(`/api/matches/${id}`);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/api/matches/${id}`);
      await changed();
      toast('Match deleted. Every ranking and profile has been updated.');
      navigate('/matches');
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy(false);
      setDeleting(false);
    }
  };

  return (
    <Async data={data} loading={loading} error={error} reload={reload}>
      {({ match: m }) => (
        <>
          <Link to="/matches" className="back-link">
            All matches
          </Link>
          <PageHeader
            title="Match"
            scope={false}
            subtitle={
              <>
                {fmtLong(m.playedAt)}, {m.seasonName}
              </>
            }
            actions={
              <>
                <Link to={`/matches/${m.id}/edit`} className="btn">
                  <Icon name="edit" size={18} /> Edit
                </Link>
                <Button variant="danger" icon="trash" onClick={() => setDeleting(true)}>
                  Delete
                </Button>
              </>
            }
          />

          <section className="scoreboard" aria-label={`Final score ${m.scoreA} to ${m.scoreB}`}>
            <div className={`sb-side sb-a ${m.result === 'A' ? 'won' : ''}`}>
              <span className="sb-name">Side A</span>
              <span className="sb-formation">{m.formationA}</span>
            </div>
            <div className="sb-score num">
              <span className={m.result === 'A' ? 'win' : ''}>{m.scoreA}</span>
              <span className="sb-dash">-</span>
              <span className={m.result === 'B' ? 'win' : ''}>{m.scoreB}</span>
            </div>
            <div className={`sb-side sb-b ${m.result === 'B' ? 'won' : ''}`}>
              <span className="sb-name">Side B</span>
              <span className="sb-formation">{m.formationB}</span>
            </div>
            <div className="sb-foot">
              {m.result === 'draw' ? 'Draw' : `Side ${m.result} won by ${Math.abs(m.scoreA - m.scoreB)}`}
              {m.mvp && (
                <span className="sb-mvp">
                  <MvpBadge /> <Link to={`/players/${m.mvp.id}`}>{m.mvp.name}</Link>
                </span>
              )}
              {m.bestRated && (
                <span className="sb-mvp">
                  Best rated <Link to={`/players/${m.bestRated.player.id}`}>{m.bestRated.player.name}</Link> <RatingBadge rating={m.bestRated.rating} size="sm" />
                </span>
              )}
            </div>
          </section>

          <div className="stack" style={{ marginTop: 24 }}>
            <div className="grid cols-main-side">
              <Panel title="Formations">
                {meta && (
                  <Pitch formationA={m.formationA} formationB={m.formationB} formations={meta.formations} playersA={toPitch(m.sideA)} playersB={toPitch(m.sideB)} />
                )}
                {[...m.sideA, ...m.sideB].some((p) => p.slot === null) && (
                  <p className="muted pitch-note">Players without a pitch position are listed in the tables below.</p>
                )}
              </Panel>

              <Panel title="Goals" flush>
                {m.goals.length === 0 ? (
                  <p className="muted pad">Goalless draw. No goals were recorded.</p>
                ) : (
                  <ol className="events">
                    {m.goals.map((g) => (
                      <li key={g.id} className={`event event-${g.side}`}>
                        <span className="event-min num">{g.minute === null ? '' : `${g.minute}'`}</span>
                        <span className="event-body">
                          <span className="event-scorer">
                            <Icon name="ball" size={16} /> <Link to={`/players/${g.scorer.id}`}>{g.scorer.name}</Link>
                          </span>
                          {g.assist && (
                            <span className="event-assist">
                              Assist <Link to={`/players/${g.assist.id}`}>{g.assist.name}</Link>
                            </span>
                          )}
                        </span>
                        <span className="event-score num">
                          {g.scoreAfter.a}-{g.scoreAfter.b}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>
            </div>

            <div className="grid cols-2">
              <SideTable title="Side A" side="A" players={m.sideA} won={m.result === 'A'} />
              <SideTable title="Side B" side="B" players={m.sideB} won={m.result === 'B'} />
            </div>

            {m.notes && (
              <Panel title="Match notes">
                <p className="notes">{m.notes}</p>
              </Panel>
            )}
          </div>

          <ConfirmDialog
            open={deleting}
            title="Delete match"
            message={
              <>
                Delete this match ({m.scoreA}-{m.scoreB})? Its goals, assists, ratings and MVP are removed from every ranking and player profile.
              </>
            }
            confirmLabel="Delete match"
            busy={busy}
            onConfirm={remove}
            onCancel={() => setDeleting(false)}
          />
        </>
      )}
    </Async>
  );
}
