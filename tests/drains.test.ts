// Defence drains from special attacks and spells reach the DPS calculator.
import { expect, test } from 'vitest';
import { emptyEquipment, items, monsters } from '../src/engine/data';
import { dpsOf } from '../src/engine/evaluate';
import { withDrains } from '../src/engine/drains';
import { drainSummary, NO_DRAINS } from '../src/drains';
import { scaleMonster } from '@/lib/MonsterScaling';
import { getCombatStylesForCategory } from '@/utils';

const skills = { atk: 99, def: 99, hp: 99, magic: 99, prayer: 99, ranged: 99, str: 99, agility: 99, slayer: 99, mining: 99, herblore: 99 };
const character = { skills, onTask: false, untradeables: true, unlockedOnly: true, kandarinDiary: true, chargeSpell: false, inWilderness: false };
const weapon = items.find((i) => i.piece.name === 'Abyssal whip')!.piece;
const setup = { equipment: { ...emptyEquipment(), weapon }, style: getCombatStylesForCategory(weapon.category)[1], spell: null };
const graardor = monsters.find((m) => m.name === 'General Graardor')!.monster;
const warden = monsters.find((m) => m.key === '11762:Damaged')!.monster;
const fought = (m: typeof graardor, drains: Partial<typeof NO_DRAINS>) => scaleMonster(withDrains(m, { ...NO_DRAINS, ...drains }));

test('a Dragon warhammer hit lowers Defence by 30% and raises DPS', () => {
  expect(fought(graardor, { dwh: 1 }).skills.def).toBe(graardor.skills.def - Math.trunc(graardor.skills.def * 0.3));
  expect(dpsOf(setup, withDrains(graardor, { ...NO_DRAINS, dwh: 1 }), character)).toBeGreaterThan(dpsOf(setup, graardor, character));
});

test('drains stop at the Wardens\' Defence floor of 120', () => {
  expect(warden.skills.def).toBe(150);
  expect(fought(warden, { bgs: 20 }).skills.def).toBe(130);
  expect(fought(warden, { bgs: 60 }).skills.def).toBe(120);
  expect(fought(warden, { dwh: 3 }).skills.def).toBe(120);
});

test('a bone dagger lowers Defence by its damage, down to the same floor', () => {
  expect(fought(graardor, { boneDagger: 20 }).skills.def).toBe(graardor.skills.def - 20);
  expect(fought(warden, { boneDagger: 20 }).skills.def).toBe(130);
  expect(fought(warden, { boneDagger: 50 }).skills.def).toBe(120);
});

test('the Eye of ayak lowers magic defence', () => {
  expect(fought(warden, { ayak: 15 }).defensive.magic).toBe(warden.defensive.magic - 15);
  expect(fought(warden, { ayak: 100 }).defensive.magic).toBe(0);
});

test('drains are summed up in a few words', () => {
  expect(drainSummary(NO_DRAINS)).toBe(null);
  expect(drainSummary({ ...NO_DRAINS, dwh: 2, bgs: 30, spell: 'accursed' })).toBe('DWH ×2, BGS 30, Accursed');
});
