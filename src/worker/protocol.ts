// Messages between the page and the worker that runs the engine. Setups travel as item ids so
// the page never loads the engine's data.
import type { Slot } from '../engine/data';
import type { CombatClass } from '../engine/evaluate';
import type { Use } from '../optimiser/supplies';

export type { Slot, CombatClass, Use };

/** The defence bonuses a monster has against each kind of attack. */
export type Defence = 'stab' | 'slash' | 'crush' | 'magic' | 'light' | 'standard' | 'heavy';
export type Element = 'air' | 'water' | 'earth' | 'fire';

export interface Skills {
  atk: number;
  str: number;
  def: number;
  ranged: number;
  magic: number;
  prayer: number;
  hp: number;
  agility: number;
  slayer: number;
  mining: number;
  herblore: number;
}

export interface CharacterInput {
  skills: Skills;
  onTask: boolean;
  untradeables: boolean;
  /** Leave out items whose Requirements the levels don't meet. */
  unlockedOnly: boolean;
  kandarinDiary: boolean;
  chargeSpell: boolean;
  inWilderness: boolean;
}

export interface StyleRef {
  name: string;
  type: string | null;
  stance: string | null;
}

export interface SetupRef {
  /** Item id in each slot. */
  items: Partial<Record<Slot, number>>;
  /** The dart in a blowpipe. */
  dart: number | null;
  style: StyleRef;
  spell: string | null;
  /** Whether the spell is cast with sunfire runes. */
  sunfire: boolean;
}

export interface SetupView extends SetupRef {
  /** What each item costs (0 for an earned Untradeable or for ammo counted in the ammo cost). */
  prices: Partial<Record<Slot, number>>;
  /** When each item's price was last traded, in Unix seconds. */
  priceTimes: Partial<Record<Slot, number>>;
  /** For an Untradeable that costs something, what it's made from or the shop selling it. */
  madeFrom: Partial<Record<Slot, string>>;
  ammoCost: number;
  /** What ammoCost pays for: an hour of each ammo, rune and charge used. */
  uses: Use[];
  /** The slot whose item is paid for in ammoCost. */
  ammoSlot: Slot | null;
  cost: number;
}

export interface Bonuses {
  stab: number;
  slash: number;
  crush: number;
  magic: number;
  ranged: number;
}

export interface Stats {
  dps: number;
  maxHit: number;
  /** Chance each attack hits, from 0 to 1. */
  accuracy: number;
  /** Average seconds to kill. */
  killTime: number;
  /** Ticks between attacks. */
  attackSpeed: number;
  offensive: Bonuses;
  defensive: Bonuses;
  strength: { melee: number, ranged: number, magic: number, prayer: number };
  /** The best prayers the Prayer and Defence levels allow, or none. */
  prayers: string[];
  potion: string;
  /** Diaries and spells assumed that change this DPS, like the Kandarin hard diary. */
  effects: string[];
  /** The monster defence the attack rolls against (a salamander rolls against all three ranged ones). */
  against: Defence | 'mixed' | null;
  /** The spell's element, if it has one. */
  element: Element | null;
  details: { label: string, value: string, highlight: boolean }[];
}

export interface UpgradeView {
  slot: Slot;
  itemId: number;
  gain: number;
  netCost: number;
  setup: SetupRef;
}

export interface Outcome {
  setup: SetupView;
  stats: Stats;
  upgrades: UpgradeView[];
}

export interface SlotOption {
  itemId: number;
  /** Other items with exactly the same stats and DPS here, which share this row. */
  alike: number[];
  dps: number;
  netCost: number;
  price: number;
  priceTime: number | null;
  /** For an Untradeable that costs something, what it's made from or the shop selling it. */
  madeFrom: string | null;
  /** The setup with this item in the slot (a weapon brings its own style, spell or ammo). */
  setup: SetupRef;
}

/**
 * A Custom monster: one fight's stats changed by the player. Only these stats count, so the fight
 * it was copied from brings none of its mechanics or Protection.
 */
export interface CustomMonster {
  /** The key of the monster it was copied from. */
  from: string;
  hp: number;
  def: number;
  magic: number;
  defence: Record<Defence, number>;
  /** Flat armour, taken off every melee and ranged hit. */
  armour: number;
  size: number;
  weakness: { element: Element, severity: number } | null;
  attributes: string[];
}

interface Common {
  monster: string;
  /** Set when the monster is the Custom monster. */
  custom: CustomMonster | null;
  character: CharacterInput;
  classes: CombatClass[];
}

export type Request =
  | Common & { kind: 'best', budget: number }
  | Common & { kind: 'evaluate', budget: number, setup: SetupRef }
  | Common & { kind: 'slot', setup: SetupRef, slot: Slot }
  /** A kept setup worked out again for a Comparison, with no upgrades. */
  | Common & { kind: 'compare', setup: SetupRef };

export interface Results {
  /** Null when no setup can damage the monster within the budget. */
  best: Outcome | null;
  evaluate: Outcome;
  slot: SlotOption[];
  compare: Outcome;
}

export type Reply = { id: number, result: unknown } | { id: number, error: string };
