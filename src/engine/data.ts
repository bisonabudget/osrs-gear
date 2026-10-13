// The items the site works with and how it reads monsters: the Wiki calculator's data, cut down
// by scripts/build-data.ts to one entry per item and one per fight. The full list of monsters is
// in ./monsters.ts; the search loads only the one being fought.
import { availableEquipment } from '@/lib/Equipment';
import { INITIAL_MONSTER_INPUTS } from '@/lib/Monsters';
import { MONSTER_PHASES_BY_ID } from '@/lib/constants';
import { EquipmentPiece, PlayerEquipment } from '@/types/Player';
import { BurnImmunity, Monster } from '@/types/Monster';
import { MonsterAttribute } from '@/enums/MonsterAttribute';
import { isCombatStyleType } from '@/types/PlayerCombatStyle';
import { CUSTOM_NAME } from '../custom';
import type { CustomMonster } from '../worker/protocol';
import type { Needs } from '../requirements';
import itemRows from '../data/items.json';

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

/** A monster as the engine's list stores it. */
export interface MonsterRow {
  id: number;
  name: string;
  version: string;
  image: string;
  size: number;
  speed: number;
  style: string[] | null;
  max_hit: string | number;
  skills: Monster['skills'];
  offensive: Monster['offensive'];
  defensive: Monster['defensive'];
  attributes: string[];
  weakness: unknown;
  immunities: { burn: string | null };
  is_slayer_monster: boolean;
}

/** The engine's getMonsters() for one monster. tests/data.test.ts checks they agree. */
export const fromRow = (m: MonsterRow): Omit<Monster, 'inputs'> => {
  const maxHit = parseInt(m.max_hit.toString());
  const styleStr = m.style?.join(',').toLowerCase() || null;
  return {
    id: m.id,
    name: m.name,
    version: m.version,
    image: m.image,
    size: m.size,
    speed: m.speed,
    style: isCombatStyleType(styleStr) ? styleStr : null,
    maxHit: Number.isNaN(maxHit) ? 0 : maxHit,
    skills: m.skills,
    offensive: m.offensive,
    defensive: m.defensive,
    attributes: m.attributes as MonsterAttribute[],
    weakness: <Monster['weakness']>m.weakness || null,
    immunities: {
      burn: m.immunities.burn as BurnImmunity | null,
    },
    is_slayer_monster: m.is_slayer_monster || false,
  };
};

// A fight with phases starts in the first, as the Wiki calculator picks. Yama's third phase gets
// none: the engine means to leave it alone but would set its magic defence to 60, and the Wiki
// gives 81 (60 raised by 35% like its other defences).
const phaseOf = (m: Omit<Monster, 'inputs'>): string | undefined => (m.name === 'Yama' && m.version === 'Phase 3'
  ? undefined
  : MONSTER_PHASES_BY_ID[m.id]?.[0]);

/** The engine's monster at the start of a fight, at full hitpoints. */
export const inFight = (base: Omit<Monster, 'inputs'>): Monster => ({
  ...base, inputs: { ...INITIAL_MONSTER_INPUTS, monsterCurrentHp: base.skills.hp, phase: phaseOf(base) },
});

/**
 * The engine's monster for a Custom monster, from the fight it copies. It gets an id and name no fight has, so the engine
 * applies none of the copied fight's scaling or mechanics, and no Xerician scaling either.
 */
export const customMonster = (c: CustomMonster, base: Monster): Monster => ({
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
});
