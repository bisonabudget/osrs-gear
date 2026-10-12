// Finds the Best setup: the highest-DPS Setup against a Monster that fits a Budget.
//
// Every weapon, combat style and spell or ammo is a task. For each task, gear the engine only
// adds up is chosen from a Frontier of slot combinations, searched with the engine itself on
// stand-in gear that has the combination's total bonuses. Items the engine treats specially are
// tried as fixed choices on top. Tasks are worked through best bound first, so most are ruled
// out without being searched.
import { ammoApplicability, AmmoApplicability } from '@/lib/Equipment';
import { BLOWPIPE_IDS } from '@/lib/constants';
import { EquipmentCategory } from '@/enums/EquipmentCategory';
import { getCombatStylesForCategory } from '@/utils';
import { Monster } from '@/types/Monster';
import { EquipmentPiece, PlayerEquipment } from '@/types/Player';
import { PlayerCombatStyle } from '@/types/PlayerCombatStyle';
import { Spell, spells } from '@/types/Spell';
import { emptyEquipment, Item, itemById, items, Slot, SLOTS, Way } from '../engine/data';
import { Character, CombatClass, dpsOf, SetupInput } from '../engine/evaluate';
import type { Price } from '../prices';
import { Protection, protectionFor } from '../protection';
import { meets } from '../requirements';
import { Frontier, itemsOf, Option, Point } from './frontier';
import { ammoSaved, setFitsWeapon, SETS } from './specials';
import { canAutocast, spellLevel } from './spellbook';
import { spellKey, takesSunfire, withSunfire } from './sunfire';
import {
  ammoSlotOf, attackUses, savesAmmo, tomeHelps, upkeepOf, Use, usedUp, usesOf,
} from './supplies';

type StatType = 'stab' | 'slash' | 'crush' | 'ranged' | 'magic';
const STRENGTH = { melee: 'str', ranged: 'ranged_str', magic: 'magic_str' } as const;
const TICKS_PER_HOUR = 6000;
// Each slot tries this many of the special items that help on their own.
const SINGLES_PER_SLOT = 3;
const EPS = 1e-9;
// How far a task's bound is raised in case special items add more with full gear than alone.
const TASK_SLACK = 1.1;
// Upgrades adding less than this share of the current DPS only show when there aren't enough bigger ones.
const MIN_GAIN = 0.01;

// Spells Charge boosts when the matching god cape is worn.
const GOD_SPELLS = new Set(['Saradomin Strike', 'Claws of Guthix', 'Flames of Zamorak']);

const setupKey = ({ equipment, style, spell }: SetupInput) => [
  ...SLOTS.map((s) => equipment[s]?.id ?? ''), equipment.weapon?.itemVars?.blowpipeDartId ?? '', style.name, style.type, spellKey(spell),
].join('|');

// Everything the engine adds up for an item. Two items with the same key differ only in name and
// price, like the god d'hide boots. An item the engine does more with is kept on its own.
const statsKey = ({ piece, special }: Item): string => (special
  ? `#${piece.id}`
  : JSON.stringify([piece.offensive, piece.defensive, piece.bonuses, piece.speed, piece.category, piece.isTwoHanded]));

// Items with a version most players wear instead, besides the fortified (f) armour.
const PREFERRED: Record<string, string> = {
  'Void knight top': 'Elite void top',
  'Void knight robe': 'Elite void robe',
};

// What an item adds to an attack, leaving out defence and prayer.
const attackKey = ({ piece }: Item): string => JSON.stringify([
  piece.offensive, piece.bonuses.str, piece.bonuses.ranged_str, piece.bonuses.magic_str, piece.speed, piece.category, piece.isTwoHanded,
]);

export interface Setup {
  equipment: PlayerEquipment;
  style: PlayerCombatStyle;
  spell: Spell | null;
  /** What each item cost, by slot. An earned Untradeable costs 0. */
  prices: Partial<Record<Slot, number>>;
  /** One hour of the ammo, runes and charges used. */
  ammoCost: number;
  /** What is used up in that hour. */
  uses: Use[];
  /** The slot whose item is paid for in ammoCost, if it is worn (a blowpipe's darts aren't). */
  ammoSlot: Slot | null;
  cost: number;
  dps: number;
}

/** One item swapped into a Setup, and the Setup it makes. */
export interface Swap {
  slot: Slot;
  item: Item;
  setup: Setup;
  /** DPS gained, which is negative for a worse item. */
  gain: number;
  /** What the swap costs, after selling the item it replaces. */
  netCost: number;
}

interface Task {
  id: number;
  cls: CombatClass;
  type: StatType;
  weapon: EquipmentPiece;
  weaponCost: number;
  style: PlayerCombatStyle;
  spell: Spell | null;
  ammo: Item | null;
  /** Whether an Ava's device or quiver saves some of what it uses up. */
  saveable: boolean;
  speed: number;
  /** Slots the Frontier fills, before special items take any. */
  slots: Slot[];
}

/** Special items fixed in place for one search of a task. */
interface Fixed {
  items: Map<Slot, Item>;
  cost: number;
}

