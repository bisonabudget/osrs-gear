// The game's side panel: tabs along the top, the worn equipment in the middle.
import { useEffect, useMemo, useState } from 'react';
import { itemImage, itemInfo, wikiImage } from '../catalog';
import { formatGp, listOf } from '../format';
import type { Character } from '../hiscores';
import type { Bonuses, Outcome, Skills, Slot, SlotOption } from '../worker/protocol';
import { Coins } from './Coins';
import { Img } from './Img';
import { preload } from './preload';

type Tab = 'combat' | 'skills' | 'quests' | 'gear' | 'prayer' | 'magic';

// Quests stays hidden until quest and diary unlocks are checked. Set hidden to false to bring it back.
const TABS: { id: Tab, label: string, icon: string, hidden?: boolean }[] = [
  { id: 'combat', label: 'Combat', icon: 'Combat icon' },
  { id: 'skills', label: 'Skills', icon: 'Stats icon' },
  { id: 'quests', label: 'Quests', icon: 'Quest list icon', hidden: true },
  { id: 'gear', label: 'Gear', icon: 'Worn Equipment' },
  { id: 'prayer', label: 'Prayer', icon: 'Prayer icon' },
  { id: 'magic', label: 'Magic', icon: 'Magic icon' },
];

// Where each slot sits in the game's Worn Equipment tab, by row and column.
const LAYOUT: [Slot, number, number][] = [
  ['head', 1, 2],
  ['cape', 2, 1], ['neck', 2, 2], ['ammo', 2, 3],
  ['weapon', 3, 1], ['body', 3, 2], ['shield', 3, 3],
  ['legs', 4, 2],
  ['hands', 5, 1], ['feet', 5, 2], ['ring', 5, 3],
];

const SLOT_NAMES: Record<Slot, string> = {
  head: 'Head', cape: 'Cape', neck: 'Neck', ammo: 'Ammo', weapon: 'Weapon', body: 'Body',
  shield: 'Shield', legs: 'Legs', hands: 'Hands', feet: 'Feet', ring: 'Ring',
};

const SKILLS: { id: keyof Skills, name: string }[] = [
  { id: 'atk', name: 'Attack' },
  { id: 'str', name: 'Strength' },
  { id: 'def', name: 'Defence' },
  { id: 'ranged', name: 'Ranged' },
  { id: 'magic', name: 'Magic' },
  { id: 'prayer', name: 'Prayer' },
  { id: 'hp', name: 'Hitpoints' },
  { id: 'agility', name: 'Agility' },
  { id: 'slayer', name: 'Slayer' },
  { id: 'mining', name: 'Mining' },
  { id: 'herblore', name: 'Herblore' },
];

const STYLES: (keyof Bonuses)[] = ['stab', 'slash', 'crush', 'magic', 'ranged'];

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

const POTION_IMAGES: Record<string, string> = {
  'Super combat': 'Super combat potion(4)',
  'Ranging potion': 'Ranging potion(4)',
  'Saturated heart': 'Saturated heart',
  'Magic potion': 'Magic potion(4)',
  'Smelling salts': 'Smelling salts (2)',
  'Overload (+)': 'Overload (+)(4)',
};

interface Props {
  outcome: Outcome | null;
  skills: Skills;
  rsn: Omit<Character, 'skills'> | null;
  onSkills: (skills: Skills) => void;
  loadSlot: (slot: Slot) => Promise<SlotOption[]>;
  onChoose: (option: SlotOption) => void;
  /** A new setup is being worked out, so the one on show is about to change. */
  busy: boolean;
}

