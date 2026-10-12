// The Tombs of Amascut raid and path levels scale its monsters, and only them.
import { expect, test } from 'vitest';
import { emptyEquipment, items, monsters } from '../src/engine/data';
import { dpsOf, evaluate } from '../src/engine/evaluate';
import { inRaid, inToa, pathOf, raidHp } from '../src/toa';
import { getCombatStylesForCategory } from '@/utils';

const skills = { atk: 99, def: 99, hp: 99, magic: 99, prayer: 99, ranged: 99, str: 99, agility: 99, slayer: 99, mining: 99, herblore: 99 };
const character = { skills, onTask: false, untradeables: true, unlockedOnly: true, kandarinDiary: true, chargeSpell: false, inWilderness: false };
const weapon = items.find((i) => i.piece.name === 'Abyssal whip')!.piece;
const setup = { equipment: { ...emptyEquipment(), weapon }, style: getCombatStylesForCategory(weapon.category)[1], spell: null };
const zebak = monsters.find((m) => m.name === 'Zebak')!;
const vorkath = monsters.find((m) => m.name === 'Vorkath')!;

test('a higher raid level makes a ToA boss harder to hit and slower to kill', () => {
  const raised = inRaid(zebak.monster, { level: 300, path: 0 });
  expect(raised.skills.hp).toBe(1280);
  expect(raised.inputs.monsterCurrentHp).toBe(1280);
  expect(dpsOf(setup, raised, character)).toBeLessThan(dpsOf(setup, zebak.monster, character));
  expect(evaluate(setup, raised, character).killTime).toBeGreaterThan(evaluate(setup, zebak.monster, character).killTime);
});

test('the page shows the same hitpoints the worker uses', () => {
  const raid = { level: 300, path: 2 };
  expect(raidHp(zebak.key, zebak.monster.skills.hp, raid)).toBe(inRaid(zebak.monster, raid).skills.hp);
  expect(raidHp(zebak.key, zebak.monster.skills.hp, { level: 0, path: 0 })).toBe(zebak.monster.skills.hp);
});

test('a path level adds hitpoints to its boss but leaves it as easy to hit', () => {
  const raised = inRaid(zebak.monster, { level: 300, path: 2 });
  expect(raised.skills.hp).toBe(1440);
  const accuracy = (m: typeof raised) => evaluate(setup, m, character).accuracy;
  expect(accuracy(raised)).toBe(accuracy(inRaid(zebak.monster, { level: 300, path: 0 })));
});

test('each path boss is on its own path, and the Wardens are on none', () => {
  const keyOf = (name: string) => monsters.find((m) => m.name === name)!.key;
  expect(pathOf(keyOf('Zebak'))).toBe('Crondis');
  expect(pathOf(keyOf('Akkha'))).toBe('Het');
  expect(pathOf(keyOf("Akkha's Shadow"))).toBe('Het');
  expect(pathOf(keyOf('Ba-Ba'))).toBe('Apmeken');
  expect(pathOf(keyOf('Kephri'))).toBe('Scabaras');
  expect(pathOf(keyOf("Tumeken's Warden"))).toBe(null);
});

test('monsters outside the raid are left alone', () => {
  expect(inToa(zebak.key)).toBe(true);
  expect(inToa(vorkath.key)).toBe(false);
  expect(inRaid(vorkath.monster, { level: 300, path: 2 })).toBe(vorkath.monster);
  expect(raidHp(vorkath.key, 750, { level: 300, path: 2 })).toBe(750);
});