interface Candidate {
  task: Task;
  fixed: Fixed;
  point: Point;
  value: number;
  cost: number;
}

const statTypeOf = (style: PlayerCombatStyle): StatType => style.type as StatType;

const classOfType = (type: StatType): CombatClass => (type === 'ranged' ? 'ranged' : type === 'magic' ? 'magic' : 'melee');

// An item with the given bonuses and no name the engine knows, standing in for a combination.
const standIn = (slot: Slot, type: StatType, a: number, s: number): EquipmentPiece => ({
  name: 'Combined gear',
  id: -1,
  weight: 0,
  version: '',
  slot,
  image: '',
  speed: 0,
  category: EquipmentCategory.NONE,
  isTwoHanded: false,
  bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0, [STRENGTH[classOfType(type)]]: s },
  offensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0, [type]: a },
  defensive: { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 },
});

// The same item under a name the engine doesn't know, to see what its name adds. (Some checks
// look for part of a name, so the new name shares nothing with the old.)
const anonymous = (piece: EquipmentPiece): EquipmentPiece => ({ ...piece, name: 'Plain item' });

export class Optimiser {
  private readonly bySlot = new Map<Slot, { item: Item, cost: number }[]>();

  // Frontiers for the budget last searched; each budget needs its own.
  private readonly frontiers = new Map<string, Frontier>();

  private frontierBudget = NaN;

  // The swaps worked out for the last setup asked about, so its slot lists reuse the upgrade search.
  private swapCache = { key: '', bySlot: new Map<Slot, Swap[]>() };

  private readonly singles = new Map<string, Map<Slot, { item: Item, ratio: number }[]>>();

  private readonly sets = new Map<string, { fixed: Fixed, ratio: number }[]>();

  private readonly spellRanks = new Map<string, Spell[]>();

  private readonly evals = new Map<string, number>();

  private readonly specialByName = new Map<string, Item>();

  // Items and the versions most players wear instead when they attack at least as well: fortified
  // (f) armour like Masori, and elite void. The preferred one is shown when the budget covers it.
  private readonly preferred = new Map<number, Item>();

  private readonly preferredIds = new Set<number>();

  private capes: { item: Item, cost: number }[] | null = null;

  private readonly needsName = new Map<string, boolean>();

  private readonly tasks = new Map<CombatClass, Task[]>();

  private tasksMade = 0;

  // An hour of what each task uses up, by task and the cape and shield worn.
  private readonly runCosts = new Map<string, number>();

  /** What the monster demands in one slot, which every setup wears. */
  readonly protection: Protection | null;

  // The protective items for a slot and what each adds on the weapon alone, by task.
  private readonly protective = new Map<string, { item: Item, ratio: number }[]>();

  constructor(
    readonly monster: Monster,
    readonly character: Character,
    private readonly prices: Map<number, Price>,
  ) {
    for (const slot of SLOTS) this.bySlot.set(slot, []);
    for (const item of items) {
      if (character.unlockedOnly && !meets(item.needs, character.skills)) continue;
      const cost = this.searchCost(item);
      if (cost === undefined) continue;
      this.bySlot.get(item.piece.slot)!.push({ item, cost });
      this.specialByName.set(item.piece.name, item);
    }
    for (const [name, item] of this.specialByName) {
      const plain = name.endsWith(' (f)') ? this.specialByName.get(name.slice(0, -4)) : undefined;
      if (plain && attackKey(plain) === attackKey(item)) this.preferred.set(plain.piece.id, item);
    }
    for (const [name, better] of Object.entries(PREFERRED)) {
      const plain = this.specialByName.get(name);
      const item = this.specialByName.get(better);
      if (plain && item) this.preferred.set(plain.piece.id, item);
    }
    for (const item of this.preferred.values()) this.preferredIds.add(item.piece.id);
    // Only the items that protect can go in a protected slot, and a slot held for an item the
    // engine doesn't know stays empty.
    this.protection = protectionFor(monster.name);
    if (this.protection) {
      const { slot, items: names } = this.protection;
      this.bySlot.set(slot, this.bySlot.get(slot)!.filter(({ item }) => names.includes(item.piece.name)));
    }
  }

  /** The Price of an item, or for an Untradeable its cheapest way; undefined if it can't be used. */
  costOf(item: Item): number | undefined {
    if (item.priceId !== null) return this.prices.get(item.priceId)?.gp;
    return this.wayOf(item)?.gp;
  }

  /**
   * The cheapest way to get an Untradeable at today's prices. With untradeables off, only ways
   * that need nothing earned in game count.
   */
  wayOf(item: Item): { way: Way, gp: number } | undefined {
    let best: { way: Way, gp: number } | undefined;
    for (const way of item.ways) {
      if (way.earned && !this.character.untradeables) continue;
      let gp = way.coins;
      for (const [id, qty] of way.parts) gp += (this.prices.get(id)?.gp ?? NaN) * qty;
      if (!Number.isNaN(gp) && (!best || gp < best.gp)) best = { way, gp };
    }
    return best;
  }

