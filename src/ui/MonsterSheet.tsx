import type { ReactNode } from 'react';
import { DEFENCES, MonsterInfo, Offence, Skill, monsterImage, wikiImage } from '../catalog';
import { listOf } from '../format';
import type { Defence, Stats } from '../worker/protocol';

export const DEFENCE_INFO: Record<Defence, { name: string, icon: string }> = {
  stab: { name: 'Stab', icon: 'White dagger' },
  slash: { name: 'Slash', icon: 'White scimitar' },
  crush: { name: 'Crush', icon: 'White warhammer' },
  magic: { name: 'Magic', icon: 'Magic icon' },
  light: { name: 'Light ranged', icon: 'Steel dart' },
  standard: { name: 'Standard ranged', icon: 'Steel arrow 5' },
  heavy: { name: 'Heavy ranged', icon: 'Steel bolts 5' },
};

const RANGED: Defence[] = ['light', 'standard', 'heavy'];

// Only the notes we can stand behind; the rest show the name alone.
export const ATTRIBUTES: Record<string, { name: string, note?: string }> = {
  demon: { name: 'Demon', note: 'Demonbane weapons like Arclight are more accurate and do more damage.' },
  dragon: { name: 'Dragon', note: 'Dragon hunter weapons are more accurate and do more damage.' },
  fiery: { name: 'Fiery' },
  flying: { name: 'Flying' },
  golem: { name: 'Golem', note: 'The barronite mace does more damage.' },
  kalphite: { name: 'Kalphite', note: 'The keris does more damage.' },
  leafy: { name: 'Leafy' },
  penance: { name: 'Penance' },
  rat: { name: 'Rat' },
  shade: { name: 'Shade' },
  spectral: { name: 'Spectral' },
  undead: { name: 'Undead', note: 'A salve amulet adds accuracy and damage.' },
  vampyre1: { name: 'Vampyre, tier 1' },
  vampyre2: { name: 'Vampyre, tier 2' },
  vampyre3: { name: 'Vampyre, tier 3' },
  xerician: { name: 'Xerician' },
};

