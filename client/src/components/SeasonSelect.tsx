import { Field } from './ui';
import { useApp } from '../state/app';

/** A season filter that is bound to the app-wide scope, so every screen stays in step. */
export default function SeasonSelect({ id = 'season-filter', label = 'Season' }: { id?: string; label?: string }) {
  const { seasons, seasonKey, setSeasonKey } = useApp();
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} className="select" value={seasonKey} onChange={(e) => setSeasonKey(e.target.value)}>
        <option value="all">All time</option>
        {seasons.map((s) => (
          <option key={s.id} value={String(s.id)}>
            {s.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
