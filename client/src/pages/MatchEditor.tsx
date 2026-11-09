import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorDetails } from '../api';
import Pitch, { slotLabels, type PitchPlayer } from '../components/Pitch';
import { Async, Avatar, Button, EmptyState, Field, Icon, Modal, PageHeader, Panel, useToast } from '../components/ui';
import { POSITION_LABEL, todayISO } from '../format';
import { useApp } from '../state/app';
import { useApi } from '../state/useApi';
import type { MatchFormData, MatchView, PlayerWithStats, Position, Scope, Side } from '../types';

interface PRow {
  playerId: number | null;
  slot: number | null;
  rating: string;
}
interface GRow {
  key: number;
  side: Side;
  scorerId: number | null;
  assistId: number | null;
  minute: string;
}
interface FormState {
  seasonId: string;
  playedAt: string;
  formationA: string;
  formationB: string;
  rowsA: PRow[];
  rowsB: PRow[];
  goals: GRow[];
  mvp: string;
  notes: string;
  scoreA: string;
  scoreB: string;
}

const SIDE_SIZE = 6;
const blankRows = (): PRow[] => Array.from({ length: SIDE_SIZE }, () => ({ playerId: null, slot: null, rating: '' }));
let goalKey = 1;

const idsOf = (rows: PRow[]) => rows.map((r) => r.playerId).filter((x): x is number => x !== null);

/** Keeps goals and the MVP pointing only at players who are actually in the match on the right side. */
function sanitize(f: FormState): FormState {
  const a = new Set(idsOf(f.rowsA));
  const b = new Set(idsOf(f.rowsB));
  const goals = f.goals.map((g) => {
    const ids = g.side === 'A' ? a : b;
    const scorerId = g.scorerId !== null && ids.has(g.scorerId) ? g.scorerId : null;
    const assistId = g.assistId !== null && ids.has(g.assistId) && g.assistId !== scorerId ? g.assistId : null;
    return { ...g, scorerId, assistId };
  });
  const mvp = f.mvp && (a.has(Number(f.mvp)) || b.has(Number(f.mvp))) ? f.mvp : '';
  return { ...f, goals, mvp };
}

function fromServer(form: MatchFormData): FormState {
  const rows = (side: Side): PRow[] => {
    const r: PRow[] = form.participants
      .filter((p) => p.side === side)
      .map((p) => ({ playerId: p.playerId, slot: p.slot, rating: p.rating === null ? '' : String(p.rating) }));
    while (r.length < SIDE_SIZE) r.push({ playerId: null, slot: null, rating: '' });
    return r;
  };
  return {
    seasonId: String(form.seasonId),
    playedAt: form.playedAt,
    formationA: form.formationA,
    formationB: form.formationB,
    rowsA: rows('A'),
    rowsB: rows('B'),
    goals: form.goals.map((g) => ({ key: goalKey++, side: g.side, scorerId: g.scorerId, assistId: g.assistId, minute: g.minute === null ? '' : String(g.minute) })),
    mvp: form.mvpPlayerId === null ? '' : String(form.mvpPlayerId),
    notes: form.notes,
    scoreA: '',
    scoreB: '',
  };
}

const POS_RANK: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, ANY: 2, FWD: 3 };

