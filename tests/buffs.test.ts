// The Kandarin diary, Charge and Wilderness switches, and Mark of Darkness, reach the DPS calculator.
import { expect, test } from 'vitest';
import { emptyEquipment, items, monsters } from '../src/engine/data';
import { assumedBoosts, dpsOf } from '../src/engine/evaluate';
import { spells } from '@/types/Spell';
import { getCombatStylesForCategory } from '@/utils';

const skills = { atk: 99, def: 99, hp: 99, magic: 99, prayer: 99, ranged: 99, str: 99, agility: 99, slayer: 99, mining: 99, herblore: 99 };
const character = { skills, onTask: false, untradeables: true, unlockedOnly: true, kandarinDiary: true, chargeSpell: false, inWilderness: false };
const piece = (name: string) => {
  const item = items.find((i) => i.piece.name === name && !i.piece.version?.includes('Inactive'));
  if (!item) throw new Error(`No item called ${name}`);
  return item.piece;
};
const monster = monsters.find((m) => m.name === 'General Graardor')!.monster;

test('the Kandarin hard diary raises enchanted bolt DPS', () => {
  const weapon = piece('Rune crossbow');
  const setup = { equipment: { ...emptyEquipment(), weapon, ammo: piece('Ruby bolts (e)') }, style: getCombatStylesForCategory(weapon.category)[1], spell: null };
  expect(dpsOf(setup, monster, character)).toBeGreaterThan(dpsOf(setup, monster, { ...character, kandarinDiary: false }));
});

test('Charge raises a god spell with the matching cape', () => {
  const weapon = piece('Void knight mace');
  const spell = spells.find((s) => s.name === 'Claws of Guthix')!;
  const style = getCombatStylesForCategory(weapon.category).find((s) => s.stance === 'Autocast')!;
  const setup = { equipment: { ...emptyEquipment(), weapon, cape: piece('Guthix cape') }, style, spell };
  expect(dpsOf(setup, monster, { ...character, chargeSpell: true })).toBeGreaterThan(dpsOf(setup, monster, character));
});

test('the Wilderness raises a Wilderness weapon', () => {
  const weapon = items.find((i) => i.piece.name === "Craw's bow" && i.piece.version === 'Charged')!.piece;
  const setup = { equipment: { ...emptyEquipment(), weapon }, style: getCombatStylesForCategory(weapon.category)[1], spell: null };
  const callisto = monsters.find((m) => m.name === 'Callisto')!.monster;
  expect(dpsOf(setup, callisto, { ...character, inWilderness: true })).toBeGreaterThan(dpsOf(setup, callisto, character));
});

test('Mark of Darkness is cast with demonbane spells from 59 Magic', () => {
  const weapon = piece('Purging staff');
  const style = getCombatStylesForCategory(weapon.category).find((s) => s.stance === 'Autocast')!;
  const setup = { equipment: { ...emptyEquipment(), weapon }, style, spell: spells.find((s) => s.name === 'Inferior Demonbane')! };
  const yama = monsters.find((m) => m.name === 'Yama')!.monster;
  expect(dpsOf(setup, yama, character)).toBeGreaterThan(dpsOf(setup, yama, { ...character, skills: { ...skills, magic: 58 } }) * 1.2);
  expect(assumedBoosts('magic', character, setup.spell).effects).toContain('Mark of Darkness');
});
