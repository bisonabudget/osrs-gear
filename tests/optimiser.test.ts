// The search, run with a saved copy of the Grand Exchange prices so results don't move.
import { describe, expect, test } from 'vitest';
import { itemById, monsters, SLOTS } from '../src/engine/data';
import type { CombatClass } from '../src/engine/evaluate';
import { Optimiser, Setup, Swap } from '../src/optimiser/optimise';
import { spellLevel } from '../src/optimiser/spellbook';
import { pickPrices } from '../src/prices';
import fixture from './fixtures/prices.json';

const prices = pickPrices(fixture.latest as never, fixture.hour as never, fixture.hourTime, fixture.now);
const skills = { atk: 99, def: 99, hp: 99, magic: 99, prayer: 99, ranged: 99, str: 99, agility: 99, slayer: 99, mining: 99, herblore: 99 };
const CLASSES: CombatClass[] = ['melee', 'ranged', 'magic'];

const optimiserFor = (name: string, untradeables = true) => {
  const m = monsters.find((x) => x.name === name);
  if (!m) throw new Error(`No monster called ${name}`);
  return new Optimiser(m.monster, { skills, onTask: m.slayer && !m.boss, untradeables, unlockedOnly: true, kandarinDiary: true, chargeSpell: false, inWilderness: false }, prices);
};

const worn = (setup: Setup) => SLOTS.flatMap((s) => (setup.equipment[s] ? [itemById.get(setup.equipment[s]!.id)!] : []));

describe('best setup', () => {
  test.each(['Vorkath', 'Zulrah', 'General Graardor', 'Abyssal demon'])('%s stays within each budget and gets better as it grows', (name) => {
    const o = optimiserFor(name);
    let last = 0;
    for (const budget of [1e6, 10e6, 100e6, Infinity]) {
      const setup = o.optimise(budget, CLASSES)!;
      expect(setup).not.toBeNull();
      expect(setup.cost).toBeLessThanOrEqual(budget + 1e-6);
      expect(setup.dps).toBeGreaterThanOrEqual(last - 1e-9);
      last = setup.dps;
    }
  }, 120_000);

  test('every tradeable item in a result has a price', () => {
    for (const name of ['Vorkath', "Kree'arra", 'Duke Sucellus']) {
      const o = optimiserFor(name);
      for (const budget of [5e6, 50e6, Infinity]) {
        const setup = o.optimise(budget, CLASSES)!;
        for (const item of worn(setup)) {
          if (item.priceId !== null) expect(prices.get(item.priceId), item.piece.name).toBeDefined();
        }
      }
    }
  }, 120_000);

  test('with Untradeables off every item can be bought', () => {
    const o = optimiserFor('Vorkath', false);
    const setup = o.optimise(50e6, CLASSES)!;
    for (const item of worn(setup)) {
      expect(item.priceId !== null || item.ways.some((w) => !w.earned), item.piece.name).toBe(true);
    }
  }, 120_000);

  // Turning off the bound that skips weapons makes the search try every one in full, which is
  // slow but sure. The quick search must find setups just as good.
  test.each([
    ['Vorkath', 2e6], ['Vorkath', Infinity], ["Kree'arra", 20e6], ['Duke Sucellus', 200e6], ['Abyssal demon', 20e6],
  ])('%s at %d matches trying every weapon in full', (name, budget) => {
    const quick = optimiserFor(name as string);
    const full = optimiserFor(name as string);
    (full as unknown as { taskBound: () => unknown }).taskBound = () => ({ plain: Infinity, bound: Infinity });
    for (const cls of CLASSES) {
      const a = quick.optimise(budget as number, [cls]);
      const b = full.optimise(budget as number, [cls]);
      expect(a?.dps ?? 0, `${cls}`).toBeGreaterThanOrEqual((b?.dps ?? 0) - 1e-9);
    }
  }, 600_000);

  test('Vorkath picks a dragon-slaying crossbow with no limit', () => {
    const setup = optimiserFor('Vorkath').optimise(Infinity, CLASSES)!;
    expect(setup.equipment.weapon?.name).toBe('Dragon hunter crossbow');
  }, 120_000);
});

