// Copies every picture the site shows into public/img, so visitors load them from the site and
// not from the OSRS Wiki. Item and monster pictures come from the Wiki DPS calculator's GitHub
// repository, with monster pictures shrunk to twice the size they're shown at. The other icons
// (skills, prayers, potions, spells, runes) are downloaded from the Wiki once, slowly.
// src/data/wiki-images.json lists the icons saved, and any others still load from the Wiki.
// Run after scripts/build-data.ts, on a Mac (it uses sips): node scripts/fetch-images.ts
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public/img');
const USER_AGENT = 'osrs-gear (github.com/tristanbowdenfreeman-maker/osrs-gear)';
const COMMIT = readFileSync(join(ROOT, 'vendor/osrs-dps-calc/COMMIT'), 'utf8').trim();
// Monster pictures are shown at 72px at most.
const MONSTER_SIZE = 144;

const read = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;
const items = read<{ image: string }[]>('src/data/items.json');
const monsters = read<{ image: string }[]>('src/data/monsters.json');
const spells = read<{ name: string }[]>('vendor/osrs-dps-calc/cdn/json/spells.json');

// The Wiki icons the site can show. Keep in step with the names passed to wikiImage.
const capital = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
const SKILLS = ['Attack', 'Strength', 'Defence', 'Ranged', 'Magic', 'Prayer', 'Hitpoints', 'Agility', 'Slayer', 'Mining', 'Herblore'];
const SLOTS = ['Head', 'Cape', 'Neck', 'Ammo', 'Weapon', 'Body', 'Shield', 'Legs', 'Hands', 'Feet', 'Ring'];
const RUNES = ['air', 'water', 'earth', 'fire', 'mind', 'body', 'chaos', 'death', 'blood', 'soul', 'nature', 'law', 'wrath', 'sunfire'];
const PRAYERS = [
  'Piety', 'Chivalry', 'Ultimate Strength', 'Superhuman Strength', 'Burst of Strength', 'Incredible Reflexes',
  'Improved Reflexes', 'Clarity of Thought', 'Rigour', 'Deadeye', 'Eagle Eye', 'Hawk Eye', 'Sharp Eye', 'Augury',
  'Mystic Vigour', 'Mystic Might', 'Mystic Lore', 'Mystic Will',
];
const OTHERS = [
  'Coins 10000', 'Damage hitsplat', 'Olmlet', 'Skull (status) icon', 'Stats icon', 'Combat icon', 'Quest list icon',
  'Worn Equipment', 'Steel arrow 5', 'Steel bolts 5', 'Steel dart', 'White dagger', 'White scimitar', 'White warhammer',
  'Super combat potion(4)', 'Ranging potion(4)', 'Saturated heart', 'Magic potion(4)', 'Smelling salts (2)', 'Overload (+)(4)',
  "Zulrah's scales 5", 'Revenant ether 5', 'Sunfire splinters 4', 'Demon tear', 'Vial of blood', 'Burnt page',
  'Searing page', 'Soaked page', 'Soiled page', 'Lit bug lantern', 'Magic Damage icon', 'Ranged Strength icon',
];
// The weapons that drain Defence, shown in the drains picker.
const DRAIN_WEAPONS = [...readFileSync(join(ROOT, 'src/drains.ts'), 'utf8').matchAll(/weapon: '([^']+)'/g)].map((m) => m[1]);
const WIKI_NAMES = [...new Set([
  ...SKILLS.map((s) => `${s} icon`), ...SLOTS.map((s) => `${s} slot`), ...RUNES.map((r) => `${capital(r)} rune`),
  ...PRAYERS, ...spells.map((s) => s.name), ...OTHERS, ...DRAIN_WEAPONS,
])];

// The file name an icon is saved as: the Wiki's own, with spaces as underscores and + spelt out,
// as some servers don't read an encoded + in a path. Matches wikiImage in src/catalog.ts.
const fileOf = (name: string) => `${name.replace(/ /g, '_').replace(/\+/g, 'plus')}.png`;

const fetchRepo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'dps-calc-'));
  const archive = join(dir, 'calc.tgz');
  execFileSync('curl', ['-fsSL', '-o', archive, `https://github.com/weirdgloop/osrs-dps-calc/archive/${COMMIT}.tar.gz`]);
  execFileSync('tar', ['xzf', archive, '-C', dir, '--include=*/cdn/equipment/*', '--include=*/cdn/monsters/*']);
  return join(dir, `osrs-dps-calc-${COMMIT}`, 'cdn');
};

const longestSide = (file: string) => Math.max(...[...execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' })
  .matchAll(/pixel(?:Width|Height): (\d+)/g)].map((m) => Number(m[1])));

const copyAll = (cdn: string) => {
  mkdirSync(join(OUT, 'equipment'), { recursive: true });
  mkdirSync(join(OUT, 'monsters'), { recursive: true });
  for (const image of new Set(items.map((i) => i.image))) {
    copyFileSync(join(cdn, 'equipment', image), join(OUT, 'equipment', image));
  }
  for (const image of new Set(monsters.map((m) => m.image).filter(Boolean))) {
    const from = join(cdn, 'monsters', image);
    const to = join(OUT, 'monsters', image);
    if (longestSide(from) > MONSTER_SIZE) execFileSync('sips', ['-Z', String(MONSTER_SIZE), from, '--out', to], { stdio: 'ignore' });
    else copyFileSync(from, to);
  }
};

const sleep = (ms: number) => new Promise((r) => { setTimeout(r, ms); });

const fetchWikiIcons = async () => {
  mkdirSync(join(OUT, 'wiki'), { recursive: true });
  const saved: string[] = [];
  for (const name of WIKI_NAMES) {
    const to = join(OUT, 'wiki', fileOf(name));
    if (!existsSync(to)) {
      const reply = await fetch(`https://oldschool.runescape.wiki/images/${encodeURIComponent(name.replace(/ /g, '_'))}.png`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      await sleep(300);
      if (!reply.ok) {
        console.log(`No Wiki picture for ${name} (${reply.status})`);
        continue;
      }
      writeFileSync(to, Buffer.from(await reply.arrayBuffer()));
    }
    saved.push(name);
  }
  writeFileSync(join(ROOT, 'src/data/wiki-images.json'), `${JSON.stringify(saved.sort(), null, 1)}\n`);
  console.log(`Saved ${saved.length} of ${WIKI_NAMES.length} Wiki icons`);
};

const cdn = fetchRepo();
copyAll(cdn);
rmSync(join(cdn, '../..'), { recursive: true, force: true });
await fetchWikiIcons();
