// Chambers of Xeric monsters in Challenge Mode have 50% more hitpoints and stronger stats, apart
// from a few the DPS calculator knows of (the glowing crystal and Tekton's Defence among them).
// The raid is taken as solo, as in normal mode.
import { MonsterAttribute } from '@/enums/MonsterAttribute';
import applyCoxScaling from '@/lib/scaling/ChambersOfXeric';
import type { Monster } from '@/types/Monster';

/** Whether a monster, by its attributes, is fought in the Chambers of Xeric. */
export const inCox = (attributes: readonly string[]) => attributes.includes(MonsterAttribute.XERICIAN);

/**
 * The engine's monster in Challenge Mode. As with the ToA raid level, only its settings change and
 * the DPS calculator scales it itself. It starts on full hitpoints.
 */
export const inChallengeMode = (m: Monster, cm: boolean): Monster => {
  if (!cm || !inCox(m.attributes)) return m;
  const inputs = { ...m.inputs, isFromCoxCm: true };
  return { ...m, inputs: { ...inputs, monsterCurrentHp: applyCoxScaling({ ...m, inputs }).skills.hp } };
};