describe('fortified Masori', () => {
  const masori = (setup: Setup) => worn(setup).map((i) => i.piece.name).filter((n) => n.startsWith('Masori'));

  test('is worn in place of plain Masori when the budget covers it', () => {
    const setup = optimiserFor("Kree'arra").optimise(Infinity, ['ranged'])!;
    expect(masori(setup).length).toBeGreaterThan(0);
    expect(masori(setup).every((n) => n.endsWith(' (f)'))).toBe(true);
  }, 120_000);

  test('stays plain when the money left over does not cover it, for the same DPS', () => {
    const o = optimiserFor("Kree'arra");
    const best = o.optimise(Infinity, ['ranged'])!;
    const equipment = { ...best.equipment };
    for (const slot of SLOTS) {
      const name = equipment[slot]?.name;
      if (name?.startsWith('Masori')) equipment[slot] = [...itemById.values()].find((i) => i.piece.name === name.replace(' (f)', ''))!.piece;
    }
    const plain = o.priced({ equipment, style: best.style, spell: best.spell });
    const setup = o.optimise(plain.cost, ['ranged'])!;
    expect(setup.dps).toBeCloseTo(best.dps, 9);
    expect(masori(setup).length).toBeGreaterThan(0);
    expect(masori(setup).some((n) => n.endsWith(' (f)'))).toBe(false);
  }, 120_000);
});

describe('only gear I can use', () => {
  const graardor = monsters.find((x) => x.name === 'General Graardor')!;
  const at = (levels: Partial<typeof skills>, unlockedOnly = true) => new Optimiser(
    graardor.monster,
    { skills: { ...skills, ...levels }, onTask: false, untradeables: true, unlockedOnly, kandarinDiary: true, chargeSpell: false, inWilderness: false },
    prices,
  );
  const weapons = (o: Optimiser) => o.slotItems.get('weapon')!.map(({ item }) => item.piece.name);

  test('leaves out what the levels are too low to wear', () => {
    expect(weapons(at({ atk: 70 }))).not.toContain('Ghrazi rapier');
    expect(weapons(at({ atk: 80 }))).toContain('Ghrazi rapier');
    expect(weapons(at({ atk: 70 }, false))).toContain('Ghrazi rapier');
  });

  test('the best setup with 70 Attack and no budget only has gear 70 Attack can wear', () => {
    const levels = { ...skills, atk: 70 };
    const setup = at({ atk: 70 }).optimise(Infinity, ['melee'])!;
    const wearable = (needs: Record<string, number | undefined>) => Object.entries(needs)
      .every(([s, l]) => s === 'combat' || levels[s as keyof typeof levels] >= l!);
    for (const item of worn(setup)) expect(wearable(item.needs), item.piece.name).toBe(true);
  }, 120_000);

  test('with 70 Magic no spell needs more than 70 Magic', () => {
    const o = at({ magic: 70 });
    const setup = o.optimise(Infinity, ['magic'])!;
    const spells = [setup, ...o.swaps(setup, 'weapon', ['magic']).map((s) => s.setup)].flatMap((s) => (s.spell ? [s.spell.name] : []));
    expect(spells.length).toBeGreaterThan(0);
    for (const name of spells) expect(spellLevel(name), name).toBeLessThanOrEqual(70);
  }, 120_000);
});

describe('what a setup uses up', () => {
  test('a magic setup pays for an hour of its runes or charges', () => {
    const o = optimiserFor('Vorkath');
    for (const budget of [1e6, 20e6, Infinity]) {
      const setup = o.optimise(budget, ['magic'])!;
      expect(setup.uses.some((u) => u.kind === 'runes' || u.kind === 'charges'), `${budget}`).toBe(true);
      expect(setup.ammoCost).toBeCloseTo(setup.uses.reduce((sum, u) => sum + u.gp, 0));
      expect(setup.cost).toBeCloseTo(Object.values(setup.prices).reduce((a, b) => a + b, 0) + setup.ammoCost);
    }
  }, 120_000);

  test('a salamander attacks with tar in its magic style', () => {
    const o = optimiserFor('General Graardor');
    const setup = o.optimise(10e6, ['magic'])!;
    const lizard = o.swaps(setup, 'weapon', ['magic']).find((s) => s.item.piece.name === 'Swamp lizard')!;
    expect(lizard.setup.style.name).toBe('Blaze');
    expect(lizard.setup.equipment.ammo?.name).toBe('Guam tar');
    expect(lizard.setup.dps).toBeGreaterThan(0);
    expect(lizard.setup.uses.map((u) => u.name)).toContain('Guam tar');
  }, 120_000);
});

describe('elite void', () => {
  test('is worn in place of plain void when it hits as hard', () => {
    const setup = optimiserFor('General Graardor').optimise(1e6, ['melee'])!;
    const names = worn(setup).map((i) => i.piece.name);
    expect(names).toEqual(expect.arrayContaining(['Elite void top', 'Elite void robe']));
    expect(names).not.toContain('Void knight top');
    expect(names).not.toContain('Void knight robe');
  }, 120_000);

  test('comes before plain void in a slot list when they tie', () => {
    const o = optimiserFor('Abyssal demon');
    const rows = o.slotOptions(o.optimise(Infinity, CLASSES)!, 'legs', CLASSES).map((r) => r.swap.item.piece.name);
    expect(rows.indexOf('Elite void robe')).toBeGreaterThanOrEqual(0);
    expect(rows.indexOf('Elite void robe')).toBeLessThan(rows.indexOf('Void knight robe'));
  }, 120_000);
});

