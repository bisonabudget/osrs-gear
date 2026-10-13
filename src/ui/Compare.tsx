import type { ReactNode } from 'react';
import { itemImage, itemInfo, MonsterInfo } from '../catalog';
import { eitherOf, formatGp, formatPercent, formatSeconds } from '../format';
import { protectionFor } from '../protection';
import type { Outcome, SetupView, Slot } from '../worker/protocol';
import { Coins } from './Coins';
import { Img } from './Img';

const ORDER: Slot[] = ['weapon', 'ammo', 'head', 'cape', 'neck', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
const SLOT_NAMES: Record<Slot, string> = {
  weapon: 'Weapon', ammo: 'Ammo', head: 'Head', cape: 'Cape', neck: 'Neck', body: 'Body',
  shield: 'Shield', legs: 'Legs', hands: 'Hands', feet: 'Feet', ring: 'Ring',
};

interface Row {
  label: string;
  kept: number;
  now: number;
  show: (n: number) => ReactNode;
  /** How the difference reads, or nothing when the two are the same. */
  change: (diff: number) => string;
  /** Whether more is better. */
  higher: boolean;
}

const signed = (text: string, diff: number) => `${diff > 0 ? '+' : '−'}${text}`;

const rowsOf = (kept: Outcome, now: Outcome): Row[] => [
  {
    label: 'Max hit', kept: kept.stats.maxHit, now: now.stats.maxHit, show: (n) => n,
    change: (d) => signed(String(Math.abs(d)), d), higher: true,
  },
  {
    label: 'Accuracy', kept: kept.stats.accuracy, now: now.stats.accuracy, show: formatPercent,
    change: (d) => signed(formatPercent(Math.abs(d)), d), higher: true,
  },
  {
    label: 'Kill time', kept: kept.stats.killTime, now: now.stats.killTime, show: formatSeconds,
    change: (d) => signed(formatSeconds(Math.abs(d)), d), higher: false,
  },
  {
    label: 'Attack speed', kept: kept.stats.attackSpeed * 0.6, now: now.stats.attackSpeed * 0.6, show: (n) => `${n.toFixed(1)}s`,
    change: (d) => signed(`${Math.abs(d).toFixed(1)}s`, d), higher: false,
  },
  {
    label: 'Ammo an hour', kept: kept.setup.ammoCost, now: now.setup.ammoCost, show: (n) => <Coins gp={n} />,
    change: (d) => signed(formatGp(Math.abs(d)), d), higher: false,
  },
  {
    label: 'Setup cost', kept: kept.setup.cost, now: now.setup.cost, show: (n) => <Coins gp={n} />,
    change: (d) => signed(formatGp(Math.abs(d)), d), higher: false,
  },
];

// A blowpipe's dart shows as its ammo.
const idIn = (setup: SetupView, slot: Slot) => setup.items[slot] ?? (slot === 'ammo' && setup.dart !== null ? setup.dart : undefined);

const Item = ({ setup, slot }: { setup: SetupView, slot: Slot }) => {
  const id = idIn(setup, slot);
  const item = id === undefined ? undefined : itemInfo.get(id);
  if (!item) return <span className="compare-item empty">Nothing</span>;
  return (
    <span className="compare-item">
      <Img src={itemImage(item.image)} alt="" />
      <span>{item.name}</span>
    </span>
  );
};

/** One line on what changing from the kept setup to the one now gets for the money. */
const summary = (kept: Outcome, now: Outcome) => {
  const dps = now.stats.dps - kept.stats.dps;
  const gp = now.setup.cost - kept.setup.cost;
  const sameCost = Math.abs(gp) < 1;
  const money = `${formatGp(Math.abs(gp))} ${gp > 0 ? 'more' : 'less'}`;
  if (Math.abs(dps) < 0.005) return sameCost ? 'Both do the same DPS for the same cost.' : `Both do the same DPS, and the one now costs ${money}.`;
  const share = kept.stats.dps > 0 ? ` (${formatPercent(Math.abs(dps) / kept.stats.dps)})` : '';
  return `The one now does ${Math.abs(dps).toFixed(2)} ${dps > 0 ? 'more' : 'less'} DPS${share} ${sameCost ? 'for the same cost' : `for ${money}`}.`;
};

interface Props {
  kept: Outcome;
  now: Outcome;
  monster: MonsterInfo;
  busy: boolean;
  /** Puts the kept setup back on. */
  onWearKept: () => void;
  /** Keeps the setup now in place of the kept one. */
  onKeepNow: () => void;
  onStop: () => void;
}

/** The kept setup and the one now, side by side against the same monster. */
export const Compare = ({ kept, now, monster, busy, onWearKept, onKeepNow, onStop }: Props) => {
  const dps = now.stats.dps - kept.stats.dps;
  const slots = ORDER.filter((s) => idIn(kept.setup, s) !== undefined || idIn(now.setup, s) !== undefined);
  const guard = protectionFor(monster.name);
  const unprotected = guard && guard.items.length > 0 && !guard.items.includes(itemInfo.get(kept.setup.items[guard.slot] ?? -1)?.name ?? '');
  return (
    <div className={`compare${busy ? ' busy' : ''}`}>
      <div className="compare-head">
        <p className="label">Comparing against {monster.name}</p>
        <button type="button" className="text-button" onClick={onStop}>Stop comparing</button>
      </div>

      <div className="compare-grid">
        <span />
        <p className="label">Kept</p>
        <p className="label">Now</p>

        <p className="label compare-dps-label">DPS</p>
        <p className="compare-dps">{kept.stats.dps.toFixed(2)}</p>
        <p className="compare-dps">
          {now.stats.dps.toFixed(2)}
          {Math.abs(dps) >= 0.005 && (
            <small className={dps > 0 ? 'better' : 'worse'}>{signed(Math.abs(dps).toFixed(2), dps)}</small>
          )}
        </p>

        {rowsOf(kept, now).map((r) => {
          const diff = r.now - r.kept;
          const changed = Math.abs(diff) > (r.label === 'Accuracy' ? 0.0005 : 0.01);
          const better = (diff > 0) === r.higher;
          return (
            <div className="compare-row" key={r.label}>
              <span className="compare-label">{r.label}</span>
              <span>{r.show(r.kept)}</span>
              <span>
                {r.show(r.now)}
                {changed && <small className={better ? 'better' : 'worse'}>{r.change(diff)}</small>}
              </span>
            </div>
          );
        })}
      </div>

      <p className="compare-summary">{summary(kept, now)}</p>
      {unprotected && (
        <p className="over">The kept setup has no {eitherOf(guard.items)}, which {monster.name} needs in the {guard.slot} slot.</p>
      )}

      <ul className="compare-gear">
        {slots.map((slot) => (
          <li key={slot} className={idIn(kept.setup, slot) === idIn(now.setup, slot) ? 'same' : 'changed'}>
            <span className="compare-label">{SLOT_NAMES[slot]}</span>
            <Item setup={kept.setup} slot={slot} />
            <Item setup={now.setup} slot={slot} />
          </li>
        ))}
      </ul>

      <div className="compare-actions">
        <button type="button" onClick={onWearKept}>Wear the kept setup</button>
        <button type="button" onClick={onKeepNow}>Keep this one instead</button>
      </div>
    </div>
  );
};