  /** The price of one of something used up, by its id. */
  private readonly gpOf = (id: number): number => {
    const item = itemById.get(id);
    return item ? this.costOf(item) ?? 0 : this.prices.get(id)?.gp ?? 0;
  };

  /**
   * What the search pays for an item: its cost, plus an hour of the charges it uses while worn
   * (the serpentine helm's scales).
   */
  private searchCost(item: Item): number | undefined {
    const cost = this.costOf(item);
    return cost === undefined ? undefined : cost + upkeepOf(item.piece, this.gpOf).reduce((sum, u) => sum + u.gp, 0);
  }

  /** When the price of an item, or of the oldest-priced thing it's made from, was last traded. */
  tradedAt(item: Item): number | null {
    const ids = item.priceId !== null ? [item.priceId] : this.wayOf(item)?.way.parts.map(([id]) => id) ?? [];
    const times = ids.map((id) => this.prices.get(id)?.time).filter((t): t is number => t !== undefined);
    return times.length ? Math.min(...times) : null;
  }

  get slotItems(): ReadonlyMap<Slot, { item: Item, cost: number }[]> {
    return this.bySlot;
  }

  dps(setup: SetupInput): number {
    return dpsOf(setup, this.monster, this.character);
  }

  // ------------------------------------------------------------------ tasks

