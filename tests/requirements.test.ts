import { describe, expect, test } from 'vitest';
import { combatLevel, meets } from '../src/requirements';

const maxed = { atk: 99, str: 99, def: 99, ranged: 99, magic: 99, prayer: 99, hp: 99, agility: 99, slayer: 99, mining: 99, herblore: 99 };
const fresh = { atk: 1, str: 1, def: 1, ranged: 1, magic: 1, prayer: 1, hp: 10, agility: 1, slayer: 1, mining: 1, herblore: 1 };

describe('requirements', () => {
  test('works out the combat level as the game does', () => {
    expect(combatLevel(maxed)).toBe(126);
    expect(combatLevel(fresh)).toBe(3);
    // A 1 Defence ranged pure gets its level from Ranged.
    expect(combatLevel({ ...fresh, ranged: 99, hp: 99, prayer: 52 })).toBe(79);
  });

  test('every level has to be met', () => {
    expect(meets({ atk: 80 }, { ...maxed, atk: 70 })).toBe(false);
    expect(meets({ atk: 80 }, { ...maxed, atk: 80 })).toBe(true);
    expect(meets({ ranged: 80, agility: 70 }, { ...maxed, agility: 69 })).toBe(false);
    expect(meets({}, fresh)).toBe(true);
  });

  test('a combat level requirement uses the combat level', () => {
    expect(meets({ combat: 40, def: 10, str: 20 }, { ...fresh, def: 10, str: 20 })).toBe(false);
    expect(meets({ combat: 40, def: 10, str: 20 }, { ...fresh, atk: 40, str: 40, def: 30, hp: 35 })).toBe(true);
  });
});
