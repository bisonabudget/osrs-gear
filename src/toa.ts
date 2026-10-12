// Tombs of Amascut fights get harder with the raid level: each 5 levels make them 2% harder to hit
// (on everyone but Kephri's overlords) and give them 2% more hitpoints. The four path bosses also
// get more hitpoints for each path level (8% at level 1, then 5% a level up to 6). The raid is
// taken as solo.
import {
  AKKHA_IDS, AKKHA_SHADOW_IDS, BABA_IDS, KEPHRI_OVERLORD_IDS, KEPHRI_SHIELDED_IDS, KEPHRI_UNSHIELDED_IDS,
  TOMBS_OF_AMASCUT_MONSTER_IDS, ZEBAK_IDS,
} from '@/lib/constants';
import applyToaScaling from '@/lib/scaling/TombsOfAmascut';
import type { Monster } from '@/types/Monster';

export const RAID_LEVEL_MAX = 600;
export const PATH_LEVEL_MAX = 6;

export type Path = 'Het' | 'Apmeken' | 'Crondis' | 'Scabaras';

const PATHS: [Path, number[]][] = [
  ['Het', [...AKKHA_IDS, ...AKKHA_SHADOW_IDS]],
  ['Apmeken', BABA_IDS],
  ['Crondis', ZEBAK_IDS],
  ['Scabaras', [...KEPHRI_SHIELDED_IDS, ...KEPHRI_UNSHIELDED_IDS, ...KEPHRI_OVERLORD_IDS]],
];

const idOf = (key: string) => Number(key.split(':')[0]);

/** Whether a monster, by its key, is fought in the Tombs of Amascut. */
export const inToa = (key: string) => TOMBS_OF_AMASCUT_MONSTER_IDS.includes(idOf(key));

/** The path a monster is fought on, by its key, or null for the Wardens and anything outside the raid. */
export const pathOf = (key: string): Path | null => PATHS.find(([, ids]) => ids.includes(idOf(key)))?.[0] ?? null;

/** How a raid is set: its raid level and the path level of the monster's path. */
export interface Raid {
  level: number;
  path: number;
}

const raidInputs = (m: Monster, raid: Raid): Monster['inputs'] => (
  { ...m.inputs, toaInvocationLevel: raid.level, toaPathLevel: raid.path, partySize: 1 });

const scale = (m: Monster, raid: Raid) => applyToaScaling({ ...m, inputs: raidInputs(m, raid) });

/**
 * The engine's monster in a raid. Only its settings change: the DPS calculator scales the monster
 * from them itself, so raising its hitpoints here too would count them twice. It starts on full
 * hitpoints.
 */
export const inRaid = (m: Monster, raid: Raid): Monster => {
  if ((raid.level === 0 && raid.path === 0) || !TOMBS_OF_AMASCUT_MONSTER_IDS.includes(m.id)) return m;
  return { ...m, inputs: { ...raidInputs(m, raid), monsterCurrentHp: scale(m, raid).skills.hp } };
};

/** A ToA monster's hitpoints in a raid, for the page. */
export const raidHp = (key: string, hp: number, raid: Raid) => (inToa(key)
  ? scale({ id: idOf(key), skills: { hp }, inputs: {} } as unknown as Monster, raid).skills.hp
  : hp);
