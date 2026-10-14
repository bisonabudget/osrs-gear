// Every picture the site shows is kept in public/img. After a data rebuild, run
// scripts/fetch-images.ts to copy any new ones.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import items from '../src/data/items.json';
import monsters from '../src/data/monsters.json';
import wikiIcons from '../src/data/wiki-images.json';
import { itemImage, monsterImage, wikiImage } from '../src/catalog';

const IMG = join(import.meta.dirname, '../public/img');

test('every item and monster picture is on the site', () => {
  const missing = [
    ...items.map((i) => join('equipment', i.image)),
    ...monsters.flatMap((m) => (m.image ? [join('monsters', m.image)] : [])),
  ].filter((p) => !existsSync(join(IMG, p)));
  expect(missing).toEqual([]);
});

test('every icon the site shows is on the site, so none load from the Wiki', () => {
  // The icons named in the code, plus each saved icon's file.
  const src = join(import.meta.dirname, '../src');
  const code = readdirSync(src, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => readFileSync(join(src, f), 'utf8'))
    .join('\n');
  const named = [...code.matchAll(/wikiImage\('([^']+)'\)|icon: '([^']+)'/g)].map((m) => m[1] ?? m[2]);
  const missing = [...new Set([...named, ...wikiIcons])]
    .filter((name) => !existsSync(join(IMG, '..', decodeURIComponent(wikiImage(name)))));
  expect(missing).toEqual([]);
});

test('pictures load only from the site', () => {
  for (const src of [itemImage('Abyssal whip.png'), monsterImage('Vorkath.png'), wikiImage('Overload (+)(4)'), wikiImage('Not a real icon')]) {
    expect(src).toMatch(/^img\//);
  }
});
