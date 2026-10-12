// Items the engine treats specially only when worn together, so the search tries each group as
// a whole. Taken from the engine's set checks (BaseCalc.ts) and its crystal, obsidian and void
// effects (PlayerVsNPCCalc.ts). Items with an effect of their own are found by testing them.
export interface SpecialSet {
  /** Every item except the weapon. */
  pieces: string[];
  /** The set only does anything with one of these weapons. */
  weapons?: string[];
}

const TZHAAR = ['Tzhaar-ket-em', 'Tzhaar-ket-om', 'Toktz-xil-ak', 'Toktz-xil-ek', 'Toktz-mej-tal'];
const OBSIDIAN = ['Obsidian helmet', 'Obsidian platebody', 'Obsidian platelegs'];
const CRYSTAL = ['Crystal helm', 'Crystal body', 'Crystal legs'];
const VOID = ['Void knight top', 'Void knight robe', 'Void knight gloves'];
const ELITE_VOID = ['Elite void top', 'Elite void robe', 'Void knight gloves'];

export const SETS: SpecialSet[] = [
  { pieces: ['Void melee helm', ...VOID] },
  { pieces: ['Void ranger helm', ...VOID] },
  { pieces: ['Void ranger helm', ...ELITE_VOID] },
  { pieces: ['Void mage helm', ...VOID] },
  { pieces: ['Void mage helm', ...ELITE_VOID] },
  { pieces: OBSIDIAN, weapons: TZHAAR },
  { pieces: [...OBSIDIAN, 'Berserker necklace'], weapons: TZHAAR },
  { pieces: ['Berserker necklace'], weapons: TZHAAR },
  { pieces: CRYSTAL, weapons: ['Crystal bow', 'Bow of Faerdhinen'] },
  { pieces: ["Inquisitor's great helm", "Inquisitor's hauberk", "Inquisitor's plateskirt"] },
  { pieces: ['Virtus mask', 'Virtus robe top', 'Virtus robe bottom'] },
  { pieces: ["Dharok's helm", "Dharok's platebody", "Dharok's platelegs"], weapons: ["Dharok's greataxe"] },
  { pieces: ["Verac's helm", "Verac's brassard", "Verac's plateskirt"], weapons: ["Verac's flail"] },
  { pieces: ["Torag's helm", "Torag's platebody", "Torag's platelegs", 'Amulet of the Damned'], weapons: ["Torag's hammers"] },
  { pieces: ["Ahrim's hood", "Ahrim's robetop", "Ahrim's robeskirt", 'Amulet of the Damned'], weapons: ["Ahrim's staff"] },
  { pieces: ['Blood moon helm', 'Blood moon chestplate', 'Blood moon tassets'], weapons: ['Dual macuahuitl'] },
];

export const setFitsWeapon = (set: SpecialSet, weaponName: string) => (
  !set.weapons || set.weapons.some((w) => weaponName === w || weaponName.startsWith(`${w} `))
);

/** Share of ammo an Ava's device or quiver in the cape slot saves. */
export const ammoSaved = (capeName: string | undefined): number => {
  if (!capeName) return 0;
  if (/assembler|Dizana's/i.test(capeName)) return 0.8;
  if (/accumulator|^Ranging cape/i.test(capeName)) return 0.72;
  if (/attractor/i.test(capeName)) return 0.6;
  return 0;
};
