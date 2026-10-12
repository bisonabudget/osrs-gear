// What a Setup uses up as it attacks: ammo, spell runes, and the charges of weapons, quivers,
// tomes and the serpentine helm. Rates are from each item's OSRS Wiki page.
import { EquipmentCategory } from '@/enums/EquipmentCategory';
import { ammoApplicability, AmmoApplicability } from '@/lib/Equipment';
import { BLOWPIPE_IDS } from '@/lib/constants';
import { EquipmentPiece } from '@/types/Player';
import { Spell } from '@/types/Spell';
import { itemById, Slot, SLOTS } from '../engine/data';
import type { SetupInput } from '../engine/evaluate';
import { Rune, RUNES, SPELLS } from './spellbook';
import { ammoSaved } from './specials';

export type UseKind = 'ammo' | 'runes' | 'charges';

/** Something a Setup uses up in an hour of attacking. */
export interface Use {
  /** The GE item, or null for coins. */
  id: number | null;
  name: string;
  perHour: number;
  /** What that many cost. */
  gp: number;
  kind: UseKind;
}

/** The price of one of something used up, by its GE id. */
export type PriceOf = (id: number) => number;

const SCALES = 12934;
const ETHER = 21820;
const SPLINTERS = 28924;
const DEMON_TEAR = 31111;
const VIAL_OF_BLOOD = 22446;
const WHIP = 4151;
const SARADOMIN_SWORD = 11838;
const CHARGED_QUIVER = 28951;

const NAMES: Record<number, string> = {
  [SCALES]: "Zulrah's scales",
  [ETHER]: 'Revenant ether',
  [SPLINTERS]: 'Sunfire splinters',
  [DEMON_TEAR]: 'Demon tear',
  [VIAL_OF_BLOOD]: 'Vial of blood',
  [WHIP]: 'Abyssal whip',
  [SARADOMIN_SWORD]: 'Saradomin sword',
  20718: 'Burnt page',
  28931: 'Searing page',
  25578: 'Soaked page',
  30068: 'Soiled page',
};

const RUNE_NAMES = new Map<number, string>(Object.entries(RUNES).map(([rune, id]) => [id, `${rune[0].toUpperCase()}${rune.slice(1)} rune`]));

const nameOf = (id: number | null): string => (id === null
  ? 'Coins'
  : RUNE_NAMES.get(id) ?? NAMES[id] ?? itemById.get(id)?.piece.name ?? `Item ${id}`);

type Amounts = [id: number | null, each: number][];
const runes = (amounts: Partial<Record<Rune, number>>): Amounts => Object.entries(amounts).map(([rune, n]) => [RUNES[rune as Rune], n]);

// What each attack uses, by weapon. Powered staves are charged with runes or other items, and the
// tentacle and blessed sword wear out after 10,000 attacks, using up a whip or a Saradomin sword.
// Coins (a null id) pay for the Trident of the Seas.
const CHARGES: Record<string, Amounts> = {
  'Trident of the Seas': [...runes({ death: 1, chaos: 1, fire: 5 }), [null, 10]],
  'Trident of the Seas (e)': [...runes({ death: 1, chaos: 1, fire: 5 }), [null, 10]],
  'Trident of the Swamp': [...runes({ death: 1, chaos: 1, fire: 5 }), [SCALES, 1]],
  'Trident of the Swamp (e)': [...runes({ death: 1, chaos: 1, fire: 5 }), [SCALES, 1]],
  'Sanguinesti staff': runes({ blood: 2 }),
  "Tumeken's shadow": runes({ soul: 2, chaos: 5 }),
  "Thammaron's sceptre": [[ETHER, 1]],
  'Accursed sceptre': [[ETHER, 1]],
  'Warped sceptre': runes({ chaos: 2, earth: 5 }),
  'Bone staff': runes({ chaos: 1 }),
  "Craw's bow": [[ETHER, 1]],
  'Webweaver bow': [[ETHER, 1]],
  'Toxic blowpipe': [[SCALES, 2 / 3]],
  'Tonalztics of Ralos': [[SPLINTERS, 1]],
  'Scythe of Vitur': [...runes({ blood: 2 }), [VIAL_OF_BLOOD, 0.01]],
  'Abyssal tentacle': [[WHIP, 1 / 10_000]],
  "Saradomin's blessed sword": [[SARADOMIN_SWORD, 1 / 10_000]],
};

