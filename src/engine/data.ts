// The items and monsters the site works with: the Wiki calculator's data, cut down by
// scripts/build-data.ts to one entry per item and one per fight.
import { availableEquipment } from '@/lib/Equipment';
import { getMonsters, INITIAL_MONSTER_INPUTS } from '@/lib/Monsters';
import { MONSTER_PHASES_BY_ID } from '@/lib/constants';
import { EquipmentPiece, PlayerEquipment } from '@/types/Player';
import { Monster } from '@/types/Monster';
import { MonsterAttribute } from '@/enums/MonsterAttribute';
import { CUSTOM_NAME } from '../custom';
import type { CustomMonster } from '../worker/protocol';
import type { Needs } from '../requirements';
import itemRows from '../data/items.json';
import monsterRows from '../data/fights.json';

export type Slot = keyof PlayerEquipment;
export const SLOTS: Slot[] = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];

export const emptyEquipment = (): PlayerEquipment => ({
  head: null, cape: null, neck: null, ammo: null, weapon: null, body: null, shield: null, legs: null, hands: null, feet: null, ring: null,
});

/** One way to get an Untradeable: the GE items (id and quantity) and coins it takes. */
export interface Way {
  parts: [number, number][];
  coins: number;
  /** It also needs something earned in game, which is free. */
  earned: boolean;
  /** What goes into it, or the shop selling it. */
  text: string;
}

export interface Item {
  piece: EquipmentPiece;
  /** The GE item whose Price this item costs, or null for an Untradeable. */
  priceId: number | null;
  /** The ways to get an Untradeable. One that is only earned in game has a single free way. */
  ways: Way[];
  /** The engine does more with this item than add up its stats. */
  special: boolean;
  /** The levels it needs before it can be worn. */
  needs: Needs;
}

export interface MonsterEntry {
  key: string;
  name: string;
  /** Tells apart two fights with the same name, or '' when there is only one. */
  label: string;
  level: number;
  image: string;
  slayer: boolean;
  boss: boolean;
  monster: Monster;
}

const pieces = new Map(availableEquipment.map((e) => [e.id, e]));

const EARNED: Way = { parts: [], coins: 0, earned: true, text: '' };

export const items: Item[] = (itemRows as {
  id: number, priceId: number | null, special?: 1, needs?: Needs,
  ways?: { parts?: [number, number][], coins?: number, earned?: 1, text: string }[],
}[]).map((row) => ({
  piece: pieces.get(row.id)!,
  priceId: row.priceId,
  ways: row.priceId !== null ? []
    : row.ways?.map((w) => ({ parts: w.parts ?? [], coins: w.coins ?? 0, earned: w.earned === 1, text: w.text })) ?? [EARNED],
  special: row.special === 1,
  needs: row.needs ?? {},
}));

export const itemById = new Map(items.map((i) => [i.piece.id, i]));

// The engine lists Jhallan twice under one id and version, the second time as a 1-hitpoint form
// the site leaves out, so only fights with more than 1 hitpoint are looked up.
const engineMonsters = new Map(getMonsters().filter((m) => m.skills.hp > 1).map((m) => [`${m.id}:${m.version}`, m]));

// A fight with phases starts in the first, as the Wiki calculator picks. Yama's third phase gets
// none: the engine means to leave it alone but would set its magic defence to 60, and the Wiki
// gives 81 (60 raised by 35% like its other defences).
const phaseOf = (m: Omit<Monster, 'inputs'>): string | undefined => (m.name === 'Yama' && m.version === 'Phase 3'
  ? undefined
  : MONSTER_PHASES_BY_ID[m.id]?.[0]);

export const monsters: MonsterEntry[] = (monsterRows as {
  id: number, version: string, name: string, label: string, level: number, image: string, slayer?: 1, boss?: 1,
}[]).map((row) => {
  const key = `${row.id}:${row.version}`;
  const base = engineMonsters.get(key)!;
  return {
    key,
    name: row.name,
    label: row.label,
    level: row.level,
    image: row.image,
    slayer: row.slayer === 1,
    boss: row.boss === 1,
    monster: { ...base, inputs: { ...INITIAL_MONSTER_INPUTS, monsterCurrentHp: base.skills.hp, phase: phaseOf(base) } },
  };
});

export const monsterByKey = new Map(monsters.map((m) => [m.key, m]));

/**
 * The engine's monster for a Custom monster. It gets an id and name no fight has, so the engine
 * applies none of the copied fight's scaling or mechanics, and no Xerician scaling either.
 */
export const customMonster = (c: CustomMonster): Monster => {
  const base = monsterByKey.get(c.from)?.monster;
  if (!base) throw new Error(`Unknown monster ${c.from}`);
  return {
    ...base,
    id: -1,
    name: CUSTOM_NAME,
    version: '',
    size: c.size,
    skills: { ...base.skills, hp: c.hp, def: c.def, magic: c.magic },
    defensive: { ...c.defence, flat_armour: c.armour },
    weakness: c.weakness,
    attributes: c.attributes.filter((a) => a !== MonsterAttribute.XERICIAN) as MonsterAttribute[],
    inputs: { ...INITIAL_MONSTER_INPUTS, monsterCurrentHp: c.hp },
  };
};