  private stylesFor(weapon: EquipmentPiece, cls: CombatClass): PlayerCombatStyle[] {
    const usable = getCombatStylesForCategory(weapon.category)
      .filter((style) => style.stance !== 'Defensive Autocast' && style.stance !== 'Manual Cast' && style.stance !== 'Longrange');
    const seen = new Set<string>();
    return usable.filter((style) => {
      const type = style.type as StatType | null;
      if (!type || classOfType(type) !== cls) return false;
      // A defensive style adds nothing to an attack, so it is only kept when it is the weapon's one
      // style of its type, like a salamander's Blaze.
      if (style.stance === 'Defensive' && usable.some((s) => s.type === style.type && s.stance !== 'Defensive')) return false;
      const key = `${style.type}|${style.stance}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * The spells worth trying with a weapon: ones the Magic level allows and the weapon can
   * autocast, leaving out any that another beats on both DPS and rune cost with the weapon alone.
   * With Charge cast, god spells only gain with their god cape, so they're always kept. Fire
   * spells are tried with and without sunfire runes.
   */
  private spellsFor(weapon: EquipmentPiece, style: PlayerCombatStyle): Spell[] {
    const key = `${weapon.name}|${style.stance}`;
    let ranked = this.spellRanks.get(key);
    if (!ranked) {
      const scored = spells
        .filter((spell) => spellLevel(spell.name) <= this.character.skills.magic && canAutocast(weapon.name, spell))
        .flatMap((spell) => (takesSunfire(spell) ? [spell, withSunfire(spell)] : [spell]))
        .map((spell) => {
          const input = { equipment: { ...emptyEquipment(), weapon }, style, spell };
          const uses = attackUses(input, TICKS_PER_HOUR / this.playerSpeed(input), this.gpOf);
          return { spell, dps: this.dps(input), cost: uses.reduce((sum, u) => sum + u.gp, 0) };
        })
        .filter((s) => s.dps > 0)
        .sort((x, y) => y.dps - x.dps || x.cost - y.cost);
      ranked = [];
      let cheapest = Infinity;
      for (const s of scored) {
        if (this.character.chargeSpell && GOD_SPELLS.has(s.spell.name)) {
          ranked.push(s.spell);
          continue;
        }
        if (s.cost >= cheapest) continue;
        ranked.push(s.spell);
        cheapest = s.cost;
      }
      this.spellRanks.set(key, ranked);
    }
    return ranked;
  }

  private ammoFor(weapon: EquipmentPiece): Item[] {
    const usable = this.bySlot.get('ammo')!
      .filter(({ item }) => ammoApplicability(weapon.id, item.piece.id) === AmmoApplicability.INCLUDED);
    // Of plain ammo, only what no cheaper ammo matches on both bonuses.
    const plain = usable.filter(({ item }) => !item.special)
      .sort((x, y) => x.cost - y.cost);
    const kept: Item[] = usable.filter(({ item }) => item.special).map(({ item }) => item);
    let bestA = -Infinity;
    let bestS = -Infinity;
    for (const { item } of plain) {
      const { ranged } = item.piece.offensive;
      const s = item.piece.bonuses.ranged_str;
      if (ranged > bestA || s > bestS) kept.push(item);
      if (ranged > bestA) bestA = ranged;
      if (s > bestS) bestS = s;
    }
    return kept;
  }

  private dartsFor(): { item: Item, cost: number }[] {
    return this.bySlot.get('weapon')!.filter(({ item }) => / dart$/.test(item.piece.name));
  }

  private tasksFor(cls: CombatClass): Task[] {
    let tasks = this.tasks.get(cls);
    if (!tasks) {
      tasks = this.makeTasks(cls);
      this.tasks.set(cls, tasks);
    }
    return tasks;
  }

  private makeTasks(cls: CombatClass): Task[] {
    const tasks: Task[] = [];
    const guarded = this.protection?.slot;
    // Nothing can be fought without the protection the levels don't allow.
    if (this.protection?.items.length && !this.bySlot.get(this.protection.slot)!.length) return tasks;
    for (const { item: weaponItem, cost } of this.bySlot.get('weapon')!) {
      const base = weaponItem.piece;
      if (guarded === 'shield' && base.isTwoHanded) continue;
      // Bows, crossbows and salamanders can't attack without their own ammo, in any style.
      const needsAmmo = ammoApplicability(base.id, undefined) === AmmoApplicability.INVALID;
      for (const style of this.stylesFor(base, cls)) {
        const type = statTypeOf(style);
        const slots = SLOTS.filter((s) => s !== 'weapon' && s !== guarded
          && !(s === 'shield' && base.isTwoHanded)
          && !(s === 'ammo' && (cls === 'ranged' || needsAmmo)));
        const make = (weapon: EquipmentPiece, spell: Spell | null, ammo: Item | null, weaponCost: number): Task => {
          const input = { equipment: { ...emptyEquipment(), weapon, ammo: ammo?.piece ?? null }, style, spell };
          return {
            id: this.tasksMade++, cls, type, weapon, weaponCost, style, spell, ammo, saveable: savesAmmo(input), speed: this.playerSpeed(input), slots,
          };
        };
        if (cls === 'magic' && (style.stance === 'Autocast')) {
          for (const spell of this.spellsFor(base, style)) tasks.push(make(base, spell, null, cost));
        } else if (cls === 'ranged' && BLOWPIPE_IDS.includes(base.id)) {
          for (const dart of this.dartsFor()) {
            const weapon = { ...base, itemVars: { blowpipeDartName: dart.item.piece.name, blowpipeDartId: dart.item.piece.id } };
            tasks.push(make(weapon, null, null, cost));
          }
        } else if (needsAmmo) {
          for (const ammo of this.ammoFor(base)) tasks.push(make(base, null, ammo, cost));
        } else {
          // Thrown weapons and chinchompas are paid for by the hour, as they are used up.
          tasks.push(make(base, null, null, usedUp(base) ? 0 : cost));
        }
      }
    }
    return tasks;
  }

  private playerSpeed(setup: SetupInput): number {
    // Attack speed only depends on the weapon, stance and spell.
    const weapon = setup.equipment.weapon!;
    let speed = weapon.speed || 4;
    if (setup.style.type === 'ranged' && setup.style.stance === 'Rapid') speed -= 1;
    if (setup.style.stance === 'Autocast') speed = weapon.name === 'Twinflame staff' ? 6 : 5;
    if (setup.style.stance === 'Autocast' && weapon.name === 'Harmonised Nightmare staff' && setup.spell?.spellbook === 'standard') speed = 4;
    return Math.max(speed, 1);
  }

  /**
   * An hour of the ammo, runes and charges a task uses. Only an Ava's device or quiver in the cape
   * slot and a tome in the shield slot change it.
   */
  private runCost(task: Task, cape: Item | undefined, shield: Item | undefined): number {
    const c = task.saveable ? cape : undefined;
    const s = task.spell ? shield : undefined;
    const key = `${task.id}|${c?.piece.id ?? ''}|${s?.piece.id ?? ''}`;
    let gp = this.runCosts.get(key);
    if (gp === undefined) {
      const extra: [Slot, EquipmentPiece][] = [];
      if (c) extra.push(['cape', c.piece]);
      if (s) extra.push(['shield', s.piece]);
      const input = { equipment: this.equipmentWith(task, extra), style: task.style, spell: task.spell };
      gp = attackUses(input, TICKS_PER_HOUR / task.speed, this.gpOf).reduce((sum, u) => sum + u.gp, 0);
      this.runCosts.set(key, gp);
    }
    return gp;
  }

  // ------------------------------------------------------------------ frontier

  private frontier(type: StatType, slots: Slot[], cap: number): Frontier {
    const key = `${type}|${slots.join(',')}`;
    let f = this.frontiers.get(key);
    if (!f) {
      const strength = STRENGTH[classOfType(type)];
      const options = new Map<Slot, Option[]>();
      for (const slot of slots) {
        const list: Option[] = [{ item: null, cost: 0, a: 0, s: 0 }];
        for (const { item, cost } of this.bySlot.get(slot)!) {
          if (cost > cap) continue;
          list.push({ item, cost, a: item.piece.offensive[type], s: item.piece.bonuses[strength] });
        }
        options.set(slot, list);
      }
      f = new Frontier(options, cap);
      this.frontiers.set(key, f);
    }
    return f;
  }

  // ------------------------------------------------------------------ special items

  // Tasks with the same key get the same help from special items. The weapon's category only
  // matters to them for ranged (crossbow bolts and the heavy, standard and light ammo types).
  private relevanceKey(task: Task) {
    return [task.cls, task.type, task.cls === 'ranged' ? task.weapon.category : '', task.weapon.isTwoHanded, spellKey(task.spell), task.ammo ? 1 : 0].join('|');
  }

  private equipmentWith(task: Task, extra: Iterable<[Slot, EquipmentPiece]>, weapon = task.weapon): PlayerEquipment {
    const equipment = { ...emptyEquipment(), weapon, ammo: task.ammo?.piece ?? null };
    for (const [slot, piece] of extra) equipment[slot] = piece;
    return equipment;
  }

  private ratio(task: Task, pieces: Item[], weapon: EquipmentPiece): number {
    const setup = (named: boolean) => ({
      equipment: this.equipmentWith(task, pieces.map((p) => [p.piece.slot, named ? p.piece : anonymous(p.piece)] as [Slot, EquipmentPiece]), weapon),
      style: task.style,
      spell: task.spell,
    });
    const plain = this.dps(setup(false));
    const real = this.dps(setup(true));
    if (plain <= 0) return real > 0 ? Infinity : 1;
    return real / plain;
  }

  /** Special items that raise DPS on their own, whatever the weapon, by slot. */
  private singlesFor(task: Task): Map<Slot, { item: Item, ratio: number }[]> {
    // A weapon that does nothing without its name (a powered staff's spell comes from its name)
    // is tested as itself, so what is found only holds for that weapon.
    const plain = anonymous(task.weapon);
    const namedKey = `${task.weapon.name}|${task.style.type}|${task.style.stance}|${spellKey(task.spell)}|${task.ammo?.piece.id ?? ''}`;
    let named = this.needsName.get(namedKey);
    if (named === undefined) {
      named = this.dps({ equipment: this.equipmentWith(task, [], plain), style: task.style, spell: task.spell }) <= 0;
      this.needsName.set(namedKey, named);
    }
    const probe = named ? task.weapon : plain;
    const key = `${this.relevanceKey(task)}|${named ? task.weapon.name : ''}`;
    let found = this.singles.get(key);
    if (!found) {
      found = new Map();
      for (const slot of task.slots) {
        const helpful = this.bySlot.get(slot)!
          .filter(({ item }) => item.special)
          .map(({ item }) => ({ item, ratio: this.ratio(task, [item], probe) }))
          .filter((s) => s.ratio > 1 + EPS)
          .sort((x, y) => y.ratio - x.ratio)
          .slice(0, SINGLES_PER_SLOT);
        if (helpful.length) found.set(slot, helpful);
      }
      this.singles.set(key, found);
    }
    return found;
  }

  /** Item sets that raise DPS with this weapon. */
  private setsFor(task: Task): { fixed: Fixed, ratio: number }[] {
    // A weapon the engine doesn't know by name gets the same from a set as any other.
    const key = `${this.relevanceKey(task)}|${this.specialByName.get(task.weapon.name)?.special ? task.weapon.name : ''}`;
    let found = this.sets.get(key);
    if (!found) {
      found = [];
      for (const set of SETS) {
        if (!setFitsWeapon(set, task.weapon.name)) continue;
        const pieces = set.pieces.map((name) => this.specialByName.get(name));
        if (pieces.some((p) => !p || !task.slots.includes(p.piece.slot))) continue;
        const ratio = this.ratio(task, pieces as Item[], task.weapon);
        if (ratio > 1 + EPS) {
          const fixed: Fixed = { items: new Map(), cost: 0 };
          for (const p of pieces as Item[]) {
            fixed.items.set(p.piece.slot, p);
            fixed.cost += this.searchCost(p)!;
          }
          found.push({ fixed, ratio });
        }
      }
      this.sets.set(key, found);
    }
    return found;
  }

  /**
   * Ava's devices and quivers worth trying, for ranged attacks whose ammo can be saved: any other
   * saves as much, has the same bonuses or better and costs no more.
   */
  private savingCapes(): { item: Item, cost: number }[] {
    if (!this.capes) {
      const capes = this.bySlot.get('cape')!.filter(({ item }) => ammoSaved(item.piece.name) > 0);
      const beats = (d: { item: Item, cost: number }, c: { item: Item, cost: number }) => (
        ammoSaved(d.item.piece.name) >= ammoSaved(c.item.piece.name)
        && d.item.piece.offensive.ranged >= c.item.piece.offensive.ranged
        && d.item.piece.bonuses.ranged_str >= c.item.piece.bonuses.ranged_str
        && d.cost <= c.cost
      );
      this.capes = capes.filter((c, i) => c.item.special
        || !capes.some((d, j) => j !== i && beats(d, c) && (!beats(c, d) || j < i)));
    }
    return this.capes;
  }

  /** Tomes that would give runes a task's spell uses, to try in the shield slot. */
  private tomesFor(task: Task): { item: Item, cost: number }[] {
    const { spell } = task;
    if (!spell || !task.slots.includes('shield')) return [];
    return this.bySlot.get('shield')!.filter(({ item }) => tomeHelps(item.piece, task.weapon, spell));
  }

  /** The items that could fill the protected slot, with what each adds to the weapon alone. */
  private protectiveFor(task: Task): { item: Item, ratio: number }[] {
    if (!this.protection?.items.length) return [];
    const { slot } = this.protection;
    const key = `${this.relevanceKey(task)}|${task.weapon.name}`;
    let found = this.protective.get(key);
    if (!found) {
      const without = this.dps({ equipment: this.equipmentWith(task, []), style: task.style, spell: task.spell });
      found = this.bySlot.get(slot)!.map(({ item }) => {
        const worn = this.dps({ equipment: this.equipmentWith(task, [[slot, item.piece]]), style: task.style, spell: task.spell });
        return { item, ratio: without > 0 ? Math.max(1, worn / without) : 1 };
      });
      this.protective.set(key, found);
    }
    return found;
  }

  /**
   * Every way of fixing special items in place for a task, with what the items add on the weapon
   * alone. Each way includes one of the items the monster's protection allows.
   */
  private fixedChoices(task: Task): { fixed: Fixed, ratio: number }[] {
    const singles = this.singlesFor(task);
    let choices: { fixed: Fixed, ratio: number }[] = [{ fixed: { items: new Map(), cost: 0 }, ratio: 1 }, ...this.setsFor(task)];
    const protective = this.protectiveFor(task);
    if (protective.length) {
      const { slot } = this.protection!;
      choices = choices.flatMap((choice) => protective.map(({ item, ratio }) => ({
        fixed: { items: new Map(choice.fixed.items).set(slot, item), cost: choice.fixed.cost + this.searchCost(item)! },
        ratio: choice.ratio * ratio,
      })));
    }
    // Items that change what an hour of attacking costs are tried too: an Ava's device or quiver
    // in the cape slot to save ammo, and a tome in the shield slot to give runes.
    const savers = new Map<Slot, { item: Item, cost: number }[]>();
    if (task.saveable) savers.set('cape', this.savingCapes());
    const tomes = this.tomesFor(task);
    if (tomes.length) savers.set('shield', tomes);
    for (const slot of new Set([...singles.keys(), ...savers.keys()])) {
      const options = [...(singles.get(slot) ?? [])];
      for (const { item } of savers.get(slot) ?? []) if (!options.some((o) => o.item === item)) options.push({ item, ratio: 1 });
      const next: { fixed: Fixed, ratio: number }[] = [];
      for (const choice of choices) {
        next.push(choice);
        if (choice.fixed.items.has(slot)) continue;
        for (const { item, ratio } of options) {
          next.push({
            fixed: { items: new Map(choice.fixed.items).set(slot, item), cost: choice.fixed.cost + this.searchCost(item)! },
            ratio: choice.ratio * ratio,
          });
        }
      }
      choices = next;
    }
    return choices;
  }

  /**
   * A bound on a task's DPS: the best its plain gear could do, raised by every special item and
   * set that helps it at once. What a special item adds is measured on the weapon alone, where it
   * is usually larger than with full gear, so the bound has some slack added.
   */
  private taskBound(task: Task, budget: number): { plain: number, bound: number } {
    // The least an hour of attacking could cost, with any Ava's device and tome the budget covers.
    const affordable = (list: { item: Item, cost: number }[]) => [undefined, ...list.filter((x) => x.cost <= budget).map((x) => x.item)];
    let run = Infinity;
    for (const cape of affordable(task.saveable ? this.savingCapes() : [])) {
      for (const tome of affordable(this.tomesFor(task))) run = Math.min(run, this.runCost(task, cape, tome));
    }
    // The protection costs at least its cheapest item, and adds at most what its best one adds.
    const protective = this.protectiveFor(task);
    const guard = protective.length ? Math.min(...protective.map(({ item }) => this.searchCost(item)!)) : 0;
    const room = budget - task.weaponCost - run - guard;
    if (room < 0) return { plain: 0, bound: 0 };
    const { a, s } = this.frontier(task.type, task.slots, budget).bounds(room);
    const plain = this.value(task, { items: new Map(), cost: 0 }, task.slots, a, s) * TASK_SLACK;
    let boost = Math.max(1, ...this.setsFor(task).map((x) => x.ratio));
    for (const found of this.singlesFor(task).values()) boost *= found[0].ratio;
    if (protective.length) boost *= Math.max(...protective.map((x) => x.ratio));
    return { plain, bound: plain * boost };
  }

  // ------------------------------------------------------------------ search

  private value(task: Task, fixed: Fixed, slots: Slot[], a: number, s: number): number {
    const key = `${task.weapon.name}|${task.weapon.itemVars?.blowpipeDartId ?? ''}|${task.style.type}|${task.style.stance}|${spellKey(task.spell)}|${task.ammo?.piece.id ?? ''}|${[...fixed.items.values()].map((i) => i.piece.id).join(',')}|${a}|${s}`;
    let v = this.evals.get(key);
    if (v === undefined) {
      const extra: [Slot, EquipmentPiece][] = [...fixed.items].map(([slot, item]) => [slot, item.piece]);
      const free = slots.find((slot) => slot !== 'ammo') ?? slots[0];
      if (free) extra.push([free, standIn(free, task.type, a, s)]);
      v = this.dps({ equipment: this.equipmentWith(task, extra), style: task.style, spell: task.spell });
      this.evals.set(key, v);
    }
    return v;
  }

  optimise(budget: number, classes: CombatClass[]): Setup | null {
    if (budget !== this.frontierBudget) {
      this.frontiers.clear();
      this.frontierBudget = budget;
    }
    const best = { value: 0, cost: Infinity };
    const found: Candidate[] = [];

    const search = (task: Task, fixed: Fixed, slots: Slot[], room: number) => {
      const stairs = this.frontier(task.type, slots, budget).staircase(room);
      if (!stairs.length) return;
      const cost = (p: Point) => {
        const worn = itemsOf(p);
        const run = this.runCost(task, fixed.items.get('cape') ?? worn.get('cape'), fixed.items.get('shield') ?? worn.get('shield'));
        return task.weaponCost + fixed.cost + run + p.cost;
      };
      const visit = (i: number, j: number, bound: number) => {
        if (bound < best.value - EPS) return;
        if (i === j) {
          const p = stairs[i];
          const c = cost(p);
          if (c > budget) return;
          if (bound > best.value + EPS || (bound > best.value - EPS && c < best.cost)) {
            best.value = bound;
            best.cost = c;
            found.push({ task, fixed, point: p, value: bound, cost: c });
          }
          return;
        }
        const m = (i + j) >> 1;
        const left = this.value(task, fixed, slots, stairs[i].a, stairs[m].s);
        const right = this.value(task, fixed, slots, stairs[m + 1].a, stairs[j].s);
        if (left >= right) {
          visit(i, m, left);
          visit(m + 1, j, right);
        } else {
          visit(m + 1, j, right);
          visit(i, m, left);
        }
      };
      visit(0, stairs.length - 1, this.value(task, fixed, slots, stairs[0].a, stairs[stairs.length - 1].s));
    };

    const tasks = classes.flatMap((cls) => this.tasksFor(cls))
      .filter((task) => task.weaponCost <= budget)
      .map((task) => ({ task, ...this.taskBound(task, budget) }))
      .filter((t) => t.bound > 0)
      .sort((x, y) => y.bound - x.bound);

    for (const { task, plain, bound } of tasks) {
      if (bound < best.value - EPS) break;
      // Each job (the task with some special items fixed) is first bounded the same way as the
      // task, then by the DPS it would have if one combination had both the highest accuracy and
      // the highest strength it can afford.
      const jobs = this.fixedChoices(task)
        .map(({ fixed, ratio }) => ({ fixed, bound: plain * ratio }))
        .sort((x, y) => y.bound - x.bound);
      for (const { fixed, bound: rough } of jobs) {
        if (rough < best.value - EPS) break;
        const room = budget - task.weaponCost - fixed.cost - this.runCost(task, fixed.items.get('cape'), fixed.items.get('shield'));
        if (room < 0) continue;
        const slots = task.slots.filter((s) => !fixed.items.has(s));
        const { a, s } = this.frontier(task.type, slots, budget).bounds(room);
        if (this.value(task, fixed, slots, a, s) < best.value - EPS) continue;
        search(task, fixed, slots, room);
      }
    }

    // The stand-in gear treats every item as plain, so check the best few with the real items.
    let chosen: Setup | null = null;
    for (const c of found.slice(-8)) {
      const setup = this.assemble(c);
      if (setup.cost > budget) continue;
      if (!chosen || setup.dps > chosen.dps + EPS || (setup.dps > chosen.dps - EPS && setup.cost < chosen.cost)) chosen = setup;
    }
    return chosen && this.withPreferred(chosen, budget);
  }

  /** The setup with each item swapped for the version most players wear, while the budget covers it. */
  private withPreferred(setup: Setup, budget: number): Setup {
    let out = setup;
    for (const slot of SLOTS) {
      const id = out.equipment[slot]?.id;
      const twin = id === undefined ? undefined : this.preferred.get(id);
      if (!twin) continue;
      const next = this.priced({ equipment: { ...out.equipment, [slot]: twin.piece }, style: out.style, spell: out.spell });
      if (next.cost <= budget && next.dps > out.dps - EPS) out = next;
    }
    return out;
  }

  private assemble(c: Candidate): Setup {
    const equipment = this.equipmentWith(c.task, []);
    for (const [slot, item] of [...c.fixed.items, ...itemsOf(c.point)]) equipment[slot] = item.piece;
    return this.priced({ equipment, style: c.task.style, spell: c.task.spell });
  }

  // ------------------------------------------------------------------ any setup

  /** A setup with what each item costs, an hour of what it uses up, the total and its DPS. */
  priced(input: SetupInput): Setup {
    const prices: Partial<Record<Slot, number>> = {};
    for (const slot of SLOTS) {
      const piece = input.equipment[slot];
      const item = piece ? itemById.get(piece.id) : undefined;
      if (piece) prices[slot] = item ? this.costOf(item) ?? 0 : 0;
    }
    // A thrown weapon or the ammo fired is paid for by the hour instead.
    const ammoSlot = ammoSlotOf(input);
    if (ammoSlot) prices[ammoSlot] = 0;
    const uses = usesOf(input, TICKS_PER_HOUR / this.playerSpeed(input), this.gpOf);
    const ammoCost = uses.reduce((sum, u) => sum + u.gp, 0);
    const itemCost = Object.values(prices).reduce((a, b) => a + (b ?? 0), 0);
    return { ...input, prices, ammoCost, uses, ammoSlot, cost: itemCost + ammoCost, dps: this.dps(input) };
  }

  /**
   * Every item that could go in one slot of a setup, best DPS first. A weapon comes with its best
   * style and spell or ammo, and a two-handed one takes the shield off.
   */
  swaps(current: Setup, slot: Slot, classes: CombatClass[]): Swap[] {
    const key = `${setupKey(current)}|${classes.join(',')}`;
    if (this.swapCache.key !== key) this.swapCache = { key, bySlot: new Map() };
    let found = this.swapCache.bySlot.get(slot);
    if (!found) {
      found = this.findSwaps(current, slot, classes);
      this.swapCache.bySlot.set(slot, found);
    }
    return found;
  }

  private findSwaps(current: Setup, slot: Slot, classes: CombatClass[]): Swap[] {
    const swap = (item: Item, input: SetupInput): Swap => {
      const setup = this.priced(input);
      return { slot, item, setup, gain: setup.dps - current.dps, netCost: setup.cost - current.cost };
    };
    const out: Swap[] = [];
    if (slot === 'weapon') {
      const best = new Map<string, Swap>();
      for (const task of classes.flatMap((cls) => this.tasksFor(cls))) {
        const equipment = { ...current.equipment, weapon: task.weapon };
        if (task.weapon.isTwoHanded) equipment.shield = null;
        if (task.ammo) equipment.ammo = task.ammo.piece;
        else if (ammoSlotOf(current) === 'ammo') equipment.ammo = null;
        const item = itemById.get(task.weapon.id)!;
        const s = swap(item, { equipment, style: task.style, spell: task.spell });
        const kept = best.get(task.weapon.name);
        if (!kept || s.setup.dps > kept.setup.dps + EPS || (s.setup.dps > kept.setup.dps - EPS && s.setup.cost < kept.setup.cost)) best.set(task.weapon.name, s);
      }
      out.push(...best.values());
    } else {
      if (slot === 'shield' && current.equipment.weapon?.isTwoHanded) return [];
      for (const { item } of this.bySlot.get(slot)!) {
        out.push(swap(item, { equipment: { ...current.equipment, [slot]: item.piece }, style: current.style, spell: current.spell }));
      }
    }
    const preferred = (s: Swap) => Number(this.preferredIds.has(s.item.piece.id));
    return out.sort((x, y) => y.setup.dps - x.setup.dps || x.netCost - y.netCost || preferred(y) - preferred(x));
  }

  /**
   * The swaps for one slot, best DPS first, with items of the same stats and DPS in one row. The
   * row shows the item worn, or else the cheapest.
   */
  slotOptions(current: Setup, slot: Slot, classes: CombatClass[]): { swap: Swap, alike: Item[] }[] {
    const worn = current.equipment[slot]?.id;
    const groups = new Map<string, Swap[]>();
    for (const s of this.swaps(current, slot, classes)) {
      const key = `${statsKey(s.item)}|${Math.round(s.setup.dps * 1e6)}`;
      const group = groups.get(key);
      if (group) group.push(s);
      else groups.set(key, [s]);
    }
    return [...groups.values()].map((group) => {
      const swap = group.find((s) => s.item.piece.id === worn) ?? group[0];
      return { swap, alike: group.filter((s) => s !== swap).map((s) => s.item) };
    });
  }

  /**
   * The single swaps most worth buying next, at any price: most DPS gained for each GP first.
   * A swap that another in the same slot beats on both DPS and cost is left out, which also drops
   * items that only repeat another's stats (the god d'hide boots). Gains under MIN_GAIN of the
   * current DPS come after the rest.
   */
  upgrades(current: Setup, classes: CombatClass[], count = 3): Swap[] {
    const seen = new Set<string>();
    const all = SLOTS.flatMap((slot) => this.swaps(current, slot, classes)).filter((s) => {
      // A weapon swap that only changes the ammo makes the same setup as the ammo swap.
      const key = setupKey(s.setup);
      if (s.gain <= EPS || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const kept = all.filter((s, i) => !all.some((o, j) => j !== i && o.slot === s.slot
      && o.gain >= s.gain - EPS && o.netCost <= s.netCost
      && (o.gain > s.gain + EPS || o.netCost < s.netCost || j < i)));

    // Nothing to pay (only possible for a setup changed by hand) counts as the best value.
    const value = (s: Swap) => (s.netCost <= 0 ? Infinity : s.gain / s.netCost);
    const big = (s: Swap) => s.gain >= MIN_GAIN * current.dps;
    kept.sort((x, y) => Number(big(y)) - Number(big(x)) || value(y) - value(x) || y.gain - x.gain);

    const out: Swap[] = [];
    for (const s of kept) {
      if (out.length === count) break;
      if (!out.some((o) => o.item.piece.name === s.item.piece.name)) out.push(s);
    }
    return out;
  }
}
