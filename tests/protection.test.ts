import { expect, test } from 'vitest';
import { items } from '../src/engine/data';
import { PROTECTIVE_ITEMS, protectionFor } from '../src/protection';

test('protection is found by name, quest copies included', () => {
  expect(protectionFor('Aberrant spectre')?.slot).toBe('head');
  expect(protectionFor('Basilisk (The Fremennik Exiles)')?.slot).toBe('shield');
  expect(protectionFor('Vorkath')).toBeNull();
});

test('every protective item is in the data', () => {
  const names = new Set(items.map((i) => i.piece.name));
  expect([...PROTECTIVE_ITEMS].filter((n) => !names.has(n))).toEqual([]);
});
