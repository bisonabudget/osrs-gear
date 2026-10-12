// Checks that the best setup really is the best, by trying to beat it in ways the search doesn't
// work: one item swapped at a time, and random setups climbed one swap at a time.
import { describe, expect, test } from 'vitest';
import { monsters, Slot, SLOTS } from '../src/engine/data';
import type { CombatClass } from '../src/engine/evaluate';
import { Optimiser, Setup } from '../src/optimiser/optimise';
import { pickPrices } from '../src/prices';
import fixture from './fixtures/prices.json';

const prices = pickPrices(fixture.latest as never, fixture.hour as never, fixture.hourTime, fixture.now);
const MAXED = { atk: 99, def: 99, hp: 99, magic: 99, prayer: 99, ranged: 99, str: 99, agility: 99, slayer: 99, mining: 99, herblore: 99 };
const MID = { atk: 70, def: 70, hp: 70, magic: 70, prayer: 52, ranged: 70, str: 70, agility: 50, slayer: 60, mining: 50, herblore: 50 };
const ALL: CombatClass[] = ['melee', 'ranged', 'magic'];
const EPS = 1e-9;
// The full run (npm run test:bis) tries far more random setups and climbs more of them.
const FULL = process.env.BIS_FULL === '1';
const RANDOM_SETUPS = FULL ? 1500 : 250;
const CLIMBS = FULL ? 4 : 1;

const optimiserFor = (name: string, skills = MAXED) => {
  const m = monsters.find((x) => x.name === name);
  if (!m) throw new Error(`No monster called ${name}`);
  return new Optimiser(m.monster, { skills, onTask: m.slayer && !m.boss, untradeables: true, unlockedOnly: true, kandarinDiary: true, chargeSpell: false }, prices);
};

const describeSetup = (s: Setup) => `${SLOTS.map((slot) => s.equipment[slot]?.name).filter(Boolean).join(', ')} | ${s.style.name}${s.spell ? ` | ${s.spell.name}` : ''} | ${s.dps.toFixed(4)} DPS, ${Math.round(s.cost)} GP`;

// Small seeded random numbers, so a failure can be run again.
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

interface Task { weapon: Setup['equipment']['weapon'], style: Setup['style'], spell: Setup['spell'], ammo: { piece: NonNullable<Setup['equipment']['ammo']> } | null }
const tasksOf = (o: Optimiser, classes: CombatClass[]) => classes.flatMap((cls) => (o as unknown as { tasksFor: (c: CombatClass) => Task[] }).tasksFor(cls));

// Every swap of one item, or of the weapon with its style and spell or ammo, that the budget covers.
const affordableSwaps = (o: Optimiser, setup: Setup, budget: number, classes: CombatClass[], slots: Slot[] = SLOTS) => slots
  .flatMap((slot) => o.swaps(setup, slot, classes))
  .filter((s) => s.setup.cost <= budget);

// One random setup the budget covers: a random weapon, then random items in the other slots
// while the money lasts. A protected slot always gets one of the items allowed there.
const randomSetup = (o: Optimiser, budget: number, classes: CombatClass[], next: () => number): Setup | null => {
  const tasks = tasksOf(o, classes);
  const task = tasks[Math.floor(next() * tasks.length)];
  const equipment = { weapon: task.weapon, ammo: task.ammo?.piece ?? null } as Setup['equipment'];
  for (const slot of SLOTS) if (!(slot in equipment)) equipment[slot] = null;
  let setup = o.priced({ equipment, style: task.style, spell: task.spell });
  const protectedSlot = o.protection?.slot;
  const order = SLOTS.filter((s) => s !== 'weapon' && !(s === 'ammo' && task.ammo) && !(s === 'shield' && task.weapon!.isTwoHanded))
    .sort((a, b) => Number(b === protectedSlot) - Number(a === protectedSlot) || next() - 0.5);
  for (const slot of order) {
    const options = o.slotItems.get(slot)!;
    if (!options.length) continue;
    // Half the time a slot stays empty, unless the monster demands something there.
    if (slot !== protectedSlot && next() < 0.3) continue;
    for (let tries = 0; tries < 6; tries += 1) {
      const { item } = options[Math.floor(next() * options.length)];
      const tried = o.priced({ equipment: { ...setup.equipment, [slot]: item.piece }, style: setup.style, spell: setup.spell });
      if (tried.cost <= budget) {
        setup = tried;
        break;
      }
    }
    if (slot === protectedSlot && !setup.equipment[slot]) return null;
  }
  return setup.cost <= budget ? setup : null;
};

