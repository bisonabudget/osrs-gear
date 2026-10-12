// Sunfire runes are cast in place of fire runes, and every fire spell that hits does at least a
// tenth of its max hit. They cost far more than fire runes and are used up even when a staff or
// tome gives fire runes, so the search tries each fire spell with and without them.
import { canUseSunfireRunes, Spell } from '@/types/Spell';

type SunfireSpell = Spell & { sunfire?: true };

const copies = new Map<string, SunfireSpell>();

/** The spell cast with sunfire runes. */
export const withSunfire = (spell: Spell): Spell => {
  let copy = copies.get(spell.name);
  if (!copy) copies.set(spell.name, copy = { ...spell, sunfire: true });
  return copy;
};

/** Whether a spell is cast with sunfire runes. */
export const usesSunfire = (spell: Spell | null): boolean => !!(spell as SunfireSpell | null)?.sunfire;

/** Fire spells, which can be cast with sunfire runes. */
export const takesSunfire = (spell: Spell): boolean => canUseSunfireRunes(spell) && !usesSunfire(spell);

/** A spell's name, marked when it's cast with sunfire runes, for telling setups apart. */
export const spellKey = (spell: Spell | null): string => (spell ? `${spell.name}${usesSunfire(spell) ? '+sunfire' : ''}` : '');
