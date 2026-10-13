// Every picture the site shows is kept in public/img. After a data rebuild, run
// scripts/fetch-images.ts to copy any new ones.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import items from '../src/data/items.json';
import monsters from '../src/data/monsters.json';
import { backupOf, itemImage, monsterImage, wikiImage } from '../src/catalog';

const IMG = join(import.meta.dirname, '../public/img');

test('every item and monster picture is on the site', () => {
  const missing = [
    ...items.map((i) => join('equipment', i.image)),
    ...monsters.flatMap((m) => (m.image ? [join('monsters', m.image)] : [])),
  ].filter((p) => !existsSync(join(IMG, p)));
  expect(missing).toEqual([]);
});

test('a picture the site keeps can fall back to the Wiki copy', () => {
  expect(backupOf(itemImage('Abyssal whip.png'))).toBe('https://oldschool.runescape.wiki/images/Abyssal_whip.png');
  expect(backupOf(monsterImage('Vorkath.png'))).toBe('https://oldschool.runescape.wiki/images/Vorkath.png');
  expect(backupOf(wikiImage('Overload (+)(4)'))).toBe('https://oldschool.runescape.wiki/images/Overload_(%2B)(4).png');
  // Icons the site doesn't keep already load from the Wiki, so have nothing to fall back to.
  expect(backupOf(wikiImage('Not a real icon'))).toBeNull();
});
