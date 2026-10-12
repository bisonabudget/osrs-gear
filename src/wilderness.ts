// Monsters only found in the Wilderness, where Craw's bow, Viggora's chainmace, Thammaron's sceptre
// and their upgrades get their bonus. Monsters also found outside it, like greater demons, start
// with the Wilderness switch off.
const WILDERNESS = /^(Artio|Callisto|Calvar'ion|Chaos Elemental|Chaos Fanatic|Crazy archaeologist|Elder Chaos druid|Lava dragon|Scorpia|Spindel|Venenatis|Vet'ion|Revenant )|Hellhound \((Calvar'ion|Vet'ion)\)$/;

/** Whether a monster is only found in the Wilderness. */
export const inWilderness = (name: string) => WILDERNESS.test(name);
