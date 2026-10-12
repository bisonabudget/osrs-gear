import { expect, test } from 'vitest';
import { wildernessOf } from '../src/wilderness';

test('only monsters fought in and out of the Wilderness get the switch', () => {
  expect(wildernessOf('Callisto')).toBe('always');
  expect(wildernessOf('Revenant dragon')).toBe('always');
  expect(wildernessOf('Greater demon')).toBe('sometimes');
  expect(wildernessOf('Bandit (Pollnivneach)')).toBe('never');
  expect(wildernessOf('Akkha')).toBe('never');
  expect(wildernessOf('Yama')).toBe('never');
});
