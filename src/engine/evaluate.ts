// Runs a Setup through the Wiki calculator.
import PlayerVsNPCCalc from '@/lib/PlayerVsNPCCalc';
import { calculateEquipmentBonusesFromGear } from '@/lib/Equipment';
import { PotionMap } from '@/utils';
import Potion from '@/enums/Potion';
import { Prayer, PrayerMap } from '@/enums/Prayer';
import UserIssueType from '@/enums/UserIssueType';
import { Monster } from '@/types/Monster';
import { Player, PlayerEquipment, PlayerSkills } from '@/types/Player';
import { PlayerCombatStyle } from '@/types/PlayerCombatStyle';
import { Spell } from '@/types/Spell';
import type { Skills } from '../worker/protocol';
import { generateEmptyPlayer } from './emptyPlayer';
import { usesSunfire } from '../optimiser/sunfire';

export type CombatClass = 'melee' | 'ranged' | 'magic';

export interface Character {
  skills: Skills;
  onTask: boolean;
  /** Saturated hearts can't be bought, so with Untradeables off magic uses a magic potion. */
  untradeables: boolean;
  /** Leave out items whose Requirements the levels don't meet. */
  unlockedOnly: boolean;
  /** Enchanted bolts trigger their effects 10% more often with the Kandarin hard diary done. */
  kandarinDiary: boolean;
  /** Charge is cast, so god spells hit harder with the matching god cape. */
  chargeSpell: boolean;
  /** Fighting in the Wilderness, where the Wilderness weapons get their bonus. */
  inWilderness: boolean;
}

export interface SetupInput {
  equipment: PlayerEquipment;
  style: PlayerCombatStyle;
  spell: Spell | null;
}

export const classOf = (style: PlayerCombatStyle): CombatClass => (
  style.type === 'ranged' ? 'ranged' : style.type === 'magic' ? 'magic' : 'melee'
);

// Prayers best first, with the Prayer and Defence levels each needs. Prayers a scroll or quest
// unlocks count as unlocked.
type Needs = [prayer: Prayer, level: number, defence?: number][];
const BOTH: Needs = [[Prayer.PIETY, 70, 70], [Prayer.CHIVALRY, 60, 65]];
const STRENGTH: Needs = [[Prayer.ULTIMATE_STRENGTH, 31], [Prayer.SUPERHUMAN_STRENGTH, 13], [Prayer.BURST_OF_STRENGTH, 4]];
const ATTACK: Needs = [[Prayer.INCREDIBLE_REFLEXES, 34], [Prayer.IMPROVED_REFLEXES, 16], [Prayer.CLARITY_OF_THOUGHT, 7]];
const RANGED: Needs = [[Prayer.RIGOUR, 74, 70], [Prayer.DEADEYE, 62], [Prayer.EAGLE_EYE, 44], [Prayer.HAWK_EYE, 26], [Prayer.SHARP_EYE, 8]];
const MAGIC: Needs = [[Prayer.AUGURY, 77, 70], [Prayer.MYSTIC_VIGOUR, 63], [Prayer.MYSTIC_MIGHT, 45], [Prayer.MYSTIC_LORE, 27], [Prayer.MYSTIC_WILL, 9]];

/** The best prayers for a class that the Prayer and Defence levels allow, if any. */
export const prayersFor = (cls: CombatClass, { prayer, def }: Skills): Prayer[] => {
  const best = (needs: Needs) => needs.filter(([, level, defence = 1]) => prayer >= level && def >= defence).slice(0, 1).map(([p]) => p);
  if (cls === 'ranged') return best(RANGED);
  if (cls === 'magic') return best(MAGIC);
  const both = best(BOTH);
  return both.length ? both : [...best(STRENGTH), ...best(ATTACK)];
};

const potionFor = (cls: CombatClass, character: Character): Potion => {
  if (cls === 'melee') return Potion.SUPER_COMBAT;
  if (cls === 'ranged') return Potion.RANGING;
  return character.untradeables ? Potion.SATURATED_HEART : Potion.MAGIC;
};

// Mark of Darkness is on the Arceuus spellbook from 59 Magic and boosts the demonbane spells.
const usesMark = (spell: Spell | null, { magic }: Skills) => !!spell?.name.includes('Demonbane') && magic >= 59;

// The Soulreaper axe is assumed held at its most stacks, as it's built back up between kills.
const SOULREAPER_STACKS = 5;