describe('next upgrades', () => {
  test('each adds DPS, at any price, best value first', () => {
    const o = optimiserFor('Vorkath');
    const setup = o.optimise(10e6, CLASSES)!;
    const upgrades = o.upgrades(setup, CLASSES);
    expect(upgrades).toHaveLength(3);
    const value = (u: Swap) => u.gain / u.netCost;
    upgrades.forEach((u, i) => {
      expect(u.gain).toBeGreaterThan(0.01 * setup.dps);
      expect(u.setup.dps).toBeCloseTo(setup.dps + u.gain, 9);
      if (i) expect(value(u)).toBeLessThanOrEqual(value(upgrades[i - 1]));
    });
    // The crossbow costs more than the whole budget again, and adds the most for what it costs.
    expect(upgrades[0].item.piece.name).toBe('Dragon hunter crossbow');
    expect(upgrades[0].netCost).toBeGreaterThan(10e6);
    expect(new Set(upgrades.map((u) => u.item.piece.name)).size).toBe(upgrades.length);
  }, 120_000);

  test('none is beaten on both DPS and cost by another item for the same slot', () => {
    for (const [name, budget] of [['Vorkath', 1e6], ['General Graardor', 5e6], ["Kree'arra", 10e6], ['Abyssal demon', 50e6]] as const) {
      const o = optimiserFor(name);
      const setup = o.optimise(budget, CLASSES)!;
      for (const u of o.upgrades(setup, CLASSES)) {
        const better = o.swaps(setup, u.slot, CLASSES).find((s) => s.item !== u.item
          && s.gain >= u.gain - 1e-9 && s.netCost <= u.netCost && (s.gain > u.gain + 1e-9 || s.netCost < u.netCost));
        expect(better?.item.piece.name, `${name}: ${u.item.piece.name}`).toBeUndefined();
      }
    }
  }, 120_000);

  test('the slot list is sorted by DPS and includes what is worn', () => {
    const o = optimiserFor('Vorkath');
    const setup = o.optimise(10e6, CLASSES)!;
    const swaps = o.swaps(setup, 'shield', CLASSES);
    expect(swaps.some((s) => s.item.piece.id === setup.equipment.shield?.id)).toBe(true);
    for (let i = 1; i < swaps.length; i++) expect(swaps[i].setup.dps).toBeLessThanOrEqual(swaps[i - 1].setup.dps);
  }, 120_000);

  test('the slot list shows items with the same stats once, as the cheapest', () => {
    const o = optimiserFor('Vorkath');
    const setup = o.optimise(10e6, CLASSES)!;
    const rows = o.slotOptions(setup, 'feet', CLASSES);
    const gods = ["Ancient d'hide boots", "Armadyl d'hide boots", "Bandos d'hide boots", "Guthix d'hide boots", "Saradomin d'hide boots", "Zamorak d'hide boots"];
    const shown = rows.filter((r) => gods.includes(r.swap.item.piece.name));
    expect(shown).toHaveLength(1);
    const group = [shown[0].swap.item, ...shown[0].alike];
    expect(group.map((i) => i.piece.name).sort()).toEqual(gods);
    const worn = setup.equipment.feet?.id;
    if (!group.some((i) => i.piece.id === worn)) {
      for (const i of shown[0].alike) expect(o.costOf(i)!).toBeGreaterThanOrEqual(o.costOf(shown[0].swap.item)!);
    }
    // Every item still has a row of its own or shares one.
    expect(rows.reduce((n, r) => n + 1 + r.alike.length, 0)).toBe(o.swaps(setup, 'feet', CLASSES).length);
  }, 120_000);
});

