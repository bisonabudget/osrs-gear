// Spell levels and runes, and which weapons can autocast each spell, from the OSRS Wiki's
// spellbook pages, its Autocast page and each weapon's page. The engine only checks the weapon for
// a few god and special spells, and misses some of those through spelling, so every spell is
// checked here.
import type { Spell } from '@/types/Spell';

/** Grand Exchange ids of the runes spells and charges use. */
export const RUNES = {
  air: 556,
  water: 555,
  earth: 557,
  fire: 554,
  mind: 558,
  body: 559,
  chaos: 562,
  death: 560,
  blood: 565,
  soul: 566,
  nature: 561,
  law: 563,
  wrath: 21880,
} as const;

export type Rune = keyof typeof RUNES;

interface SpellInfo {
  level: number;
  runes: Partial<Record<Rune, number>>;
}

// Every spell the engine knows. God spells can be cast from 60 Magic.
export const SPELLS: Record<string, SpellInfo> = {
  // Standard
  'Wind Strike': { level: 1, runes: { air: 1, mind: 1 } },
  'Water Strike': { level: 5, runes: { air: 1, water: 1, mind: 1 } },
  'Earth Strike': { level: 9, runes: { air: 1, earth: 2, mind: 1 } },
  'Fire Strike': { level: 13, runes: { air: 2, fire: 3, mind: 1 } },
  'Wind Bolt': { level: 17, runes: { air: 2, chaos: 1 } },
  'Water Bolt': { level: 23, runes: { air: 2, water: 2, chaos: 1 } },
  'Earth Bolt': { level: 29, runes: { air: 2, earth: 3, chaos: 1 } },
  'Fire Bolt': { level: 35, runes: { air: 3, fire: 4, chaos: 1 } },
  'Crumble Undead': { level: 39, runes: { air: 2, earth: 2, chaos: 1 } },
  'Wind Blast': { level: 41, runes: { air: 3, death: 1 } },
  'Water Blast': { level: 47, runes: { air: 3, water: 3, death: 1 } },
  'Iban Blast': { level: 50, runes: { fire: 5, death: 1 } },
  'Magic Dart': { level: 50, runes: { mind: 4, death: 1 } },
  'Earth Blast': { level: 53, runes: { air: 3, earth: 4, death: 1 } },
  'Fire Blast': { level: 59, runes: { air: 4, fire: 5, death: 1 } },
  'Saradomin Strike': { level: 60, runes: { air: 4, fire: 2, blood: 2 } },
  'Claws of Guthix': { level: 60, runes: { air: 4, fire: 1, blood: 2 } },
  'Flames of Zamorak': { level: 60, runes: { air: 1, fire: 4, blood: 2 } },
  'Wind Wave': { level: 62, runes: { air: 5, blood: 1 } },
  'Water Wave': { level: 65, runes: { air: 5, water: 7, blood: 1 } },
  'Earth Wave': { level: 70, runes: { air: 5, earth: 7, blood: 1 } },
  'Fire Wave': { level: 75, runes: { air: 5, fire: 7, blood: 1 } },
  'Wind Surge': { level: 81, runes: { air: 7, wrath: 1 } },
  'Water Surge': { level: 85, runes: { air: 7, water: 10, wrath: 1 } },
  'Earth Surge': { level: 90, runes: { air: 7, earth: 10, wrath: 1 } },
  'Fire Surge': { level: 95, runes: { air: 7, fire: 10, wrath: 1 } },
  Confuse: { level: 3, runes: { water: 3, earth: 2, body: 1 } },
  Weaken: { level: 11, runes: { water: 3, earth: 2, body: 1 } },
  Curse: { level: 19, runes: { water: 2, earth: 3, body: 1 } },
  Bind: { level: 20, runes: { water: 3, earth: 3, nature: 2 } },
  Snare: { level: 50, runes: { water: 4, earth: 4, nature: 3 } },
  Vulnerability: { level: 66, runes: { water: 5, earth: 5, soul: 1 } },
  Enfeeble: { level: 73, runes: { water: 8, earth: 8, soul: 1 } },
  Entangle: { level: 79, runes: { water: 5, earth: 5, nature: 4 } },
  Stun: { level: 80, runes: { water: 12, earth: 12, soul: 1 } },
  'Tele Block': { level: 85, runes: { chaos: 1, death: 1, law: 1 } },
  // Ancient Magicks
  'Smoke Rush': { level: 50, runes: { air: 1, fire: 1, chaos: 2, death: 2 } },
  'Shadow Rush': { level: 52, runes: { air: 1, chaos: 2, death: 2, soul: 1 } },
  'Blood Rush': { level: 56, runes: { chaos: 2, death: 2, blood: 1 } },
  'Ice Rush': { level: 58, runes: { water: 2, chaos: 2, death: 2 } },
  'Smoke Burst': { level: 62, runes: { air: 2, fire: 2, chaos: 4, death: 2 } },
  'Shadow Burst': { level: 64, runes: { air: 1, chaos: 4, death: 2, soul: 2 } },
  'Blood Burst': { level: 68, runes: { chaos: 4, death: 2, blood: 2 } },
  'Ice Burst': { level: 70, runes: { water: 4, chaos: 4, death: 2 } },
  'Smoke Blitz': { level: 74, runes: { air: 2, fire: 2, death: 2, blood: 2 } },
  'Shadow Blitz': { level: 76, runes: { air: 2, death: 2, blood: 2, soul: 2 } },
  'Blood Blitz': { level: 80, runes: { death: 2, blood: 4 } },
  'Ice Blitz': { level: 82, runes: { water: 3, death: 2, blood: 2 } },
  'Smoke Barrage': { level: 86, runes: { air: 4, fire: 4, death: 4, blood: 2 } },
  'Shadow Barrage': { level: 88, runes: { air: 4, death: 4, blood: 2, soul: 3 } },
  'Blood Barrage': { level: 92, runes: { death: 4, blood: 4, soul: 1 } },
  'Ice Barrage': { level: 94, runes: { water: 6, death: 4, blood: 2 } },
  // Arceuus
  'Ghostly Grasp': { level: 35, runes: { air: 4, chaos: 1 } },
  'Inferior Demonbane': { level: 44, runes: { fire: 3, chaos: 1 } },
  'Dark Lure': { level: 50, runes: { death: 1, nature: 1 } },
  'Skeletal Grasp': { level: 56, runes: { earth: 8, death: 1 } },
  'Superior Demonbane': { level: 62, runes: { fire: 5, soul: 1 } },
  'Lesser Corruption': { level: 64, runes: { death: 1, soul: 2 } },
  'Undead Grasp': { level: 79, runes: { fire: 12, blood: 1 } },
  'Dark Demonbane': { level: 82, runes: { fire: 7, soul: 2 } },
  'Greater Corruption': { level: 85, runes: { blood: 1, soul: 3 } },
};

