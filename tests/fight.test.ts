// Hits that change as the monster loses HP are averaged over the whole kill.
import { expect, test } from 'vitest';
import { emptyEquipment, items, monsters } from '../src/engine/data';
import { dpsOf, evaluate, FightCache } from '../src/engine/evaluate';
import { inRaid } from '../src/toa';
import { getCombatStylesForCategory } from '@/utils';

const skills = { atk: 99, def: 99, hp: 99, magic: 99, prayer: 99, ranged: 99, str: 99, agility: 99, slayer: 99, mining: 99, herblore: 99 };
const character = { skills, onTask: false, untradeables: true, unlockedOnly: true, kandarinDiary: true, chargeSpell: false, inWilderness: false };
const piece = (name: string) => items.find((i) => i.piece.name === name)!.piece;
const setupOf = (name: string, ammo?: string) => {
  const weapon = piece(name);
  return { equipment: { ...emptyEquipment(), weapon, ammo: ammo ? piece(ammo) : null }, style: getCombatStylesForCategory(weapon.category)[1], spell: null };
};
const monster = (name: string) => monsters.find((m) => m.name === name)!.monster;
const zcb = setupOf('Zaryte crossbow', 'Ruby dragon bolts (e)');

test('ruby bolt procs shrink below 500 HP, so they count for less over the kill', () => {
  const zebak = evaluate(zcb, monster('Zebak'), character);
  expect(zebak.dps).toBeLessThan(zebak.startDps * 0.9);
  // A boss with more HP spends more of the kill above 500, so loses less.
  const raised = evaluate(zcb, inRaid(monster('Zebak'), { level: 300, path: 0 }), character);
  expect(raised.dps / raised.startDps).toBeGreaterThan(zebak.dps / zebak.startDps);
});

test('hits that don\'t depend on HP keep the DPS calculator\'s figure', () => {
  const whip = evaluate(setupOf('Abyssal whip'), monster('Zebak'), character);
  expect(whip.dps).toBe(whip.startDps);
  const sapphires = evaluate(setupOf('Zaryte crossbow', 'Diamond dragon bolts (e)'), monster('Zebak'), character);
  expect(sapphires.dps).toBe(sapphires.startDps);
});

test('Vardorvis gets easier to hit as he loses HP', () => {
  const whip = evaluate(setupOf('Abyssal whip'), monster('Vardorvis'), character);
  expect(whip.dps).toBeGreaterThan(whip.startDps);
});

test('the kill time matches the DPS over the kill', () => {
  const zebak = monster('Zebak');
  const { dps, killTime } = evaluate(zcb, zebak, character);
  // Damage past the last of its HP is wasted, so the kill takes a little longer than HP over DPS.
  expect(killTime).toBeGreaterThan(zebak.skills.hp / dps);
  expect(killTime).toBeLessThan(zebak.skills.hp / dps * 1.05);
});

test('setups sharing a worked out figure stay close to their own', () => {
  const cache: FightCache = new Map();
  const vorkath = monster('Vorkath');
  const gear = ['Masori mask', 'Masori body', 'Masori chaps', 'Zaryte vambraces', 'Pegasian boots', 'Necklace of anguish'];
  const base = { ...zcb, equipment: { ...zcb.equipment, weapon: piece('Dragon hunter crossbow') } };
  for (let n = 0; n <= gear.length; n++) {
    const equipment = { ...base.equipment };
    for (const name of gear.slice(0, n)) equipment[piece(name).slot] = piece(name);
    const setup = { ...base, equipment };
    expect(dpsOf(setup, vorkath, character, cache)).toBeCloseTo(dpsOf(setup, vorkath, character), 1);
  }
});
