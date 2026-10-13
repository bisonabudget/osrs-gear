// Loads a setup's pictures before it is shown, so it appears with every picture in place and
// never has a gap where one is still on its way.
import { itemImage, itemInfo, wikiImage } from '../catalog';
import type { Outcome } from '../worker/protocol';
import { supplyImage } from './Results';

// Each picture loaded is held while the page is open, so the browser keeps it ready to show at once.
const loaded = new Map<string, { image: HTMLImageElement, done: Promise<void> }>();

const load = (src: string): Promise<void> => {
  let entry = loaded.get(src);
  if (!entry) {
    const image = new Image();
    image.src = src;
    // A picture that fails is left to the <Img> on the page, which tries it again.
    entry = { image, done: image.decode().catch(() => { loaded.delete(src); }) };
    loaded.set(src, entry);
  }
  return entry.done;
};

/** Every picture shown with a setup: what it wears, what it uses up and its upgrades. */
export const picturesOf = ({ setup, upgrades }: Outcome): string[] => {
  const ids = [...Object.values(setup.items), setup.dart, ...upgrades.map((u) => u.itemId)];
  const items = ids.flatMap((id) => {
    const item = id === null || id === undefined ? undefined : itemInfo.get(id);
    return item ? [itemImage(item.image)] : [];
  });
  return [...new Set([...items, ...setup.uses.map(supplyImage), ...(setup.spell ? [wikiImage(setup.spell)] : [])])];
};

/** Waits until every picture has loaded or failed, or until the wait is over, whichever is first. */
export const preload = (srcs: string[], wait: number): Promise<void> => new Promise((resolve) => {
  const timer = setTimeout(resolve, wait);
  void Promise.all(srcs.map(load)).then(() => {
    clearTimeout(timer);
    resolve();
  });
});
