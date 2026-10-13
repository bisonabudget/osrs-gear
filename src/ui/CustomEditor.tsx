import { useEffect, useState } from 'react';
import { MonsterInfo, monsterInfo, wikiImage } from '../catalog';
import { CUSTOM_ATTRIBUTES } from '../custom';
import type { CustomMonster, Defence, Element } from '../worker/protocol';
import { ATTRIBUTES, DEFENCE_INFO } from './MonsterSheet';
import { MonsterPicker } from './MonsterPicker';
import { Img } from './Img';

const ELEMENTS: Element[] = ['air', 'water', 'earth', 'fire'];
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

interface NumberProps {
  label: string;
  icon?: string;
  /** A short word shown where there's no icon. */
  word?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}

// A number box that lets the player clear it while typing, and only passes on whole numbers in range.
const NumberBox = ({ label, icon, word, value, min, max, onChange }: NumberProps) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <li title={label}>
      {icon ? <Img src={wikiImage(icon)} alt="" /> : <span className="stat-word">{word}</span>}
      <input
        className="stat-input"
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Math.round(Number(e.target.value));
          if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => setText(String(value))}
      />
    </li>
  );
};

const Group = ({ title, half, children }: { title: string, half?: boolean, children: React.ReactNode }) => (
  <div className={`stat-group${half ? ' half' : ''}`}>
    <p className="stat-title">{title}</p>
    <ul>{children}</ul>
  </div>
);

interface Props {
  custom: CustomMonster;
  onChange: (c: CustomMonster) => void;
  /** Starts again as a copy of a monster. */
  onCopy: (m: MonsterInfo) => void;
}

/** The Custom monster's stats as boxes to change. */
export const CustomEditor = ({ custom, onChange, onCopy }: Props) => {
  const base = monsterInfo.get(custom.from);
  const set = (part: Partial<CustomMonster>) => onChange({ ...custom, ...part });
  const setDefence = (d: Defence, n: number) => set({ defence: { ...custom.defence, [d]: n } });
  const defenceBox = (d: Defence) => (
    <NumberBox key={d} label={`${DEFENCE_INFO[d].name} defence`} icon={DEFENCE_INFO[d].icon} value={custom.defence[d]} min={-999} max={999} onChange={(n) => setDefence(d, n)} />
  );
  const toggle = (a: string) => set({
    attributes: custom.attributes.includes(a) ? custom.attributes.filter((x) => x !== a) : CUSTOM_ATTRIBUTES.filter((x) => x === a || custom.attributes.includes(x)),
  });

  return (
    <div className="monster-facts custom-editor">
      <section className="statbox" aria-label="Custom monster stats">
        <Group title="Combat stats">
          <NumberBox label="Hitpoints" icon="Hitpoints icon" value={custom.hp} min={1} max={99999} onChange={(hp) => set({ hp })} />
          <NumberBox label="Defence" icon="Defence icon" value={custom.def} min={0} max={9999} onChange={(def) => set({ def })} />
          <NumberBox label="Magic" icon="Magic icon" value={custom.magic} min={0} max={9999} onChange={(magic) => set({ magic })} />
          <NumberBox label="Size" word="Size" value={custom.size} min={1} max={10} onChange={(size) => set({ size })} />
          <NumberBox label="Armour, taken off every melee and ranged hit" word="Armour" value={custom.armour} min={-99} max={99} onChange={(armour) => set({ armour })} />
        </Group>
        <Group title="Melee defence" half>{(['stab', 'slash', 'crush'] as Defence[]).map(defenceBox)}</Group>
        <Group title="Ranged defence" half>{(['light', 'standard', 'heavy'] as Defence[]).map(defenceBox)}</Group>
        <Group title="Magic defence" half>{defenceBox('magic')}</Group>
        <Group title="Weakness" half>
          <li title="Elemental weakness">
            {custom.weakness ? <Img src={wikiImage(`${capital(custom.weakness.element)} rune`)} alt="" /> : <span className="stat-word">Element</span>}
            <select
              className="stat-input"
              aria-label="Weakness element"
              value={custom.weakness?.element ?? ''}
              onChange={(e) => set({
                weakness: e.target.value ? { element: e.target.value as Element, severity: custom.weakness?.severity ?? 50 } : null,
              })}
            >
              <option value="">None</option>
              {ELEMENTS.map((el) => <option key={el} value={el}>{capital(el)}</option>)}
            </select>
          </li>
          {custom.weakness && (
            <NumberBox
              label="Weakness %"
              word="%"
              value={custom.weakness.severity}
              min={1}
              max={100}
              onChange={(severity) => set({ weakness: { ...custom.weakness!, severity } })}
            />
          )}
        </Group>
      </section>

      <div className="fact">
        <p className="stat-title">Attributes</p>
        <ul className="tags toggles">
          {CUSTOM_ATTRIBUTES.map((a) => (
            <li key={a}>
              <button type="button" aria-pressed={custom.attributes.includes(a)} title={ATTRIBUTES[a]?.note} onClick={() => toggle(a)}>
                {ATTRIBUTES[a]?.name ?? capital(a)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="fact custom-from">
        <p className="note">
          Only these stats count. {base ? `${base.name}'s` : 'Boss'} mechanics and protection gear don't apply.
        </p>
        <div className="custom-actions">
          {base && <button type="button" className="text-button" onClick={() => onCopy(base)}>Reset to {base.name}</button>}
        </div>
        <MonsterPicker placeholder="Copy another monster's stats" onPick={(key) => onCopy(monsterInfo.get(key)!)} />
      </div>
    </div>
  );
};