// The Eye of Ayak is charged with demon tears or with runes, so the cheaper is used.
const AYAK: Amounts[] = [[[DEMON_TEAR, 1]], runes({ death: 2, chaos: 1 })];

// Items that use charges for every hour in combat, however often they attack.
const UPKEEP: Record<number, [id: number, perHour: number]> = {
  12904: [SCALES, 600], // Toxic staff of the dead
  12931: [SCALES, 11_000 / 16.5], // Serpentine helm
};

// A tome with charges gives its rune for every spell, and each standard spell of its element uses
// a charge, a twentieth of a page. The tome of fire takes burnt or searing pages.
const TOMES: Record<string, { rune: Rune, pages: number[] }> = {
  'tome of fire': { rune: 'fire', pages: [20718, 28931] },
  'tome of water': { rune: 'water', pages: [25578] },
  'tome of earth': { rune: 'earth', pages: [30068] },
};

// Elemental staves give one rune, or two for a combination staff.
const STAFF_RUNES: Record<string, Rune[]> = {
  air: ['air'],
  water: ['water'],
  earth: ['earth'],
  fire: ['fire'],
  lava: ['earth', 'fire'],
  mud: ['water', 'earth'],
  steam: ['water', 'fire'],
  smoke: ['air', 'fire'],
  mist: ['air', 'water'],
  dust: ['air', 'earth'],
};
const STAFF = /^(?:staff of (\w+)|(\w+) battlestaff|mystic (\w+) staff)$/;

/** Runes a weapon or tome gives for every spell, so none are used. */
const runesFrom = (piece: EquipmentPiece | null): Rune[] => {
  if (!piece) return [];
  const name = piece.name.toLowerCase();
  if (name === 'kodai wand') return ['water'];
  if (name === 'twinflame staff') return ['fire', 'water'];
  if (TOMES[name]) return [TOMES[name].rune];
  const m = STAFF.exec(name);
  return (m && STAFF_RUNES[m[1] ?? m[2] ?? m[3]]) || [];
};

// The chance a weapon casts a spell without using its runes.
const RUNE_SAVING: Record<string, number> = {
  'kodai wand': 0.15,
  'staff of the dead': 1 / 7,
  'toxic staff of the dead': 1 / 7,
};

/** Whether a weapon is thrown away as it attacks, like darts, knives and chinchompas. */
export const usedUp = (weapon: EquipmentPiece): boolean => (
  (weapon.category === EquipmentCategory.THROWN || weapon.category === EquipmentCategory.CHINCHOMPA)
  && !BLOWPIPE_IDS.includes(weapon.id)
  && weapon.name !== 'Tonalztics of Ralos'
);

/** Whether the ammo worn is used up as the weapon attacks. A salamander burns tar in every style. */
const firesAmmo = (weapon: EquipmentPiece, ammo: EquipmentPiece | null): boolean => (
  !!ammo && ammoApplicability(weapon.id, ammo.id) === AmmoApplicability.INCLUDED
);

/** The slot whose item is used up as the setup attacks, so it is paid for by the hour. */
export const ammoSlotOf = ({ equipment: { weapon, ammo } }: SetupInput): Slot | null => {
  if (!weapon) return null;
  if (usedUp(weapon)) return 'weapon';
  return firesAmmo(weapon, ammo) ? 'ammo' : null;
};

/** Whether an Ava's device or quiver saves some of what the setup uses up. */
export const savesAmmo = ({ equipment: { weapon, ammo } }: SetupInput): boolean => {
  if (!weapon) return false;
  if (BLOWPIPE_IDS.includes(weapon.id)) return true;
  if (usedUp(weapon)) return weapon.category === EquipmentCategory.THROWN;
  return firesAmmo(weapon, ammo) && weapon.category !== EquipmentCategory.SALAMANDER;
};

/** Whether a tome in the shield slot would give runes this spell uses that the weapon doesn't. */
export const tomeHelps = (tome: EquipmentPiece, weapon: EquipmentPiece, spell: Spell): boolean => {
  const rune = TOMES[tome.name.toLowerCase()]?.rune;
  return !!rune && !!SPELLS[spell.name]?.runes[rune] && !runesFrom(weapon).includes(rune);
};