/** The names of the prayers, potion and other boosts assumed for a setup. */
export const assumedBoosts = ({ style, spell, equipment }: SetupInput, character: Character) => {
  const cls = classOf(style);
  return {
    prayers: prayersFor(cls, character.skills).map((p) => PrayerMap[p].name),
    potion: PotionMap[potionFor(cls, character)].name,
    // Only the ones that can change this class's DPS.
    effects: [
      ...(cls === 'ranged' && character.kandarinDiary ? ['the Kandarin hard diary'] : []),
      ...(cls === 'magic' && character.chargeSpell ? ['Charge'] : []),
      ...(cls === 'magic' && usesMark(spell, character.skills) ? ['Mark of Darkness'] : []),
      ...(cls === 'magic' && usesSunfire(spell) ? ['sunfire runes'] : []),
      ...(equipment.weapon?.name === 'Soulreaper axe' ? [`${SOULREAPER_STACKS} Soulreaper axe stacks`] : []),
    ],
  };
};

// Issues that mean the Setup can't be used against this Monster.
const BLOCKING = new Set([
  UserIssueType.EQUIPMENT_WRONG_AMMO,
  UserIssueType.EQUIPMENT_MISSING_AMMO,
  UserIssueType.SPELL_WRONG_WEAPON,
  UserIssueType.SPELL_WRONG_MONSTER,
  UserIssueType.WEAPON_WRONG_MONSTER,
]);

const boostsFor = (potion: Potion, skills: PlayerSkills): PlayerSkills => {
  const boosts: PlayerSkills = { atk: 0, def: 0, hp: 0, magic: 0, prayer: 0, ranged: 0, str: 0, mining: 0, herblore: 0 };
  return { ...boosts, ...PotionMap[potion].calculateFn(skills) };
};

export const buildPlayer = (setup: SetupInput, monster: Monster, character: Character): Player => {
  const cls = classOf(setup.style);
  const potion = potionFor(cls, character);
  const player: Player = {
    ...generateEmptyPlayer(),
    skills: character.skills,
    boosts: boostsFor(potion, character.skills),
    equipment: setup.equipment,
    style: setup.style,
    spell: setup.spell,
    prayers: prayersFor(cls, character.skills),
  };
  player.buffs = {
    ...player.buffs, potions: [potion], onSlayerTask: character.onTask, kandarinDiary: character.kandarinDiary, chargeSpell: character.chargeSpell,
    inWilderness: character.inWilderness, markOfDarknessSpell: usesMark(setup.spell, character.skills),
    usingSunfireRunes: usesSunfire(setup.spell), soulreaperStacks: SOULREAPER_STACKS,
  };
  const totals = calculateEquipmentBonusesFromGear(player, monster);
  player.bonuses = totals.bonuses;
  player.offensive = totals.offensive;
  player.defensive = totals.defensive;
  player.attackSpeed = totals.attackSpeed;
  return player;
};

/** DPS, or 0 when the engine says the Setup doesn't work here. */
export const dpsOf = (setup: SetupInput, monster: Monster, character: Character): number => {
  const calc = new PlayerVsNPCCalc(buildPlayer(setup, monster, character), monster, { loadoutName: 'x' });
  if (calc.userIssues.some((i) => BLOCKING.has(i.type))) return 0;
  return calc.getDps();
};

export interface Result {
  dps: number;
  maxHit: number;
  accuracy: number;
  /** Seconds to kill, on average. */
  killTime: number;
  player: Player;
  issues: string[];
  details: { label: string, value: string, highlight: boolean }[];
}

export const evaluate = (setup: SetupInput, monster: Monster, character: Character, withDetails = false): Result => {
  const player = buildPlayer(setup, monster, character);
  const calc = new PlayerVsNPCCalc(player, monster, { loadoutName: 'x', detailedOutput: withDetails });
  const blocked = calc.userIssues.some((i) => BLOCKING.has(i.type));
  const dps = blocked ? 0 : calc.getDps();
  return {
    dps,
    maxHit: calc.getMax(),
    accuracy: calc.getDisplayHitChance(),
    killTime: dps > 0 ? calc.getTtk() : Infinity,
    player,
    issues: calc.userIssues.map((i) => i.message),
    details: withDetails ? calc.details.map((d) => ({ label: d.label, value: d.displayValue, highlight: d.highlight })) : [],
  };
};
