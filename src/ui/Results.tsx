import { itemImage, itemInfo, MonsterInfo, wikiImage } from '../catalog';
import { protectionFor } from '../protection';
import {
  formatAgo, formatAmount, formatGp, formatPercent, formatSeconds, listOf,
} from '../format';
import type { Outcome, SetupView, Slot, Use } from '../worker/protocol';
import { Coins, Untradeable } from './Coins';

const ORDER: Slot[] = ['weapon', 'ammo', 'head', 'cape', 'neck', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
type Part = { outcome: Outcome };

/** The DPS, and whether the spell uses the monster's weakness. */
const Headline = ({ outcome: { stats }, monster }: Part & { monster: MonsterInfo }) => {
  const weakness = monster.weakness && stats.element === monster.weakness.element ? monster.weakness : null;
  return (
    <div className="headline">
      <p className="label">DPS</p>
      <p className="dps">{stats.dps.toFixed(2)}</p>
      {weakness && (
        <p className="edge">
          <img src={wikiImage(`${weakness.element[0].toUpperCase()}${weakness.element.slice(1)} rune`)} alt="" />
          Uses its {weakness.element} weakness for {weakness.severity}% more accuracy and damage
        </p>
      )}
    </div>
  );
};

const Figures = ({ outcome: { stats } }: Part) => (
  <>
    <div className="figure">
      <p className="label">Max hit</p>
      <div className="hitsplat">
        <img src={wikiImage('Damage hitsplat')} alt="" />
        <span>{stats.maxHit}</span>
      </div>
    </div>
    <div className="figure">
      <p className="label">Accuracy</p>
      <p className="figure-value">{formatPercent(stats.accuracy)}</p>
    </div>
    <div className="figure">
      <p className="label">Kill time</p>
      <p className="figure-value">{formatSeconds(stats.killTime)}</p>
    </div>
  </>
);

const KINDS: Use['kind'][] = ['ammo', 'runes', 'charges'];

// The Wiki only has pictures of these by the size of the stack, so the biggest stack is shown.
const STACKS: Record<string, string> = {
  Coins: 'Coins 10000',
  "Zulrah's scales": "Zulrah's scales 5",
  'Revenant ether': 'Revenant ether 5',
  'Sunfire splinters': 'Sunfire splinters 4',
};

const useImage = (use: Use) => {
  const item = use.id === null ? undefined : itemInfo.get(use.id);
  if (item) return itemImage(item.image);
  return wikiImage(STACKS[use.name] ?? use.name);
};

/** An hour of the ammo, runes and charges the setup uses, which can be opened to see each. */
const Supplies = ({ setup }: { setup: SetupView }) => {
  const uses = [...setup.uses].sort((x, y) => KINDS.indexOf(x.kind) - KINDS.indexOf(y.kind) || y.gp - x.gp);
  const kinds = KINDS.filter((k) => uses.some((u) => u.kind === k));
  return (
    <details className="maths supplies">
      <summary>Includes <Coins gp={setup.ammoCost} /> of {listOf(kinds)} for an hour of attacking</summary>
      <ul className="bill">
        {uses.map((u) => (
          <li key={`${u.kind}|${u.id ?? u.name}`}>
            <img src={useImage(u)} alt="" />
            <span className="bill-name">
              {u.name}
              <small className="bill-from">{formatAmount(u.perHour)} an hour</small>
            </span>
            <Coins gp={u.gp} />
          </li>
        ))}
      </ul>
    </details>
  );
};

/** What the whole setup costs, and how much of that is used up as it attacks. */
const CostTotal = ({ outcome: { setup }, budget, onKeep }: Part & { budget: number, onKeep: () => void }) => (
  <>
    <p className="label">Setup cost</p>
    <div className="cost-total">
      <Coins gp={setup.cost} />
      <button type="button" className="text-button" onClick={onKeep}>Keep to compare</button>
    </div>
    {setup.cost > budget && <p className="over">{formatGp(setup.cost - budget)} over your budget</p>}
    {setup.uses.length > 0 && <Supplies setup={setup} />}
  </>
);

/** Each item worn and its price, and what the monster makes the player wear. */
const Bill = ({ outcome: { setup }, monster }: Part & { monster: MonsterInfo }) => {
  const protection = protectionFor(monster.name);
  return (
  <ul className="bill">
    {ORDER.filter((s) => setup.items[s] !== undefined).map((slot) => {
      const item = itemInfo.get(setup.items[slot]!)!;
      const time = setup.priceTimes[slot];
      const made = setup.madeFrom[slot];
      const earned = item.untradeable && !made;
      return (
        <li key={slot}>
          <img src={itemImage(item.image)} alt="" />
          <span className="bill-name">
            {item.name}
            {made && <small className="bill-from">{made}</small>}
            {protection?.slot === slot && <small className="bill-from">Needed against {protection.against}</small>}
          </span>
          {earned && <Untradeable name={item.name} />}
          {!earned && slot === setup.ammoSlot && <span className="note">In ammo cost</span>}
          {!earned && slot !== setup.ammoSlot && (
            <Coins gp={setup.prices[slot] ?? 0} title={time ? `Last traded ${formatAgo(time)}` : undefined} />
          )}
        </li>
      );
    })}
    {setup.dart !== null && itemInfo.get(setup.dart) && (
      <li>
        <img src={itemImage(itemInfo.get(setup.dart)!.image)} alt="" />
        <span className="bill-name">{itemInfo.get(setup.dart)!.name}</span>
        <span className="note">In ammo cost</span>
      </li>
    )}
    {protection?.held && (
      <li>
        <img src={wikiImage(protection.held)} alt="" />
        <span className="bill-name">
          {protection.held}
          <small className="bill-from">Held in the shield slot, needed against {protection.against}</small>
        </span>
        <span className="note">Not in the DPS</span>
      </li>
    )}
  </ul>
  );
};

const Maths = ({ outcome: { stats } }: Part) => (
  <details className="maths">
    <summary>Show the maths</summary>
    <p className="note">
      Worked out by the OSRS Wiki's DPS calculator with {stats.prayers.length
        ? `${listOf([...stats.prayers, stats.potion.toLowerCase(), ...stats.effects])} active.`
        : `${listOf([stats.potion.toLowerCase(), ...stats.effects])} active and no prayer.`}
    </p>
    <dl>
      {stats.details.map((d, i) => (
        <div key={i} className={d.highlight ? 'highlight' : ''}><dt>{d.label}</dt><dd>{d.value}</dd></div>
      ))}
    </dl>
  </details>
);

interface Props {
  outcome: Outcome;
  monster: MonsterInfo;
  budget: number;
  busy: boolean;
  /** Keeps this setup for a Comparison. */
  onKeep: () => void;
}

/** Everything about the setup on show, in one column. */
export const Results = ({ outcome, monster, budget, busy, onKeep }: Props) => (
  <div className={`results${busy ? ' busy' : ''}`}>
    <div className="hero">
      <Headline outcome={outcome} monster={monster} />
      <div className="figures"><Figures outcome={outcome} /></div>
    </div>
    <section className="cost">
      <CostTotal outcome={outcome} budget={budget} onKeep={onKeep} />
      <Bill outcome={outcome} monster={monster} />
    </section>
    <Maths outcome={outcome} />
  </div>
);