export const Panel = ({ outcome, skills, rsn, onSkills, loadSlot, onChoose, busy }: Props) => {
  const [tab, setTab] = useState<Tab>('gear');
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);
  const [showStats, setShowStats] = useState(false);

  return (
    <div className="osrs">
      <div className="osrs-tabs" role="tablist">
        {TABS.filter((t) => !t.hidden).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'on' : ''}
            title={t.label}
            onClick={() => {
              setTab(t.id);
              setOpenSlot(null);
            }}
          >
            <Img src={wikiImage(t.icon)} alt={t.label} />
          </button>
        ))}
      </div>
      {/* Levels stay editable while a new setup is worked out. */}
      <div className={`osrs-body${busy && tab !== 'skills' ? ' busy' : ''}`} role="tabpanel" aria-busy={busy}>
        {tab === 'gear' && (openSlot
          ? <SlotList slot={openSlot} current={outcome?.setup.items[openSlot]} load={loadSlot} onClose={() => setOpenSlot(null)} onChoose={(o) => { onChoose(o); setOpenSlot(null); }} />
          : showStats && outcome
            ? <EquipmentStats outcome={outcome} />
            : <WornEquipment outcome={outcome} onOpen={setOpenSlot} />)}
        {tab === 'gear' && !openSlot && (
          <div className="osrs-buttons">
            <button type="button" className={showStats ? '' : 'on'} aria-pressed={!showStats} onClick={() => setShowStats(false)}>Worn equipment</button>
            <button type="button" className={showStats ? 'on' : ''} aria-pressed={showStats} onClick={() => setShowStats(true)}>Equipment stats</button>
          </div>
        )}
        {tab === 'combat' && <CombatTab outcome={outcome} />}
        {tab === 'skills' && <SkillsTab skills={skills} rsn={rsn} onSkills={onSkills} />}
        {tab === 'quests' && (
          <div className="osrs-note">
            <p className="osrs-title">Quests</p>
            <p>Quests and diaries aren't checked yet, so gear that needs one counts as unlocked.</p>
            <p>Use the Kandarin diary switch to say whether you've done the hard diary, as it changes enchanted bolt DPS.</p>
          </div>
        )}
        {tab === 'prayer' && outcome && (
          <div className="osrs-note">
            <p className="osrs-title">Prayer and potion</p>
            {outcome.stats.prayers.length
              ? outcome.stats.prayers.map((p) => <div key={p} className="boost"><Img src={wikiImage(p)} alt="" />{p}</div>)
              : <p>No combat prayer at this Prayer level.</p>}
            <div className="boost"><Img src={wikiImage(POTION_IMAGES[outcome.stats.potion] ?? outcome.stats.potion)} alt="" />{outcome.stats.potion}</div>
            <p className="osrs-small">The best prayer your Prayer and Defence levels allow and the best potion for the style are assumed.</p>
            {outcome.stats.effects.length > 0 && <p className="osrs-small">Also counting {listOf(outcome.stats.effects)}.</p>}
          </div>
        )}
        {tab === 'magic' && outcome && (
          <div className="osrs-note">
            <p className="osrs-title">Spell</p>
            {outcome.setup.spell
              ? <div className="boost"><Img src={wikiImage(outcome.setup.spell)} alt="" />{outcome.setup.spell}</div>
              : <p>This setup doesn't cast spells.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const WornEquipment = ({ outcome, onOpen }: { outcome: Outcome | null, onOpen: (slot: Slot) => void }) => (
  <div className="worn">
    {LAYOUT.map(([slot, row, col]) => {
      const id = outcome?.setup.items[slot];
      const item = id === undefined ? undefined : itemInfo.get(id);
      const price = outcome?.setup.prices[slot];
      return (
        <button
          key={slot}
          type="button"
          className={`slot${item ? ' filled' : ''}`}
          style={{ gridRow: row, gridColumn: col }}
          onClick={() => onOpen(slot)}
          title={item ? `${item.name}${price ? ` (${formatGp(price)})` : item.untradeable ? ' (untradeable)' : ''}` : `${SLOT_NAMES[slot]} slot`}
          aria-label={item ? `${SLOT_NAMES[slot]}: ${item.name}` : `${SLOT_NAMES[slot]} slot, empty`}
        >
          <Img src={item ? itemImage(item.image) : wikiImage(`${SLOT_NAMES[slot]} slot`)} alt="" className={item ? '' : 'ghost'} />
        </button>
      );
    })}
  </div>
);

// The game's Equipment Stats screen: what the worn items add up to.
const EquipmentStats = ({ outcome: { stats } }: { outcome: Outcome }) => (
  <section className="stats">
    <p className="label">Equipment stats</p>
    <table>
      <thead>
        <tr><th /><th>Stab</th><th>Slash</th><th>Crush</th><th>Magic</th><th>Range</th></tr>
      </thead>
      <tbody>
        <tr><th>Attack</th>{STYLES.map((s) => <td key={s}>{signed(stats.offensive[s])}</td>)}</tr>
        <tr><th>Defence</th>{STYLES.map((s) => <td key={s}>{signed(stats.defensive[s])}</td>)}</tr>
      </tbody>
    </table>
    <dl className="other">
      <div><dt>Melee strength</dt><dd>{signed(stats.strength.melee)}</dd></div>
      <div><dt>Ranged strength</dt><dd>{signed(stats.strength.ranged)}</dd></div>
      <div><dt>Magic damage</dt><dd>{signed(stats.strength.magic / 10)}%</dd></div>
      <div><dt>Prayer</dt><dd>{signed(stats.strength.prayer)}</dd></div>
    </dl>
  </section>
);

// About as many rows as the list shows before scrolling.
const FIRST_ROWS = 10;

const SlotList = ({ slot, current, load, onClose, onChoose }: {
  slot: Slot,
  current: number | undefined,
  load: (slot: Slot) => Promise<SlotOption[]>,
  onClose: () => void,
  onChoose: (o: SlotOption) => void,
}) => {
  const [options, setOptions] = useState<SlotOption[] | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let stale = false;
    setOptions(null);
    load(slot).then(async (o) => {
      // The rows on screen when the list opens show with their pictures already in.
      await preload(o.slice(0, FIRST_ROWS).flatMap((x) => {
        const item = itemInfo.get(x.itemId);
        return item ? [itemImage(item.image)] : [];
      }), 600);
      if (!stale) setOptions(o);
    }).catch(() => !stale && setOptions([]));
    return () => {
      stale = true;
    };
  }, [slot, load]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (id: number) => itemInfo.get(id)?.name.toLowerCase().includes(q);
    return (options ?? []).filter((o) => !q || matches(o.itemId) || o.alike.some(matches)).slice(0, 150);
  }, [options, query]);

  return (
    <div className="slot-list">
      <div className="slot-list-head">
        <span className="osrs-title">{SLOT_NAMES[slot]}</span>
        <button type="button" className="osrs-close" onClick={onClose} aria-label="Back to worn equipment">×</button>
      </div>
      <input
        className="osrs-search"
        type="search"
        placeholder={`Search ${SLOT_NAMES[slot].toLowerCase()} items`}
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="slot-list-cols"><span>Item</span><span>DPS</span><span>Price</span></div>
      <ul>
        {!options && <li className="osrs-small">Working out every item…</li>}
        {shown.map((o) => {
          const item = itemInfo.get(o.itemId)!;
          const alike = o.alike.map((id) => itemInfo.get(id)?.name ?? '');
          return (
            <li key={o.itemId}>
              <button type="button" className={o.itemId === current ? 'current' : ''} onClick={() => onChoose(o)}>
                <Img src={itemImage(item.image)} alt="" loading="lazy" />
                <span className="slot-item-name">
                  {item.name}
                  {alike.length > 0 && (
                    <small title={`Same stats: ${listOf(alike)}`}>
                      {alike.length === 1 ? `Same stats as ${alike[0]}` : `Same stats as ${alike.length} others`}
                    </small>
                  )}
                </span>
                <span className="slot-item-dps">{o.dps.toFixed(2)}</span>
                {item.untradeable && !o.madeFrom
                  ? <span className="coins coins-untradeable">Free</span>
                  : <Coins gp={o.price} title={o.madeFrom ?? undefined} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const CombatTab = ({ outcome }: { outcome: Outcome | null }) => {
  if (!outcome) return null;
  const weapon = outcome.setup.items.weapon === undefined ? undefined : itemInfo.get(outcome.setup.items.weapon);
  const { style } = outcome.setup;
  const ticks = outcome.stats.attackSpeed;
  return (
    <div className="osrs-note">
      <div className="combat-weapon">
        {weapon && <Img src={itemImage(weapon.image)} alt="" />}
        <span>{weapon?.name ?? 'Unarmed'}</span>
      </div>
      <dl className="osrs-facts">
        <dt>Style</dt><dd>{style.name}</dd>
        <dt>Attack type</dt><dd className="cap">{style.type}</dd>
        <dt>Stance</dt><dd>{style.stance}</dd>
        <dt>Speed</dt><dd>{ticks} ticks ({(ticks * 0.6).toFixed(1)}s)</dd>
      </dl>
      <p className="osrs-small">Special attacks aren't counted.</p>
    </div>
  );
};

/** A level box that can be emptied while typing. The level changes once it reads 1 to 99. */
const LevelInput = ({ value, onChange }: { value: number, onChange: (level: number) => void }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={2}
      value={draft}
      onChange={(e) => {
        const text = e.target.value.replace(/\D/g, '');
        setDraft(text);
        const level = Number(text);
        if (level >= 1 && level <= 99) onChange(level);
      }}
      onFocus={(e) => e.target.select()}
      onBlur={() => setDraft(String(value))}
    />
  );
};

const SkillsNote = ({ rsn }: { rsn: Props['rsn'] }) => {
  if (!rsn) return <p className="osrs-small">No RSN loaded. Enter yours at the top to fill in your levels, or set them here.</p>;
  const one = rsn.missing.length === 1;
  return (
    <p className="osrs-small">
      Levels for {rsn.name} from the hiscores. You can still change them.
      {rsn.missing.length > 0 && ` ${listOf(rsn.missing)} ${one ? "isn't" : "aren't"} on the hiscores, so check ${one ? 'it' : 'them'}.`}
    </p>
  );
};

const SkillsTab = ({ skills, rsn, onSkills }: { skills: Skills, rsn: Props['rsn'], onSkills: (s: Skills) => void }) => (
  <div className="osrs-note">
    <div className="skills">
      {SKILLS.map((s) => (
        <label key={s.id} className="skill" title={s.name}>
          <Img src={wikiImage(`${s.name} icon`)} alt={s.name} />
          <LevelInput value={skills[s.id]} onChange={(level) => onSkills({ ...skills, [s.id]: level })} />
        </label>
      ))}
    </div>
    <SkillsNote rsn={rsn} />
  </div>
);
