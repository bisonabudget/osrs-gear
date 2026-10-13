// The Custom monster: a copy of a fight's stats that the player changes.
import { describe, expect, test } from 'vitest';
import { copyOf, customInfo, monsterInfo, monsterList } from '../src/catalog';
import { customMonster, monsters } from '../src/engine/monsters';
import { Optimiser } from '../src/optimiser/optimise';
import { pickPrices } from '../src/prices';
import fixture from './fixtures/prices.json';

const prices = pickPrices(fixture.latest as never, fixture.hour as never, fixture.hourTime, fixture.now);
const skills = { atk: 99, def: 99, hp: 99, magic: 99, prayer: 99, ranged: 99, str: 99, agility: 99, slayer: 99, mining: 99, herblore: 99 };
const character = { skills, onTask: false, untradeables: true, unlockedOnly: true, kandarinDiary: true, chargeSpell: false, inWilderness: false };
const info = (name: string) => monsterList.find((m) => m.name === name)!;
const fight = (name: string) => monsters.find((m) => m.name === name)!.monster;

describe('custom monster', () => {
  test('a copy shows the stats it was copied from', () => {
    const vorkath = info('Vorkath');
    const shown = customInfo(copyOf(vorkath));
    expect(shown.skills).toEqual(vorkath.skills);
    expect(shown.defence).toEqual(vorkath.defence);
    expect(shown.weakness).toEqual(vorkath.weakness);
    expect(shown.name).toBe('Custom monster');
  });

  test('the engine fights a copy with the stats shown', () => {
    const c = copyOf(info('Vorkath'));
    const m = customMonster(c);
    expect(m.skills.def).toBe(c.def);
    expect(m.defensive.heavy).toBe(c.defence.heavy);
    expect(m.attributes).toEqual(c.attributes);
  });

  test('a copy of a monster with no special mechanics gets the same best setup', () => {
    const real = new Optimiser(fight('Vorkath'), character, prices).optimise(20e6, ['ranged']);
    const copy = new Optimiser(customMonster(copyOf(info('Vorkath'))), character, prices).optimise(20e6, ['ranged']);
    expect(copy!.dps).toBeCloseTo(real!.dps, 9);
  }, 120_000);

  test('lower defence means more DPS', () => {
    const c = copyOf(info('Vorkath'));
    const before = new Optimiser(customMonster(c), character, prices).optimise(20e6, ['ranged'])!.dps;
    const after = new Optimiser(customMonster({ ...c, def: 1 }), character, prices).optimise(20e6, ['ranged'])!.dps;
    expect(after).toBeGreaterThan(before);
  }, 120_000);

  test('a copy needs no protection gear', () => {
    const c = copyOf(info('Aberrant spectre'));
    const setup = new Optimiser(customMonster(c), { ...character, onTask: true }, prices).optimise(0, ['melee']);
    expect(setup).not.toBeNull();
  }, 120_000);

  test('raid scaling is left out, so the stats typed are the ones used', () => {
    const olm = monsterList.find((m) => m.attributes.includes('xerician'))!;
    const c = copyOf(olm);
    expect(c.attributes).not.toContain('xerician');
    expect(customMonster(c).skills.def).toBe(olm.skills.def);
    expect(monsterInfo.get(c.from)).toBeDefined();
  });
});
