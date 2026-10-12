// Runs a Setup through the Wiki calculator.
import PlayerVsNPCCalc from '@/lib/PlayerVsNPCCalc';
import { calculateEquipmentBonusesFromGear } from '@/lib/Equipment';
import { PotionMap } from '@/utils';
import Potion from '@/enums/Potion';
import { Prayer, PrayerMap } from '@/enums/Prayer';
import UserIssueType from '@/enums/UserIssueType';
import { EquipmentCategory } from '@/enums/EquipmentCategory';
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

// HP taken together when working out hits that change as the monster loses HP.
const BAND = 40;

type DelayedHits = ReturnType<PlayerVsNPCCalc['distAtHp']>;

// Chance of each damage total from one attack.
const histogramOf = (hits: DelayedHits): Float64Array => {
  const max = hits.reduce((m, [wh]) => Math.max(m, wh.getSum()), 0);
  const hist = new Float64Array(max + 1);
  for (const [wh] of hits) hist[wh.getSum()] += wh.probability;
  return hist;
};

// Average hits to kill when some hits depend on the monster's current HP, like ruby bolt procs
// or the keris partisan of the sun in ToA. The engine's own count uses the hits at full HP all
// the way down, so this redoes it with the hits at each HP the monster passes through.
const htkOf = (calc: PlayerVsNPCCalc): number => {
  const base = calc.getDistribution().zipped.withProbabilisticDelays(calc.getWeaponDelayProvider());
  const baseHist = histogramOf(base);
  const startHp = (calc as unknown as { monster: Monster }).monster.inputs.monsterCurrentHp;
  const htk = new Float64Array(startHp + 1);
  // Working the hits out afresh at every HP is slow, so HPs are taken in bands that share the
  // hits from the middle of the band.
  const hists = new Map<number, Float64Array>();
  for (let hp = 1; hp <= startHp; hp++) {
    const mid = Math.min(startHp, Math.floor((hp - 1) / BAND) * BAND + BAND / 2);
    let hist = hists.get(mid);
    if (!hist) {
      const hits = calc.distAtHp(base, mid);
      hist = hits === base ? baseHist : histogramOf(hits);
      hists.set(mid, hist);
    }
    if (hist[0] >= 1) return Infinity;
    let val = 1;
    for (let hit = 1; hit < hist.length; hit++) val += hist[hit] * htk[Math.max(0, hp - hit)];
    htk[hp] = val / (1 - hist[0]);
  }
  return htk[startHp];
};

/**
 * How much more slowly setups that depend on the monster's HP really kill it, kept for one monster.
 * Working it out is slow, so setups with near enough the same average hit and accuracy share it.
 * Ruby bolts and the keris partisan of the sun change their own hits, so those also need the same
 * weapon, ammo and style. Otherwise it's the monster that changes, like Vardorvis's Defence.
 */
export type FightCache = Map<string, number>;

const ownEffect = ({ equipment, style }: Player) => equipment.weapon?.name === 'Keris partisan of the sun'
  || (style.type === 'ranged' && equipment.weapon?.category === EquipmentCategory.CROSSBOW && /^Ruby (dragon )?bolts \(e\)$/.test(equipment.ammo?.name ?? ''));

const fightKey = (player: Player, calc: PlayerVsNPCCalc) => [
  ...(ownEffect(player) ? [player.equipment.weapon?.id, player.equipment.ammo?.id, player.style.name] : []),
  player.style.type, Math.round(Math.log(calc.getExpectedDamage()) * 100), Math.round(calc.getHitChance() * 100),
].join('|');

// How many times as many hits the kill really takes as the engine's count at full HP: under 1 when
// the monster gets easier as it loses HP, like Vardorvis, and 1 for setups that don't depend on it.
const slowerBy = (calc: PlayerVsNPCCalc, player: Player, monster: Monster, cache?: FightCache): number => {
  if (!calc.distIsCurrentHpDependent(player, monster)) return 1;
  const key = cache && fightKey(player, calc);
  let slower = key ? cache.get(key) : undefined;
  if (slower === undefined) {
    slower = htkOf(calc) / calc.getHtk();
    if (key) cache!.set(key, slower);
  }
  return slower;
};

/** DPS over the whole kill, or 0 when the engine says the Setup doesn't work here. */
export const dpsOf = (setup: SetupInput, monster: Monster, character: Character, cache?: FightCache): number => {
  const player = buildPlayer(setup, monster, character);
  const calc = new PlayerVsNPCCalc(player, monster, { loadoutName: 'x' });
  if (calc.userIssues.some((i) => BLOCKING.has(i.type))) return 0;
  const dps = calc.getDps();
  return dps > 0 ? dps / slowerBy(calc, player, monster, cache) : 0;
};

export interface Result {
  /** Averaged over the whole kill. */
  dps: number;
  /** At the monster's full HP, which is higher for hits that shrink as it loses HP. */
  startDps: number;
  maxHit: number;
  accuracy: number;
  /** Seconds to kill, on average. */
  killTime: number;
  player: Player;
  issues: string[];
  details: { label: string, value: string, highlight: boolean }[];
}

export const evaluate = (setup: SetupInput, monster: Monster, character: Character, withDetails = false, cache?: FightCache): Result => {
  const player = buildPlayer(setup, monster, character);
  const calc = new PlayerVsNPCCalc(player, monster, { loadoutName: 'x', detailedOutput: withDetails });
  const blocked = calc.userIssues.some((i) => BLOCKING.has(i.type));
  const startDps = blocked ? 0 : calc.getDps();
  const slower = startDps > 0 ? slowerBy(calc, player, monster, cache) : 1;
  const dps = startDps / slower;
  return {
    dps,
    startDps,
    maxHit: calc.getMax(),
    accuracy: calc.getDisplayHitChance(),
    killTime: dps > 0 ? calc.getTtk() * slower : Infinity,
    player,
    issues: calc.userIssues.map((i) => i.message),
    details: withDetails ? calc.details.map((d) => ({ label: d.label, value: d.displayValue, highlight: d.highlight })) : [],
  };
};
