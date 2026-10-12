// Gives the engine's monster the Defence drains picked on the page. The DPS calculator applies its
// own list of drains when it scales the monster. A bone dagger isn't on it, so its drain is taken
// off the monster's Defence first, down to the same floor the calculator stops at.
import { getDefenceFloor } from '@/lib/scaling/DefenceReduction';
import type { Monster } from '@/types/Monster';
import type { Drains } from '../drains';

export const withDrains = (m: Monster, d: Drains): Monster => {
  const { boneDagger, spell, ...counts } = d;
  const def = boneDagger > 0 ? Math.max(Math.min(getDefenceFloor(m), m.skills.def), m.skills.def - boneDagger) : m.skills.def;
  return {
    ...m,
    skills: { ...m.skills, def },
    inputs: {
      ...m.inputs,
      defenceReductions: {
        ...m.inputs.defenceReductions,
        ...counts,
        vulnerability: spell === 'vulnerability',
        accursed: spell === 'accursed',
      },
    },
  };
};
