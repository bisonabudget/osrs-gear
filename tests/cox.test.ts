// Challenge Mode makes Chambers of Xeric monsters tougher, and only them.
import { expect, test } from 'vitest';
import { emptyEquipment, items } from '../src/engine/data';
import { monsters } from '../src/engine/monsters';
import { buildPlayer, dpsOf, evaluate } from '../src/engine/evaluate';
import { inChallengeMode, inCox } from '../src/cox';
import PlayerVsNPCCalc from '@/lib/PlayerVsNPCCalc';
import { getCombatStylesForCategory } from '@/utils';

const skills = { atk: 99, def: 99, hp: 99, magic: 99, prayer: 99, ranged: 99, str: 99, agility: 99, slayer: 99, mining: 99, herblore: 99 };
const character = { skills, onTask: false, untradeables: true, unlockedOnly: true, kandarinDiary: true, chargeSpell: false, inWilderness: false };
const weapon = items.find((i) => i.piece.name === 'Abyssal whip')!.piece;
const setup = { equipment: { ...emptyEquipment(), weapon }, style: getCombatStylesForCategory(weapon.category)[1], spell: null };
const entry = (name: string) => monsters.find((m) => m.name === name)!;
// The hitpoints the DPS calculator fights, after it has scaled the monster itself.
const hpInCalc = (m: ReturnType<typeof entry>['monster']) => (
  new PlayerVsNPCCalc(buildPlayer(setup, m, character), m, { loadoutName: 'x' }) as unknown as { monster: typeof m }).monster.skills.hp;

test('Challenge Mode gives a CoX monster half as many hitpoints again and makes it harder to hit', () => {
  const vasa = entry('Vasa Nistirio').monster;
  const cm = inChallengeMode(vasa, true);
  expect(hpInCalc(cm)).toBe(Math.trunc(hpInCalc(vasa) * 1.5));
  expect(cm.inputs.monsterCurrentHp).toBe(hpInCalc(cm));
  expect(dpsOf(setup, cm, character)).toBeLessThan(dpsOf(setup, vasa, character));
  expect(evaluate(setup, cm, character).killTime).toBeGreaterThan(evaluate(setup, vasa, character).killTime);
});

test('only CoX monsters are changed', () => {
  const vorkath = entry('Vorkath');
  expect(inCox(vorkath.monster.attributes)).toBe(false);
  expect(inChallengeMode(vorkath.monster, true)).toBe(vorkath.monster);
  expect(inCox(entry('Tekton').monster.attributes)).toBe(true);
  expect(inChallengeMode(entry('Tekton').monster, false)).toBe(entry('Tekton').monster);
});