const BURN: Record<string, string> = {
  Weak: 'Immune to weak burns',
  Normal: 'Immune to weak and normal burns',
  Strong: 'Immune to all burns',
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The monster's picture, name and combat level. */
export const MonsterHead = ({ monster, copiedFrom }: { monster: MonsterInfo, copiedFrom?: string }) => (
  <div className="monster-head">
    <img className="monster-art" key={monster.image} src={monsterImage(monster.image)} alt="" />
    <div>
      <h1 className={`monster-name${monster.name.length > 13 ? ' long' : ''}`}>{monster.name}</h1>
      <p className="monster-level">
        {copiedFrom ? `Copied from ${copiedFrom}` : `Combat ${monster.level}`}
        {monster.boss && <span> · Boss</span>}
        <span> · Size {monster.size}</span>
      </p>
    </div>
  </div>
);

interface Cell { name: string, icon: string, value: string, className?: string }

const COMBAT: [Skill, string, string][] = [
  ['hp', 'Hitpoints', 'Hitpoints icon'], ['atk', 'Attack', 'Attack icon'], ['str', 'Strength', 'Strength icon'],
  ['def', 'Defence', 'Defence icon'], ['magic', 'Magic', 'Magic icon'], ['ranged', 'Ranged', 'Ranged icon'],
];
const AGGRESSIVE: [Offence, string, string][] = [
  ['atk', 'Attack bonus', 'Attack icon'], ['str', 'Strength bonus', 'Strength icon'],
  ['magic', 'Magic bonus', 'Magic icon'], ['magicStr', 'Magic damage', 'Magic Damage icon'],
  ['ranged', 'Ranged bonus', 'Ranged icon'], ['rangedStr', 'Ranged strength', 'Ranged Strength icon'],
];

const StatRow = ({ title, cells, half, children }: { title: string, cells: Cell[], half?: boolean, children?: ReactNode }) => (
  <div className={`stat-group${half ? ' half' : ''}`}>
    <p className="stat-title">{title}</p>
    <ul>
      {cells.map((c) => (
        <li key={c.name} className={c.className} title={c.name}>
          <img src={wikiImage(c.icon)} alt="" />
          <span className="sr-only">{c.name}</span>
          <span className="stat-value">{c.value}</span>
        </li>
      ))}
      {children}
    </ul>
  </div>
);

interface Props {
  monster: MonsterInfo;
  /** The setup on show, to say how it meets the monster. Null while there isn't one for this monster. */
  stats: Stats | null;
  spell: string | null;
}

/** What the monster is weak to and how the setup on show meets it. */
export const MonsterFacts = ({ monster, stats, spell }: Props) => {
  const { weakness, defence } = monster;

  // How hard each kind of attack finds it to hit: magic is defended with the Magic level, the rest with Defence.
  const roll = (d: Defence) => ((d === 'magic' ? monster.skills.magic : monster.skills.def) + 9) * (defence[d] + 64);
  const easiest = Math.min(...DEFENCES.map(roll));
  const easy = DEFENCES.filter((d) => roll(d) === easiest);

  const against = stats?.against ?? null;
  const hits = (d: Defence) => against === d || (against === 'mixed' && RANGED.includes(d));

  const usesWeakness = weakness !== null && stats?.element === weakness.element;
  const weaknessNote = weakness && (usesWeakness && spell
    ? `Your ${spell} gets ${weakness.severity}% more accuracy and damage from its ${weakness.element} weakness.`
    : `${capital(weakness.element)} spells get ${weakness.severity}% more accuracy and damage.`);
  const seconds = monster.speed > 0 ? (monster.speed * 0.6).toFixed(1) : null;

  const defenceCell = (d: Defence): Cell => ({
    name: `${DEFENCE_INFO[d].name} defence`,
    icon: DEFENCE_INFO[d].icon,
    value: signed(defence[d]),
    className: `${easy.includes(d) && easy.length < DEFENCES.length ? 'easy' : ''}${hits(d) ? ' hit' : ''}`,
  });

  return (
    <div className="monster-facts">
      <section className="statbox" aria-label="Monster stats">
        <StatRow
          title="Combat stats"
          cells={COMBAT.map(([k, name, icon]) => ({ name, icon, value: monster.skills[k].toLocaleString('en-GB') }))}
        />
        <StatRow
          title="Aggressive stats"
          cells={AGGRESSIVE.map(([k, name, icon]) => ({
            name, icon, value: `${signed(monster.offence[k])}${k === 'magicStr' ? '%' : ''}`,
          }))}
        />
        <StatRow title="Melee defence" half cells={(['stab', 'slash', 'crush'] as Defence[]).map(defenceCell)} />
        <StatRow title="Ranged defence" half cells={RANGED.map(defenceCell)} />
        <StatRow title="Magic defence" half cells={[defenceCell('magic')]} />
        <StatRow title="Weakness" half cells={[]}>
          <li className={`weakness${usesWeakness ? ' used' : ''}`} title={weakness ? `${capital(weakness.element)} weakness` : 'Elemental weakness'}>
            {weakness && <img src={wikiImage(`${capital(weakness.element)} rune`)} alt="" />}
            <span className="stat-value">{weakness ? `${weakness.severity}%` : 'None'}</span>
          </li>
        </StatRow>
        {weaknessNote && <p className="note">{weaknessNote}</p>}
      </section>

      <dl className="facts">
        {monster.attributes.length > 0 && (
          <div className="fact">
            <dt>Attributes</dt>
            <dd>
              <ul className="tags">
                {monster.attributes.map((a) => {
                  const info = ATTRIBUTES[a] ?? { name: capital(a) };
                  return <li key={a} title={info.note}>{info.name}</li>;
                })}
              </ul>
              {monster.attributes.some((a) => ATTRIBUTES[a]?.note) && (
                <small>{monster.attributes.flatMap((a) => ATTRIBUTES[a]?.note ?? []).join(' ')}</small>
              )}
            </dd>
          </div>
        )}
        {monster.armour !== 0 && (
          <div className="fact">
            <dt>Armour</dt>
            <dd>
              {monster.armour > 0
                ? `Takes ${monster.armour} off every melee and ranged hit`
                : `Adds ${-monster.armour} to every melee and ranged hit`}
            </dd>
          </div>
        )}
        {monster.burn && <div className="fact"><dt>Burn</dt><dd>{BURN[monster.burn] ?? monster.burn}</dd></div>}
        {monster.attacks.length > 0 && (
          <div className="fact">
            <dt>Attacks</dt>
            <dd>
              {capital(listOf(monster.attacks.map((a) => a.toLowerCase())))}
              {seconds && <small>Every {seconds} seconds</small>}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
};