// Takes the best affordable single swap until none adds DPS. The weapon stays: trying every weapon
// at each step is slow, and the swap check above already tries every weapon on the best setup.
const ARMOUR_SLOTS = SLOTS.filter((s) => s !== 'weapon');
const climb = (o: Optimiser, start: Setup, budget: number, classes: CombatClass[]) => {
  let setup = start;
  for (let step = 0; step < 30; step += 1) {
    const better = affordableSwaps(o, setup, budget, classes, ARMOUR_SLOTS).filter((s) => s.setup.dps > setup.dps + EPS);
    if (!better.length) break;
    setup = better.reduce((a, b) => (b.setup.dps > a.setup.dps ? b : a)).setup;
  }
  return setup;
};

const CASES: [string, number, CombatClass[], typeof MAXED?][] = [
  ['Vorkath', 1e6, ALL], ['Vorkath', 30e6, ALL], ['Vorkath', Infinity, ALL],
  ['General Graardor', 5e6, ['melee']], ['General Graardor', 200e6, ['melee']],
  ['Zulrah', 10e6, ALL], ['Zulrah', 100e6, ['magic']],
  ["Kree'arra", 20e6, ['ranged']],
  ['Abyssal demon', 3e6, ALL], ['Abyssal demon', 50e6, ['melee']],
  ['Duke Sucellus', 80e6, ALL],
  ['Aberrant spectre', 2e6, ALL],
  ['Hill Giant', 100_000, ALL],
  ['Vorkath', 10e6, ALL, MID], ['General Graardor', 20e6, ['melee'], MID],
];

describe('the checks can fail', () => {
  test('a cheaper best setup is beaten by a swap a bigger budget covers', () => {
    const o = optimiserFor('Vorkath');
    const cheap = o.optimise(1e6, ALL)!;
    expect(affordableSwaps(o, cheap, 30e6, ALL).some((s) => s.setup.dps > cheap.dps + EPS)).toBe(true);
  }, 120_000);

  test('a random setup climbs to the best one or below it, never past it', () => {
    const o = optimiserFor('Abyssal demon');
    const next = random(1);
    const start = randomSetup(o, 3e6, ['melee'], next)!;
    const top = climb(o, start, 3e6, ['melee']);
    expect(top.dps).toBeGreaterThanOrEqual(start.dps);
    expect(top.cost).toBeLessThanOrEqual(3e6);
  }, 120_000);
});

describe('no single swap beats the best setup', () => {
  test.each(CASES)('%s at %d GP with %j', (name, budget, classes, skills) => {
    const o = optimiserFor(name, skills);
    const best = o.optimise(budget, classes)!;
    expect(best).not.toBeNull();
    const beaten = affordableSwaps(o, best, budget, classes).filter((s) => s.setup.dps > best.dps + EPS);
    expect(beaten.map((s) => `${s.item.piece.name} in ${s.slot}: ${describeSetup(s.setup)}`), describeSetup(best)).toEqual([]);
  }, 300_000);
});

describe('no random setup beats the best setup', () => {
  test.each(CASES)('%s at %d GP with %j', (name, budget, classes, skills) => {
    const o = optimiserFor(name, skills);
    const best = o.optimise(budget, classes)!;
    const next = random(name.length * 7919 + Math.min(budget, 1e12));
    const starts: Setup[] = [];
    for (let i = 0; i < RANDOM_SETUPS; i += 1) {
      const s = randomSetup(o, budget, classes, next);
      if (!s) continue;
      expect(s.dps, `random ${describeSetup(s)} beats ${describeSetup(best)}`).toBeLessThanOrEqual(best.dps + EPS);
      starts.push(s);
    }
    expect(starts.length).toBeGreaterThan(RANDOM_SETUPS / 15);
    // The strongest random setups, and a few others, climbed one swap at a time.
    const picked = [...starts].sort((a, b) => b.dps - a.dps).slice(0, CLIMBS).concat(starts.slice(0, CLIMBS));
    for (const start of picked) {
      const top = climb(o, start, budget, classes);
      expect(top.dps, `climbed to ${describeSetup(top)}, best is ${describeSetup(best)}`).toBeLessThanOrEqual(best.dps + EPS);
    }
  }, 600_000);
});