describe('untradeable costs', () => {
  const byName = (name: string) => {
    const item = [...itemById.values()].find((i) => i.piece.name === name);
    if (!item) throw new Error(`No item called ${name}`);
    return item;
  };
  const gp = (id: number) => prices.get(id)!.gp;

  test('an untradeable made from GE items costs what goes into it', () => {
    const o = optimiserFor('Vorkath');
    // Avernic treads (pe) are made from Avernic treads, Pegasian boots and 4,000 demon tears.
    expect(o.costOf(byName('Avernic treads (pe)'))).toBeCloseTo(gp(31088) + gp(13237) + 4000 * gp(31111));
    expect(o.costOf(byName('Ferocious gloves'))).toBe(gp(22983));
    // Made from Avernic treads (pr)(pe), which is made from (pr) or (pe), and so on.
    expect(o.costOf(byName('Avernic treads (max)'))).toBeCloseTo(gp(31088) + gp(13239) + gp(13237) + gp(13235) + 12000 * gp(31111));
  });

  test('an untradeable sold for coins costs the coins', () => {
    expect(optimiserFor('Vorkath').costOf(byName('Barrows gloves'))).toBe(130_000);
    expect(optimiserFor('Vorkath', false).costOf(byName('Barrows gloves'))).toBe(130_000);
  });

  test('an earned untradeable is free, or left out with Untradeables off', () => {
    expect(optimiserFor('Vorkath').costOf(byName('Fire cape'))).toBe(0);
    expect(optimiserFor('Vorkath', false).costOf(byName('Fire cape'))).toBeUndefined();
  });

  test('an untradeable that needs something earned is left out with Untradeables off', () => {
    // An Avernic defender is a dragon defender with the hilt added.
    expect(optimiserFor('Vorkath').costOf(byName('Avernic defender'))).toBe(gp(22477));
    expect(optimiserFor('Vorkath', false).costOf(byName('Avernic defender'))).toBeUndefined();
  });

  test('a setup costs the sum of its items and ammo', () => {
    const o = optimiserFor('Vorkath');
    for (const budget of [10e6, 300e6, Infinity]) {
      const setup = o.optimise(budget, CLASSES)!;
      const items = Object.values(setup.prices).reduce((a, b) => a + b, 0);
      expect(setup.cost).toBeCloseTo(items + setup.ammoCost);
      for (const item of worn(setup)) {
        if (item.priceId === null && item.ways.every((w) => w.parts.length || w.coins)) {
          expect(setup.prices[item.piece.slot as keyof typeof setup.prices], item.piece.name).toBeGreaterThan(0);
        }
      }
    }
  }, 120_000);
});

describe('elemental weakness', () => {
  const vorkath = monsters.find((x) => x.name === 'Vorkath')!;
  const character = { skills, onTask: false, untradeables: true, unlockedOnly: true, kandarinDiary: true, chargeSpell: false, inWilderness: false };

  test('a monster weak to fire is fought with a fire spell', () => {
    expect(vorkath.monster.weakness?.element).toBe('fire');
    for (const budget of [1e6, 20e6]) {
      const setup = new Optimiser(vorkath.monster, character, prices).optimise(budget, ['magic'])!;
      expect(setup.spell?.element, `${budget}`).toBe('fire');
    }
  }, 120_000);

  test('the weakness adds DPS and can change the weapon', () => {
    const weak = new Optimiser(vorkath.monster, character, prices).optimise(1e6, ['magic'])!;
    const plain = new Optimiser({ ...vorkath.monster, weakness: null }, character, prices).optimise(1e6, ['magic'])!;
    // Fire Surge from a sceptre beats the warped sceptre only because of the weakness. (The
    // Trident's charges cost too much for this budget.)
    expect(weak.equipment.weapon?.name).toBe('Ancient sceptre');
    expect(plain.equipment.weapon?.name).toBe('Warped sceptre');
    expect(weak.dps).toBeGreaterThan(plain.dps);
  }, 120_000);
});

describe('protection', () => {
  test.each([
    ['Aberrant spectre', 'head', ['Nose peg', 'Slayer helmet', 'Slayer helmet (i)']],
    ['Basilisk Knight', 'shield', ['Mirror shield', "V's shield"]],
    ['Skeletal Wyvern', 'shield', ['Elemental shield', 'Mind shield', 'Dragonfire shield', 'Dragonfire ward', 'Ancient wyvern shield']],
    ['Dire gryphon', 'cape', ['Tortugan shield']],
    ['Killerwatt', 'feet', ['Insulated boots']],
  ] as const)('every %s setup wears it in the %s slot', (name, slot, allowed) => {
    const optimiser = optimiserFor(name);
    for (const budget of [50_000, 5e6, Infinity]) {
      const setup = optimiser.optimise(budget, CLASSES)!;
      expect(allowed, `${budget}`).toContain(setup.equipment[slot]?.name);
      if (slot === 'shield') expect(setup.equipment.weapon?.isTwoHanded, `${budget}`).toBeFalsy();
      expect(setup.cost, `${budget}`).toBeLessThanOrEqual(budget);
    }
  }, 120_000);

  test('the lantern held against harpie bug swarms leaves the shield slot empty', () => {
    const setup = optimiserFor('Harpie Bug Swarm').optimise(Infinity, CLASSES)!;
    expect(setup.equipment.shield ?? null).toBeNull();
  }, 60_000);

  test('there is no setup when the levels allow none of the items', () => {
    const m = monsters.find((x) => x.name === 'Basilisk Knight')!;
    const optimiser = new Optimiser(m.monster, { skills: { ...skills, slayer: 20 }, onTask: true, untradeables: true, unlockedOnly: true, kandarinDiary: true, chargeSpell: false, inWilderness: false }, prices);
    expect(optimiser.optimise(Infinity, CLASSES)).toBeNull();
  }, 60_000);
});
