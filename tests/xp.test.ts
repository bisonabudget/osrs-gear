import { describe, expect, test } from 'vitest';
import { showsXp, xpPerHour } from '../src/xp';

const strength = { name: 'Chop', type: 'slash', stance: 'Aggressive' };

describe('experience an hour', () => {
  test('only for monsters with a rate', () => {
    expect(showsXp('Gemstone Crab')).toBe(true);
    expect(xpPerHour('Zulrah', strength, 5)).toBeNull();
  });

  test('gemstone crabs give 3.5 a point of damage in the skill trained', () => {
    const rate = xpPerHour('Gemstone Crab', strength, 10)!;
    expect(rate.skill).toBe('Strength');
    expect(rate.xp).toBeCloseTo(10 * 3600 * 3.5);
  });

  test('ranged and magic train their own skill', () => {
    expect(xpPerHour('Gemstone Crab', { name: 'x', type: 'ranged', stance: 'Rapid' }, 1)!.skill).toBe('Ranged');
    expect(xpPerHour('Gemstone Crab', { name: 'x', type: 'magic', stance: 'Autocast' }, 1)!.skill).toBe('Magic');
  });
});
