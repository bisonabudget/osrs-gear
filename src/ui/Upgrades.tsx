import { itemImage, itemInfo } from '../catalog';
import { formatGp, formatSeconds } from '../format';
import type { Outcome, UpgradeView } from '../worker/protocol';
import { Coins } from './Coins';
import { Img } from './Img';

interface Props {
  outcome: Outcome;
  budget: number;
  /** Raises the budget enough to afford the upgrade, or wears it when the budget already covers it. */
  onTake: (upgrade: UpgradeView) => void;
  /** A new setup is being worked out, so these upgrades are about to change. */
  busy: boolean;
}

export const Upgrades = ({ outcome, budget, onTake, busy }: Props) => {
  // With no limit the best setup already has the most DPS there is.
  if (budget === Infinity && outcome.upgrades.length === 0) return null;
  return (
    <section className={`upgrades${busy ? ' busy' : ''}`} aria-busy={busy}>
      <h2 className="label">Next upgrades</h2>
      {outcome.upgrades.length === 0 && <p className="empty">Nothing you can wear adds more DPS here.</p>}
      <ul>
        {outcome.upgrades.map((u) => {
          const item = itemInfo.get(u.itemId)!;
          const total = outcome.setup.cost + u.netCost;
          return (
            <li key={u.itemId}>
              <button
                type="button"
                onClick={() => onTake(u)}
                title={total > budget ? `Raise the budget to ${formatGp(total)}` : `Wear ${item.name}`}
              >
                <span className="upgrade-icon"><Img src={itemImage(item.image)} alt="" /></span>
                <span className="upgrade-name">{item.name}</span>
                <span className="upgrade-gain">
                  +{u.gain.toFixed(2)} DPS
                  {u.timeSaved !== null && u.timeSaved > 0 && <span className="upgrade-time">−{formatSeconds(u.timeSaved)} per kill</span>}
                </span>
                <Coins gp={u.netCost} sign />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
