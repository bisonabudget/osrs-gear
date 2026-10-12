import { DRAIN_FIELDS, DRAIN_SPELLS, DrainSpell, drainSummary, Drains, NO_DRAINS } from '../drains';
import { LevelBox } from './LevelBox';

interface Props {
  drains: Drains;
  onChange: (drains: Drains) => void;
}

/** The special attacks and spells used to lower the monster's Defence before the fight. */
export const DrainsPanel = ({ drains, onChange }: Props) => {
  const summary = drainSummary(drains);
  return (
    <details className="maths drains">
      <summary>
        Defence drains
        <span className="drains-summary">{summary ?? 'None'}</span>
      </summary>
      <div className="drains-grid">
        {DRAIN_FIELDS.map((f) => (
          <LevelBox
            key={f.key}
            label={f.counts === 'hits' ? `${f.short} hits` : `${f.short} damage`}
            icon={f.weapon}
            title={`${f.weapon}: ${f.note}`}
            value={drains[f.key]}
            max={f.max}
            step={1}
            onChange={(n) => onChange({ ...drains, [f.key]: n })}
          />
        ))}
        <label className="level-box" title={DRAIN_SPELLS.filter((s) => s.note).map((s) => `${s.name}: ${s.note}`).join(' ')}>
          Spell
          <select
            className="stat-input"
            value={drains.spell}
            onChange={(e) => onChange({ ...drains, spell: e.target.value as DrainSpell })}
          >
            {DRAIN_SPELLS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </label>
      </div>
      {summary && <button type="button" className="drains-clear" onClick={() => onChange(NO_DRAINS)}>Clear drains</button>}
    </details>
  );
};
