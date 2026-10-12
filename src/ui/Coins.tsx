import { coinTone, formatGp } from '../format';
import { wikiPage } from '../catalog';

/** A price shown like a coin stack in game: yellow, white or green by size. */
export const Coins = ({ gp, sign = false, title }: { gp: number, sign?: boolean, title?: string }) => (
  <span className={`coins coins-${coinTone(Math.abs(gp))}`} title={title}>
    {sign && gp > 0 ? '+' : ''}
    {formatGp(gp)}
  </span>
);

/** An item earned in game, with nothing to pay for, links to its Wiki page instead. */
export const Untradeable = ({ name }: { name: string }) => (
  <a className="coins coins-untradeable" href={wikiPage(name)} target="_blank" rel="noreferrer" title="Earned in game, so it counts as free. Opens the Wiki.">
    Untradeable
  </a>
);
