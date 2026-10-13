// Every picture the site shows is kept in public/img. After a data rebuild, run
// scripts/fetch-images.ts to copy any new ones.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import items from '../src/data/items.json';
import monsters from '../src/data/monsters.json';

const IMG = join(import.meta.dirname, '../public/img');

test('every item and monster picture is on the site', () => {
  const missing = [
    ...items.map((i) => join('equipment', i.image)),
    ...monsters.flatMap((m) => (m.image ? [join('monsters', m.image)] : [])),
  ].filter((p) => !existsSync(join(IMG, p)));
  expect(missing).toEqual([]);
});