/** The Magic level a spell needs, or Infinity for one this table doesn't know. */
export const spellLevel = (name: string): number => SPELLS[name]?.level ?? Infinity;

// Every staff, wand and crozier autocasts the standard elemental spells (strikes, bolts, blasts,
// waves and surges). These standard spells need one of the weapons listed.
const ONLY_WITH: Record<string, string[]> = {
  'Crumble Undead': ["slayer's staff", "slayer's staff (e)", 'skull sceptre (i)', 'void knight mace', 'staff of the dead', 'toxic staff of the dead', 'staff of light', 'staff of balance'],
  'Magic Dart': ["slayer's staff", "slayer's staff (e)", 'staff of the dead', 'toxic staff of the dead', 'staff of light', 'staff of balance'],
  'Iban Blast': ["iban's staff", "iban's staff (u)"],
  'Saradomin Strike': ['staff of light'],
  'Claws of Guthix': ['staff of balance', 'void knight mace'],
  'Flames of Zamorak': ['staff of the dead', 'toxic staff of the dead', "thammaron's sceptre (a)", 'accursed sceptre (a)'],
};

// Weapons that autocast only waves and surges of the elemental spells.
const WAVES_AND_SURGES = ["slayer's staff", "slayer's staff (e)", 'void knight mace'];

// Ahrim's staff only autocasts Ancient Magicks with the rest of Ahrim's set and the amulet of the
// damned, so it is left out.
const ANCIENT = [
  'ancient staff', 'master wand', 'kodai wand', 'dragon hunter wand', 'blue moon spear', "thammaron's sceptre (a)",
  'accursed sceptre (a)', 'nightmare staff', 'eldritch nightmare staff', 'volatile nightmare staff',
];

const ARCEUUS = [
  "slayer's staff", "slayer's staff (e)", 'skull sceptre (i)', "ahrim's staff", 'blue moon spear', 'staff of the dead',
  'toxic staff of the dead', 'purging staff', 'master wand', 'kodai wand',
];

/** Whether a weapon can autocast a spell. Names are matched whatever their case. */
export const canAutocast = (weaponName: string, spell: Spell): boolean => {
  const weapon = weaponName.toLowerCase();
  if (spell.spellbook === 'ancient') return ANCIENT.includes(weapon) || weapon.endsWith('ancient sceptre');
  if (spell.spellbook === 'arceuus') return ARCEUUS.includes(weapon);
  const only = ONLY_WITH[spell.name];
  if (only) return only.includes(weapon);
  // Curses, binds and teleports can't be autocast.
  if (!spell.element || weapon === 'skull sceptre (i)') return false;
  return !WAVES_AND_SURGES.includes(weapon) || / (Wave|Surge)$/.test(spell.name);
};