const cheapest = (choices: Amounts[], priceOf: PriceOf): Amounts => {
  const cost = (a: Amounts) => a.reduce((sum, [id, each]) => sum + each * (id === null ? 1 : priceOf(id)), 0);
  return choices.reduce((best, a) => (cost(a) < cost(best) ? a : best));
};

/** What a setup uses up for its attacks over an hour, at the given attacks an hour. */
export const attackUses = ({ equipment, style, spell }: SetupInput, attacks: number, priceOf: PriceOf): Use[] => {
  const { weapon, ammo, cape, shield } = equipment;
  if (!weapon) return [];
  const out: Use[] = [];
  const add = (id: number | null, each: number, kind: UseKind) => {
    if (each <= 0) return;
    const perHour = each * attacks;
    out.push({ id, name: nameOf(id), perHour, gp: perHour * (id === null ? 1 : priceOf(id)), kind });
  };
  const saved = ammoSaved(cape?.name);

  if (spell && style.type === 'magic') {
    const free = [...runesFrom(weapon), ...runesFrom(shield)];
    const keep = 1 - (RUNE_SAVING[weapon.name.toLowerCase()] ?? 0);
    for (const [rune, n] of Object.entries(SPELLS[spell.name]?.runes ?? {}) as [Rune, number][]) {
      if (!free.includes(rune)) add(RUNES[rune], n * keep, 'runes');
    }
    const tome = shield && TOMES[shield.name.toLowerCase()];
    if (tome && spell.spellbook === 'standard' && spell.element === tome.rune) {
      add(tome.pages.reduce((a, b) => (priceOf(b) < priceOf(a) ? b : a)), 1 / 20, 'charges');
    }
  }

  const charges = weapon.name === 'Eye of Ayak' ? cheapest(AYAK, priceOf) : CHARGES[weapon.name] ?? [];
  for (const [id, each] of charges) add(id, each, 'charges');

  if (BLOWPIPE_IDS.includes(weapon.id)) {
    const dart = weapon.itemVars?.blowpipeDartId;
    if (dart) add(dart, 1 - saved, 'ammo');
  } else if (usedUp(weapon)) {
    add(weapon.id, weapon.category === EquipmentCategory.THROWN ? 1 - saved : 1, 'ammo');
  } else if (ammo && firesAmmo(weapon, ammo)) {
    if (weapon.category === EquipmentCategory.SALAMANDER) {
      add(ammo.id, 1, 'ammo');
    } else {
      const shots = weapon.name === 'Dark bow' ? 2 : 1;
      add(ammo.id, shots * (1 - saved), 'ammo');
      // A charged quiver uses a charge on a third of the arrows and bolts it fires.
      const arrows = weapon.category === EquipmentCategory.BOW || weapon.category === EquipmentCategory.CROSSBOW;
      if (cape?.id === CHARGED_QUIVER && arrows) add(SPLINTERS, shots / 3, 'charges');
    }
  }
  return out;
};

/** What an item worn uses up in an hour, however often the setup attacks. */
export const upkeepOf = (piece: EquipmentPiece | null, priceOf: PriceOf): Use[] => {
  const found = piece ? UPKEEP[piece.id] : undefined;
  if (!found) return [];
  const [id, perHour] = found;
  return [{ id, name: nameOf(id), perHour, gp: perHour * priceOf(id), kind: 'charges' }];
};

/** Everything a setup uses up in an hour of attacking, with the same thing from two items added together. */
export const usesOf = (input: SetupInput, attacks: number, priceOf: PriceOf): Use[] => {
  const merged = new Map<string, Use>();
  for (const use of [...attackUses(input, attacks, priceOf), ...SLOTS.flatMap((s) => upkeepOf(input.equipment[s], priceOf))]) {
    const key = `${use.kind}|${use.id ?? use.name}`;
    const seen = merged.get(key);
    merged.set(key, seen ? { ...seen, perHour: seen.perHour + use.perHour, gp: seen.gp + use.gp } : use);
  }
  return [...merged.values()];
};
