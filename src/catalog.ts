// What the page needs to show items and monsters, without the engine's data.
import itemRows from './data/items.json';
import monsterRows from './data/monsters.json';
import { CUSTOM_ATTRIBUTES, CUSTOM_KEY, CUSTOM_NAME } from './custom';
import type { CustomMonster, Defence, Element, Slot } from './worker/protocol';

export interface ItemInfo {
  id: number;
  name: string;
  slot: Slot;
  image: string;
  untradeable: boolean;
}

export const DEFENCES: Defence[] = ['stab', 'slash', 'crush', 'magic', 'light', 'standard', 'heavy'];
export const SKILLS = ['hp', 'atk', 'str', 'def', 'magic', 'ranged'] as const;
export const OFFENCES = ['atk', 'str', 'magic', 'magicStr', 'ranged', 'rangedStr'] as const;
export type Skill = typeof SKILLS[number];
export type Offence = typeof OFFENCES[number];

const record = <K extends string>(keys: readonly K[], values: number[]) =>
  Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Record<K, number>;

export interface MonsterInfo {
  key: string;
  name: string;
  label: string;
  level: number;
  image: string;
  slayer: boolean;
  boss: boolean;
  /** Hitpoints and combat levels. */
  skills: Record<Skill, number>;
  /** Attack and strength bonuses. */
  offence: Record<Offence, number>;
  size: number;
  /** Ticks between attacks. */
  speed: number;
  defence: Record<Defence, number>;
  /** Flat armour, taken off every melee and ranged hit (a negative one adds to them). */
  armour: number;
  attacks: string[];
  weakness: { element: Element, severity: number } | null;
  attributes: string[];
  burn: string | null;
}

interface MonsterRow {
  id: number, version: string, name: string, label: string, level: number, image: string, slayer?: 1, boss?: 1,
  size: number, speed: number, skills: number[], offence: number[], defence: number[], armour?: number,
  attacks?: string[], weakness?: { element: Element, severity: number }, attributes?: string[], burn?: string,
}

export const itemInfo = new Map<number, ItemInfo>(
  (itemRows as { id: number, name: string, slot: Slot, image: string, priceId: number | null }[])
    .map((r) => [r.id, { id: r.id, name: r.name, slot: r.slot, image: r.image, untradeable: r.priceId === null }]),
);

export const monsterList: MonsterInfo[] = (monsterRows as MonsterRow[]).map((r) => ({
  key: `${r.id}:${r.version}`,
  name: r.name,
  label: r.label,
  level: r.level,
  image: r.image,
  slayer: r.slayer === 1,
  boss: r.boss === 1,
  size: r.size,
  speed: r.speed,
  skills: record(SKILLS, r.skills),
  offence: record(OFFENCES, r.offence),
  defence: record(DEFENCES, r.defence),
  armour: r.armour ?? 0,
  attacks: r.attacks ?? [],
  weakness: r.weakness ?? null,
  attributes: r.attributes ?? [],
  burn: r.burn ?? null,
}));

export const monsterInfo = new Map(monsterList.map((m) => [m.key, m]));

export const DEFAULT_MONSTER = monsterList.find((m) => m.name === 'Vorkath')!.key;

/** A Custom monster that starts as a copy of a fight's stats. */
export const copyOf = (m: MonsterInfo): CustomMonster => ({
  from: m.key,
  hp: m.skills.hp,
  def: m.skills.def,
  magic: m.skills.magic,
  defence: { ...m.defence },
  armour: m.armour,
  size: m.size,
  weakness: m.weakness && { ...m.weakness },
  attributes: m.attributes.filter((a) => CUSTOM_ATTRIBUTES.includes(a)),
});

/** How the page shows a Custom monster: the stats set, on the picture of the one it was copied from. */
export const customInfo = (c: CustomMonster): MonsterInfo => {
  const base = monsterInfo.get(c.from) ?? monsterInfo.get(DEFAULT_MONSTER)!;
  return {
    ...base,
    key: CUSTOM_KEY,
    name: CUSTOM_NAME,
    label: '',
    boss: false,
    skills: { ...base.skills, hp: c.hp, def: c.def, magic: c.magic },
    defence: { ...c.defence },
    armour: c.armour,
    size: c.size,
    weakness: c.weakness,
    attributes: c.attributes,
    burn: base.burn,
  };
};

const CDN = 'https://tools.runescape.wiki/osrs-dps/cdn';
const WIKI = 'https://oldschool.runescape.wiki';
const title = (name: string) => encodeURIComponent(name.replace(/ /g, '_'));

export const itemImage = (image: string) => `${CDN}/equipment/${encodeURIComponent(image)}`;
export const monsterImage = (image: string) => `${CDN}/monsters/${encodeURIComponent(image)}`;
export const wikiImage = (name: string) => `${WIKI}/images/${title(name)}.png`;
export const wikiPage = (name: string) => `${WIKI}/w/${title(name)}`;

/** Monsters whose name contains the search, closest matches first. */
export const searchMonsters = (query: string, limit = 40): MonsterInfo[] => {
  const q = query.trim().toLowerCase();
  if (!q) return monsterList.filter((m) => m.boss).sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  const rank = (m: MonsterInfo) => {
    const n = m.name.toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/[\s'-]+/).some((w) => w.startsWith(q))) return 2;
    return n.includes(q) ? 3 : 4;
  };
  return monsterList
    .map((m) => ({ m, r: rank(m) }))
    .filter(({ r }) => r < 4)
    .sort((a, b) => a.r - b.r || Number(b.m.boss) - Number(a.m.boss) || a.m.name.localeCompare(b.m.name) || a.m.level - b.m.level)
    .slice(0, limit)
    .map(({ m }) => m);
};
