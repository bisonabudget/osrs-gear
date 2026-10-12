// Whether a player's levels let them wear an item.
import type { Skills } from './worker/protocol';

/** The levels an item needs before it can be worn, by skill. "combat" is the combat level. */
export type Needs = Partial<Record<keyof Skills | 'combat', number>>;

/** The combat level the game works out from the combat skills. */
export const combatLevel = (s: Skills) => {
  const base = (s.def + s.hp + Math.floor(s.prayer / 2)) / 4;
  const melee = 0.325 * (s.atk + s.str);
  const ranged = 0.325 * Math.floor(s.ranged * 1.5);
  const magic = 0.325 * Math.floor(s.magic * 1.5);
  return Math.floor(base + Math.max(melee, ranged, magic));
};

export const meets = (needs: Needs, skills: Skills) => Object.entries(needs).every(([skill, level]) => (
  skill === 'combat' ? combatLevel(skills) : skills[skill as keyof Skills]) >= level!);
