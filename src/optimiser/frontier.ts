// For the gear slots the search fills generically, the combinations worth considering: every
// combination that no other beats on cost, accuracy bonus and strength bonus at once.
// Combinations are built a slot at a time and pruned after each slot.
import type { Item, Slot } from '../engine/data';

/** One option for a slot: an item (or nothing) with its cost and the two bonuses that matter. */
export interface Option {
  item: Item | null;
  cost: number;
  a: number;
  s: number;
}

/** A combination of options, one per slot, stored as a chain back to the first slot. */
export interface Point {
  cost: number;
  a: number;
  s: number;
  slot: Slot | null;
  item: Item | null;
  prev: Point | null;
}

export const itemsOf = (p: Point | null): Map<Slot, Item> => {
  const out = new Map<Slot, Item>();
  for (let q = p; q; q = q.prev) if (q.slot && q.item) out.set(q.slot, q.item);
  return out;
};

// Fenwick tree over accuracy ranks (rank 0 is the highest accuracy), holding the highest
// strength seen at or above each accuracy.
class MaxTree {
  private readonly t: Float64Array;

  constructor(n: number) {
    this.t = new Float64Array(n + 1).fill(-Infinity);
  }

  update(i: number, v: number) {
    for (i += 1; i < this.t.length; i += i & -i) if (this.t[i] < v) this.t[i] = v;
  }

  query(i: number) {
    let best = -Infinity;
    for (i += 1; i > 0; i -= i & -i) if (this.t[i] > best) best = this.t[i];
    return best;
  }
}

/**
 * Drops every point another point beats or matches on all of cost, a and s. With an unlimited
 * budget cost only breaks ties.
 */
export const prune = <T extends { cost: number, a: number, s: number }>(points: T[], ignoreCost: boolean): T[] => {
  if (ignoreCost) {
    const sorted = [...points].sort((x, y) => y.a - x.a || y.s - x.s || x.cost - y.cost);
    const kept: T[] = [];
    let bestS = -Infinity;
    for (const p of sorted) {
      if (p.s > bestS) {
        kept.push(p);
        bestS = p.s;
      }
    }
    return kept;
  }
  const sorted = [...points].sort((x, y) => x.cost - y.cost || y.a - x.a || y.s - x.s);
  const as = [...new Set(points.map((p) => p.a))].sort((x, y) => y - x);
  const rank = new Map(as.map((a, i) => [a, i]));
  const tree = new MaxTree(as.length);
  const kept: T[] = [];
  for (const p of sorted) {
    const r = rank.get(p.a)!;
    if (tree.query(r) >= p.s) continue;
    tree.update(r, p.s);
    kept.push(p);
  }
  return kept;
};

export class Frontier {
  /** Points by cost, cheapest first. */
  readonly points: Point[];

  /** The same points by accuracy, then strength, both highest first, then cheapest first. */
  private readonly byAccuracy: Point[];

  /** The highest a and s among the cheapest points up to each index of `points`. */
  private readonly maxA: Float64Array;

  private readonly maxS: Float64Array;

  constructor(slotOptions: Map<Slot, Option[]>, cap: number) {
    const ignoreCost = cap === Infinity;
    let points: Point[] = [{ cost: 0, a: 0, s: 0, slot: null, item: null, prev: null }];
    const slots = [...slotOptions.keys()].sort((x, y) => slotOptions.get(x)!.length - slotOptions.get(y)!.length);
    for (const slot of slots) {
      const options = prune(slotOptions.get(slot)!, ignoreCost);
      const next: Point[] = [];
      for (const p of points) {
        for (const o of options) {
          const cost = p.cost + o.cost;
          if (cost > cap) continue;
          next.push({ cost, a: p.a + o.a, s: p.s + o.s, slot, item: o.item, prev: p });
        }
      }
      points = prune(next, ignoreCost);
    }
    this.points = points.sort((x, y) => x.cost - y.cost);
    this.byAccuracy = [...points].sort((x, y) => y.a - x.a || y.s - x.s || x.cost - y.cost);
    this.maxA = new Float64Array(points.length);
    this.maxS = new Float64Array(points.length);
    points.forEach((p, i) => {
      this.maxA[i] = Math.max(p.a, i ? this.maxA[i - 1] : -Infinity);
      this.maxS[i] = Math.max(p.s, i ? this.maxS[i - 1] : -Infinity);
    });
  }

  /** The highest a and the highest s (not necessarily from the same point) within `budget`. */
  bounds(budget: number): { a: number, s: number } {
    let lo = 0;
    let hi = this.points.length - 1;
    if (hi < 0 || this.points[0].cost > budget) return { a: 0, s: 0 };
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.points[mid].cost <= budget) lo = mid;
      else hi = mid - 1;
    }
    return { a: this.maxA[lo], s: this.maxS[lo] };
  }

  /**
   * The points costing at most `budget` that no other such point beats on both a and s,
   * by accuracy highest first (so strength rises along the list).
   */
  staircase(budget: number): Point[] {
    const out: Point[] = [];
    let bestS = -Infinity;
    for (const p of this.byAccuracy) {
      if (p.cost <= budget && p.s > bestS) {
        out.push(p);
        bestS = p.s;
      }
    }
    return out;
  }
}
