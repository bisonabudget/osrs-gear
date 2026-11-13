// Experience an hour from a Setup's DPS, for the monsters whose training rate players care about.
import type { StyleRef } from './worker/protocol';

export type XpSkill = 'Attack' | 'Strength' | 'Defence' | 'Ranged' | 'Magic';

/** Monsters that give less experience than usual for each point of damage. */
const DAMAGE_XP_RATE: Record<string, number> = {
  // Gemstone crabs give 87.5% of the usual experience: 3.5 a point of damage instead of 4.
  'Gemstone Crab': 0.875,
};

/** Whether the page shows an XP rate for this monster. */
export const showsXp = (monsterName: string) => monsterName in DAMAGE_XP_RATE;

/** Experience for each point of damage in each skill, before the monster's own rate. */
const perDamage = ({ type, stance }: StyleRef): Partial<Record<XpSkill, number>> => {
  if (type === 'ranged') {
    return stance === 'Longrange' ? { Ranged: 2, Defence: 2 } : { Ranged: 4 };
  }
  if (type === 'magic') {
    return stance === 'Defensive Autocast' ? { Magic: 1.33, Defence: 1 } : { Magic: 2 };
  }
  switch (stance) {
    case 'Accurate': return { Attack: 4 };
    case 'Defensive': return { Defence: 4 };
    case 'Controlled': return { Attack: 4 / 3, Strength: 4 / 3, Defence: 4 / 3 };
    default: return { Strength: 4 };
  }
};

export interface XpRate {
  /** The skill the attacks train, and the experience an hour in it. */
  skill: XpSkill;
  xp: number;
}

/** Experience an hour of attacking non-stop in the skill being trained, or null when this monster has no rate. */
export const xpPerHour = (monsterName: string, style: StyleRef, dps: number): XpRate | null => {
  const rate = DAMAGE_XP_RATE[monsterName];
  if (rate === undefined) return null;
  // Controlled shares its experience between three skills, so it shows the first.
  const [skill, each] = Object.entries(perDamage(style))[0] as [XpSkill, number];
  return { skill, xp: dps * 3600 * rate * each };
};