export default function MatchEditor() {
  const { id } = useParams();
  const editing = id !== undefined;
  const navigate = useNavigate();
  const toast = useToast();
  const { meta, seasons, currentSeason, changed } = useApp();
  const players = useApi<Scope & { players: PlayerWithStats[] }>('/api/players?season=all');
  const existing = useApi<{ match: MatchView; form: MatchFormData }>(editing ? `/api/matches/${id}` : null);

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<{ side: Side; slot: number } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Initialise once, from the saved match when editing or from sensible defaults when creating.
  useEffect(() => {
    if (form || !meta) return;
    if (editing) {
      if (existing.data) setForm(fromServer(existing.data.form));
      return;
    }
    const first = currentSeason ?? seasons[0] ?? null;
    setForm({
      seasonId: first ? String(first.id) : '',
      playedAt: todayISO(),
      formationA: '2-2-1',
      formationB: '2-2-1',
      rowsA: blankRows(),
      rowsB: blankRows(),
      goals: [],
      mvp: '',
      notes: '',
      scoreA: '',
      scoreB: '',
    });
  }, [form, meta, editing, existing.data, currentSeason, seasons]);

  const all = players.data?.players ?? [];
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);

  if (!meta) return null;

  const body = (f: FormState) => {
    const set = (patch: Partial<FormState>) => setForm((cur) => (cur ? sanitize({ ...cur, ...patch }) : cur));
    const rowsKey = (side: Side) => (side === 'A' ? 'rowsA' : 'rowsB') as 'rowsA' | 'rowsB';
    const rowsOf = (side: Side) => f[rowsKey(side)];
    const formationOf = (side: Side) => (side === 'A' ? f.formationA : f.formationB);
    const labelsOf = (side: Side) => slotLabels(meta.formations[formationOf(side)] ?? [2, 2, 1]);

    const used = new Set([...idsOf(f.rowsA), ...idsOf(f.rowsB)]);
    const goalsA = f.goals.filter((g) => g.side === 'A').length;
    const goalsB = f.goals.filter((g) => g.side === 'B').length;

    const updateRow = (side: Side, index: number, patch: Partial<PRow>) =>
      set({ [rowsKey(side)]: rowsOf(side).map((r, i) => (i === index ? { ...r, ...patch } : r)) } as Partial<FormState>);

    const setPlayer = (side: Side, index: number, value: string) => {
      const playerId = value === '' ? null : Number(value);
      updateRow(side, index, playerId === null ? { playerId, slot: null, rating: '' } : { playerId });
    };

    /** Puts a player (or nobody) on a pitch spot, swapping with whoever stood there. */
    const assignSlot = (side: Side, slot: number, playerId: number | null) => {
      const rows = rowsOf(side);
      let next: PRow[];
      if (playerId === null) {
        next = rows.map((r) => (r.slot === slot ? { ...r, slot: null } : r));
      } else {
        const target = rows.find((r) => r.playerId === playerId);
        if (!target) return;
        const occupant = rows.find((r) => r.slot === slot && r !== target);
        next = rows.map((r) => (r === target ? { ...r, slot } : occupant && r === occupant ? { ...r, slot: target.slot } : r));
      }
      set({ [rowsKey(side)]: next } as Partial<FormState>);
    };

    const autoArrange = (side: Side) => {
      const rows = rowsOf(side);
      const filled = rows
        .map((r, i) => ({ r, i, pos: r.playerId === null ? 'ANY' : byId.get(r.playerId)?.position ?? 'ANY' }))
        .filter((x) => x.r.playerId !== null)
        .sort((x, y) => POS_RANK[x.pos as Position] - POS_RANK[y.pos as Position] || x.i - y.i);
      const slotFor = new Map<number, number>();
      filled.forEach((x, n) => slotFor.set(x.i, n));
      set({ [rowsKey(side)]: rows.map((r, i) => ({ ...r, slot: slotFor.has(i) ? slotFor.get(i)! : null })) } as Partial<FormState>);
    };

    const addGoals = (side: Side, count = 1) =>
      set({ goals: [...f.goals, ...Array.from({ length: count }, () => ({ key: goalKey++, side, scorerId: null, assistId: null, minute: '' }))] });
    const updateGoal = (key: number, patch: Partial<GRow>) => set({ goals: f.goals.map((g) => (g.key === key ? { ...g, ...patch } : g)) });
    const removeGoal = (key: number) => set({ goals: f.goals.filter((g) => g.key !== key) });

    const pitchPlayers = (side: Side): PitchPlayer[] =>
      rowsOf(side)
        .filter((r) => r.playerId !== null && byId.has(r.playerId))
        .map((r) => ({
          player: byId.get(r.playerId!)!,
          slot: r.slot,
          rating: r.rating === '' || Number.isNaN(Number(r.rating)) ? null : Number(r.rating),
          goals: f.goals.filter((g) => g.scorerId === r.playerId).length,
          isMvp: f.mvp === String(r.playerId),
        }));

    // ---- validation shown before the request is sent (the server checks everything again) ----
    const problems = (): string[] => {
      const out: string[] = [];
      if (!f.seasonId) out.push('Choose a season.');
      if (!f.playedAt) out.push('Choose the match date.');
      for (const side of ['A', 'B'] as Side[]) {
        const n = idsOf(rowsOf(side)).length;
        if (n !== SIDE_SIZE) out.push(`Side ${side} needs ${SIDE_SIZE} players (${n} chosen).`);
      }
      f.goals.forEach((g, i) => {
        if (g.scorerId === null) out.push(`Goal ${i + 1}: choose who scored.`);
        if (g.minute !== '' && (!/^\d+$/.test(g.minute) || Number(g.minute) > 120)) out.push(`Goal ${i + 1}: the time must be a whole minute from 0 to 120.`);
      });
      for (const [side, typed, derived] of [['A', f.scoreA, goalsA], ['B', f.scoreB, goalsB]] as const) {
        if (typed !== '' && Number(typed) !== derived) out.push(`Side ${side}'s final score is ${typed} but ${derived} goal${derived === 1 ? ' is' : 's are'} recorded.`);
      }
      for (const r of [...f.rowsA, ...f.rowsB]) {
        if (r.rating !== '' && (Number.isNaN(Number(r.rating)) || Number(r.rating) < 0 || Number(r.rating) > 10)) {
          out.push('Ratings must be numbers from 0 to 10.');
          break;
        }
      }
      return out;
    };

    const save = async () => {
      const local = problems();
      if (local.length) {
        setErrors(local);
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setBusy(true);
      setErrors([]);
      const payload = {
        seasonId: Number(f.seasonId),
        playedAt: f.playedAt,
        formationA: f.formationA,
        formationB: f.formationB,
        notes: f.notes,
        mvpPlayerId: f.mvp === '' ? null : Number(f.mvp),
        participants: (['A', 'B'] as Side[]).flatMap((side) =>
          rowsOf(side)
            .filter((r) => r.playerId !== null)
            .map((r) => ({ playerId: r.playerId, side, slot: r.slot, rating: r.rating === '' ? null : Number(r.rating) })),
        ),
        goals: f.goals.map((g) => ({ side: g.side, scorerId: g.scorerId, assistId: g.assistId, minute: g.minute === '' ? null : Number(g.minute) })),
        ...(f.scoreA !== '' ? { scoreA: Number(f.scoreA) } : {}),
        ...(f.scoreB !== '' ? { scoreB: Number(f.scoreB) } : {}),
      };
      try {
        const res = editing
          ? await api.put<{ match: MatchView }>(`/api/matches/${id}`, payload)
          : await api.post<{ match: MatchView }>('/api/matches', payload);
        await changed();
        toast(editing ? 'Match updated. All statistics are recalculated.' : 'Match saved. All statistics are updated.');
        navigate(`/matches/${res.match.id}`);
      } catch (e) {
        setErrors(errorDetails(e));
        setBusy(false);
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    const sideNames = (side: Side) => (
      <Panel title={`Side ${side}`} className={`editor-side editor-side-${side}`}>
        <div className="side-count">
          <span className="num">{idsOf(rowsOf(side)).length}</span> of {SIDE_SIZE} players
        </div>
        <div className="roster">
          {rowsOf(side).map((r, i) => {
            const labels = labelsOf(side);
            const taken = new Set(rowsOf(side).filter((x, xi) => xi !== i && x.slot !== null).map((x) => x.slot));
            return (
              <div key={i} className="roster-row">
                <Field label={`Player ${i + 1}`} htmlFor={`p-${side}-${i}`}>
                  <select id={`p-${side}-${i}`} className="select" value={r.playerId ?? ''} onChange={(e) => setPlayer(side, i, e.target.value)}>
                    <option value="">Choose player</option>
                    {all.map((p) => (
                      <option key={p.id} value={p.id} disabled={used.has(p.id) && p.id !== r.playerId}>
                        {p.name}
                        {used.has(p.id) && p.id !== r.playerId ? ' (already in this match)' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Position" htmlFor={`pos-${side}-${i}`}>
                  <select
                    id={`pos-${side}-${i}`}
                    className="select"
                    disabled={r.playerId === null}
                    value={r.slot ?? ''}
                    onChange={(e) => updateRow(side, i, { slot: e.target.value === '' ? null : Number(e.target.value) })}
                  >
                    <option value="">Not set</option>
                    {labels.map((l, s) => (
                      <option key={s} value={s} disabled={taken.has(s)}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Rating" htmlFor={`rt-${side}-${i}`}>
                  <input
                    id={`rt-${side}-${i}`}
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={10}
                    step={0.1}
                    placeholder="0-10"
                    disabled={r.playerId === null}
                    value={r.rating}
                    onChange={(e) => updateRow(side, i, { rating: e.target.value })}
                  />
                </Field>
              </div>
            );
          })}
        </div>
      </Panel>
    );

    const playersIn = (side: Side) => idsOf(rowsOf(side)).map((pid) => byId.get(pid)).filter((p): p is PlayerWithStats => !!p);
    const mismatch = (side: Side, typed: string, derived: number) => {
      if (typed === '' || Number(typed) === derived) return null;
      const diff = Number(typed) - derived;
      return diff > 0 ? (
        <span className="score-fix">
          {diff} goal{diff === 1 ? '' : 's'} missing.{' '}
          <button type="button" className="link-btn" onClick={() => addGoals(side, diff)}>
            Add {diff} goal row{diff === 1 ? '' : 's'}
          </button>
        </span>
      ) : (
        <span className="score-fix">Remove {-diff} goal row{-diff === 1 ? '' : 's'}, or fix the score.</span>
      );
    };

    const slotPlayer = pick ? pitchPlayers(pick.side).find((p) => p.slot === pick.slot) : undefined;

    return (
      <>
        <PageHeader
          title={editing ? 'Edit match' : 'New match'}
          scope={false}
          subtitle="Choose 12 players, six on each side, then add the goals. The score is counted from the goals, so it can never disagree with them."
        />

        {errors.length > 0 && (
          <div ref={errorRef} className="form-errors" role="alert">
            <strong>{errors.length === 1 ? 'Fix this before saving' : `Fix these ${errors.length} things before saving`}</strong>
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="stack">
          <Panel title="Match details">
            <div className="grid cols-4 form-grid">
              <Field label="Date" htmlFor="me-date">
                <input id="me-date" className="input" type="date" value={f.playedAt} onChange={(e) => set({ playedAt: e.target.value })} />
              </Field>
              <Field label="Season" htmlFor="me-season">
                <select id="me-season" className="select" value={f.seasonId} onChange={(e) => set({ seasonId: e.target.value })}>
                  <option value="">Choose season</option>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Side A formation" htmlFor="me-fa">
                <select id="me-fa" className="select" value={f.formationA} onChange={(e) => set({ formationA: e.target.value })}>
                  {Object.keys(meta.formations).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Side B formation" htmlFor="me-fb">
                <select id="me-fb" className="select" value={f.formationB} onChange={(e) => set({ formationB: e.target.value })}>
                  {Object.keys(meta.formations).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>

          <div className="grid cols-2">
            {sideNames('A')}
            {sideNames('B')}
          </div>

          <Panel
            title="Pitch"
            action={
              <div className="row" style={{ gap: 8 }}>
                <Button className="btn-sm" onClick={() => autoArrange('A')}>
                  Arrange Side A
                </Button>
                <Button className="btn-sm" onClick={() => autoArrange('B')}>
                  Arrange Side B
                </Button>
              </div>
            }
          >
            <p className="muted pitch-help">Tap a spot to place a player. Positions are optional; leave the goalkeeper spot empty if you do not track keepers.</p>
            <Pitch
              formationA={f.formationA}
              formationB={f.formationB}
              formations={meta.formations}
              playersA={pitchPlayers('A')}
              playersB={pitchPlayers('B')}
              onSlotClick={(side, slot) => setPick({ side, slot })}
              compact
            />
          </Panel>

          <Panel title="Goals">
            <div className="editor-score" aria-live="polite">
              <div className="es-side">
                <span className="muted">Side A</span>
                <span className="es-num num">{goalsA}</span>
              </div>
              <span className="es-dash">-</span>
              <div className="es-side">
                <span className="muted">Side B</span>
                <span className="es-num num">{goalsB}</span>
              </div>
            </div>
            <div className="grid cols-2 final-score">
              <Field label="Final score, Side A (optional check)" htmlFor="fs-a" hint="Type the score you know. Saving is blocked until the goals add up to it.">
                <input id="fs-a" className="input" type="number" min={0} inputMode="numeric" value={f.scoreA} placeholder={String(goalsA)} onChange={(e) => set({ scoreA: e.target.value })} />
                {mismatch('A', f.scoreA, goalsA)}
              </Field>
              <Field label="Final score, Side B (optional check)" htmlFor="fs-b">
                <input id="fs-b" className="input" type="number" min={0} inputMode="numeric" value={f.scoreB} placeholder={String(goalsB)} onChange={(e) => set({ scoreB: e.target.value })} />
                {mismatch('B', f.scoreB, goalsB)}
              </Field>
            </div>

            {f.goals.length === 0 ? (
              <p className="muted pad-y">No goals yet. Add one for the side that scored.</p>
            ) : (
              <ol className="goal-rows">
                {f.goals.map((g, i) => {
                  const side = playersIn(g.side);
                  return (
                    <li key={g.key} className={`goal-row goal-row-${g.side}`}>
                      <span className="goal-badge">
                        <Icon name="ball" size={16} /> {i + 1}
                      </span>
                      <Field label={`Scorer (Side ${g.side})`} htmlFor={`g-s-${g.key}`}>
                        <select id={`g-s-${g.key}`} className="select" value={g.scorerId ?? ''} onChange={(e) => updateGoal(g.key, { scorerId: e.target.value === '' ? null : Number(e.target.value), assistId: g.assistId === Number(e.target.value) ? null : g.assistId })}>
                          <option value="">Choose scorer</option>
                          {side.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Assist (optional)" htmlFor={`g-a-${g.key}`}>
                        <select id={`g-a-${g.key}`} className="select" value={g.assistId ?? ''} onChange={(e) => updateGoal(g.key, { assistId: e.target.value === '' ? null : Number(e.target.value) })}>
                          <option value="">No assist</option>
                          {side
                            .filter((p) => p.id !== g.scorerId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Minute" htmlFor={`g-m-${g.key}`}>
                        <input id={`g-m-${g.key}`} className="input" type="number" min={0} max={120} inputMode="numeric" placeholder="Optional" value={g.minute} onChange={(e) => updateGoal(g.key, { minute: e.target.value })} />
                      </Field>
                      <button type="button" className="icon-btn danger goal-remove" aria-label={`Remove goal ${i + 1}`} onClick={() => removeGoal(g.key)}>
                        <Icon name="trash" size={18} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="row add-goals">
              <Button icon="plus" onClick={() => addGoals('A')}>
                Goal for Side A
              </Button>
              <Button icon="plus" onClick={() => addGoals('B')}>
                Goal for Side B
              </Button>
            </div>
          </Panel>

          <Panel title="MVP and notes">
            <div className="grid cols-2">
              <Field label="MVP (optional)" htmlFor="me-mvp">
                <select id="me-mvp" className="select" value={f.mvp} onChange={(e) => set({ mvp: e.target.value })}>
                  <option value="">No MVP</option>
                  {(['A', 'B'] as Side[]).map((side) => (
                    <optgroup key={side} label={`Side ${side}`}>
                      {playersIn(side).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Match notes (optional)" htmlFor="me-notes">
                <textarea id="me-notes" className="textarea" maxLength={2000} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="save-bar">
          <span className="save-bar-score num">
            {goalsA}-{goalsB}
          </span>
          <Link to={editing ? `/matches/${id}` : '/matches'} className="btn btn-ghost">
            Cancel
          </Link>
          <Button variant="primary" busy={busy} onClick={save}>
            {editing ? 'Save changes' : 'Save match'}
          </Button>
        </div>

        <Modal
          open={!!pick}
          title={pick ? `Side ${pick.side}: ${labelsOf(pick.side)[pick.slot]}` : ''}
          onClose={() => setPick(null)}
          footer={
            slotPlayer ? (
              <Button
                variant="ghost"
                onClick={() => {
                  if (pick) assignSlot(pick.side, pick.slot, null);
                  setPick(null);
                }}
              >
                Leave this spot empty
              </Button>
            ) : undefined
          }
        >
          {pick && playersIn(pick.side).length === 0 ? (
            <p className="sub">Choose players for Side {pick.side} first.</p>
          ) : (
            <ul className="pick-list">
              {pick &&
                playersIn(pick.side).map((p) => {
                  const row = rowsOf(pick.side).find((r) => r.playerId === p.id)!;
                  const here = row.slot === pick.slot;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`pick-item ${here ? 'on' : ''}`}
                        onClick={() => {
                          assignSlot(pick.side, pick.slot, p.id);
                          setPick(null);
                        }}
                      >
                        <Avatar player={p} size={34} />
                        <span className="pick-name">
                          {p.name}
                          <span className="muted">
                            {here ? 'Here now' : row.slot !== null ? `Now: ${labelsOf(pick.side)[row.slot]}` : POSITION_LABEL[p.position]}
                          </span>
                        </span>
                        {here && <Icon name="check" size={18} />}
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </Modal>
      </>
    );
  };

  // ---- gates before the form can be used ----
  const ready = players.data && (!editing || existing.data);
  if (ready && !editing) {
    if (seasons.length === 0) {
      return (
        <>
          <PageHeader title="New match" scope={false} />
          <EmptyState title="Create a season first" action={<Link to="/seasons" className="btn btn-primary">Go to seasons</Link>}>
            Every match belongs to a season, for example &ldquo;2026 Season&rdquo;.
          </EmptyState>
        </>
      );
    }
    if (players.data!.players.length < SIDE_SIZE * 2) {
      return (
        <>
          <PageHeader title="New match" scope={false} />
          <EmptyState title="Add more players first" action={<Link to="/players" className="btn btn-primary">Go to players</Link>}>
            A match needs 12 different players. You have {players.data!.players.length}.
          </EmptyState>
        </>
      );
    }
  }

  return (
    <Async data={ready && form ? form : null} loading={players.loading || existing.loading} error={players.error ?? existing.error} reload={() => { players.reload(); existing.reload(); }}>
      {(f) => body(f)}
    </Async>
  );
}
