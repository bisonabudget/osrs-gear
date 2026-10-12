// The spell and prayer rules, and what a setup uses up as it attacks, checked against the OSRS
// Wiki's rates. Every rune and item costs 1 gp here, so the gp of each use is how many are used.
import { describe, expect, test } from 'vitest';
import { Prayer } from '@/enums/Prayer';
import { PlayerCombatStyle } from '@/types/PlayerCombatStyle';
import { spells } from '@/types/Spell';
import { emptyEquipment, items, Slot } from '../src/engine/data';
import { prayersFor, SetupInput } from '../src/engine/evaluate';
import { canAutocast, spellLevel } from '../src/optimiser/spellbook';
import {
  ammoSlotOf, attackUses, savesAmmo, upkeepOf, Use, usedUp, usesOf,
} from '../src/optimiser/supplies';

const levels = { atk: 99, str: 99, def: 99, ranged: 99, magic: 99, prayer: 99, hp: 99, agility: 99, slayer: 99, mining: 99, herblore: 99 };

const piece = (name: string) => {
  const item = items.find((i) => i.piece.name === name);
  if (!item) throw new Error(`No item called ${name}`);
  return item.piece;
};

const spell = (name: string) => {
  const found = spells.find((s) => s.name === name);
  if (!found) throw new Error(`No spell called ${name}`);
  return found;
};

const AUTOCAST: PlayerCombatStyle = { name: 'Spell', type: 'magic', stance: 'Autocast' };
const POWERED: PlayerCombatStyle = { name: 'Accurate', type: 'magic', stance: 'Accurate' };
const RAPID: PlayerCombatStyle = { name: 'Rapid', type: 'ranged', stance: 'Rapid' };
const BLAZE: PlayerCombatStyle = { name: 'Blaze', type: 'magic', stance: 'Defensive' };

const setupOf = (worn: Partial<Record<Slot, string>>, style: PlayerCombatStyle, spellName: string | null = null): SetupInput => {
  const equipment = emptyEquipment();
  for (const [slot, name] of Object.entries(worn)) equipment[slot as Slot] = piece(name);
  return { equipment, style, spell: spellName ? spell(spellName) : null };
};

const one = () => 1;

// How many of each thing 100 attacks use.
const used = (input: SetupInput) => Object.fromEntries(attackUses(input, 100, one).map((u) => [u.name, u.perHour]));

describe('spells', () => {
  test('need the Magic level', () => {
    expect(spellLevel('Ice Barrage')).toBe(94);
    expect(spellLevel('Fire Surge')).toBe(95);
    expect(spellLevel('Earth Wave')).toBe(70);
    expect(spellLevel('Not a spell')).toBe(Infinity);
  });

  test('need a weapon that can autocast them', () => {
    expect(canAutocast('Mystic fire staff', spell('Fire Surge'))).toBe(true);
    expect(canAutocast('Mystic fire staff', spell('Ice Barrage'))).toBe(false);
    expect(canAutocast('Kodai wand', spell('Ice Barrage'))).toBe(true);
    expect(canAutocast('Ancient sceptre', spell('Ice Barrage'))).toBe(true);
    expect(canAutocast('Blood ancient sceptre', spell('Blood Barrage'))).toBe(true);
    expect(canAutocast('Staff of air', spell('Ghostly Grasp'))).toBe(false);
    // A god staff can't autocast its own god spell.
    expect(canAutocast('Zamorak staff', spell('Flames of Zamorak'))).toBe(false);
    expect(canAutocast('Staff of the Dead', spell('Flames of Zamorak'))).toBe(true);
    // The slayer's staff only autocasts the waves and surges of the elemental spells.
    expect(canAutocast("Slayer's staff", spell('Fire Wave'))).toBe(true);
    expect(canAutocast("Slayer's staff", spell('Fire Bolt'))).toBe(false);
    expect(canAutocast("Slayer's staff", spell('Magic Dart'))).toBe(true);
    // Curses and binds can't be autocast.
    expect(canAutocast('Staff of air', spell('Confuse'))).toBe(false);
    expect(canAutocast('Staff of air', spell('Bind'))).toBe(false);
  });
});

describe('prayers', () => {
  test('are the best the Prayer level allows', () => {
    expect(prayersFor('melee', levels)).toEqual([Prayer.PIETY]);
    expect(prayersFor('ranged', levels)).toEqual([Prayer.RIGOUR]);
    expect(prayersFor('magic', levels)).toEqual([Prayer.AUGURY]);
    const p50 = { ...levels, prayer: 50 };
    expect(prayersFor('melee', p50)).toEqual([Prayer.ULTIMATE_STRENGTH, Prayer.INCREDIBLE_REFLEXES]);
    expect(prayersFor('ranged', p50)).toEqual([Prayer.EAGLE_EYE]);
    expect(prayersFor('magic', p50)).toEqual([Prayer.MYSTIC_MIGHT]);
    expect(prayersFor('melee', { ...levels, prayer: 65, def: 65 })).toEqual([Prayer.CHIVALRY]);
  });

  test('Piety, Rigour and Augury also need 70 Defence', () => {
    const pure = { ...levels, def: 1 };
    expect(prayersFor('melee', pure)).toEqual([Prayer.ULTIMATE_STRENGTH, Prayer.INCREDIBLE_REFLEXES]);
    expect(prayersFor('ranged', pure)).toEqual([Prayer.DEADEYE]);
    expect(prayersFor('magic', pure)).toEqual([Prayer.MYSTIC_VIGOUR]);
  });

  test('there are none below the first combat prayer', () => {
    for (const cls of ['melee', 'ranged', 'magic'] as const) expect(prayersFor(cls, { ...levels, prayer: 1 })).toEqual([]);
  });
});

describe('what a setup uses up', () => {
  test('a spell uses its runes, less any the staff gives', () => {
    expect(used(setupOf({ weapon: 'Staff of air' }, AUTOCAST, 'Fire Surge'))).toEqual({ 'Fire rune': 1000, 'Wrath rune': 100 });
    expect(used(setupOf({ weapon: 'Mystic fire staff' }, AUTOCAST, 'Fire Surge'))).toEqual({ 'Air rune': 700, 'Wrath rune': 100 });
  });

  test('the kodai wand gives water runes and saves 15% of the rest', () => {
    const u = used(setupOf({ weapon: 'Kodai wand' }, AUTOCAST, 'Ice Barrage'));
    expect(Object.keys(u).sort()).toEqual(['Blood rune', 'Death rune']);
    expect(u['Death rune']).toBeCloseTo(340);
    expect(u['Blood rune']).toBeCloseTo(170);
  });

  test('a tome gives its runes and uses a page for every 20 spells of its element', () => {
    const pages = (id: number) => ({ 20718: 2, 28931: 3 }[id] ?? 1);
    const uses = attackUses(setupOf({ weapon: 'Staff of air', shield: 'Tome of Fire' }, AUTOCAST, 'Fire Surge'), 100, pages);
    expect(Object.fromEntries(uses.map((u) => [u.name, u.perHour]))).toEqual({ 'Wrath rune': 100, 'Burnt page': 5 });
    expect(uses.find((u) => u.name === 'Burnt page')!.gp).toBe(10);
  });

  test('powered staves use their charges', () => {
    expect(used(setupOf({ weapon: "Tumeken's shadow" }, POWERED))).toEqual({ 'Soul rune': 200, 'Chaos rune': 500 });
    expect(used(setupOf({ weapon: 'Trident of the Seas' }, POWERED))).toEqual({
      'Death rune': 100, 'Chaos rune': 100, 'Fire rune': 500, Coins: 1000,
    });
  });

  test('a salamander burns tar in every style, which no Ava\'s device saves', () => {
    const lizard = setupOf({ weapon: 'Swamp lizard', ammo: 'Guam tar', cape: "Ava's assembler" }, BLAZE);
    expect(used(lizard)).toEqual({ 'Guam tar': 100 });
    expect(attackUses(lizard, 100, one)[0].kind).toBe('ammo');
    expect(ammoSlotOf(lizard)).toBe('ammo');
    expect(savesAmmo(lizard)).toBe(false);
  });

  test('thrown weapons are used up, and an Ava\'s device saves knives but not chinchompas', () => {
    const knives = setupOf({ weapon: 'Rune knife', cape: "Ava's assembler" }, RAPID);
    expect(usedUp(knives.equipment.weapon!)).toBe(true);
    expect(ammoSlotOf(knives)).toBe('weapon');
    expect(used(knives)['Rune knife']).toBeCloseTo(20);
    expect(used(setupOf({ weapon: 'Black chinchompa', cape: "Ava's assembler" }, RAPID))).toEqual({ 'Black chinchompa': 100 });
  });

  test('the Tonalztics of Ralos are kept and use sunfire splinters', () => {
    const tonalztics = setupOf({ weapon: 'Tonalztics of Ralos' }, RAPID);
    expect(usedUp(tonalztics.equipment.weapon!)).toBe(false);
    expect(ammoSlotOf(tonalztics)).toBeNull();
    expect(used(tonalztics)).toEqual({ 'Sunfire splinters': 100 });
  });

  test('a blowpipe uses darts, saved by an Ava\'s device, and scales, which are not', () => {
    const input = setupOf({ weapon: 'Toxic blowpipe', cape: "Ava's assembler" }, RAPID);
    const dart = piece('Amethyst dart');
    input.equipment.weapon = { ...input.equipment.weapon!, itemVars: { blowpipeDartName: dart.name, blowpipeDartId: dart.id } };
    const u = used(input);
    expect(u['Amethyst dart']).toBeCloseTo(20);
    expect(u["Zulrah's scales"]).toBeCloseTo(200 / 3);
  });

  test('Dizana\'s quiver saves arrows and uses a charge on a third of them', () => {
    const u = used(setupOf({ weapon: 'Twisted bow', ammo: 'Dragon arrow', cape: "Dizana's quiver" }, RAPID));
    expect(u['Dragon arrow']).toBeCloseTo(20);
    expect(u['Sunfire splinters']).toBeCloseTo(100 / 3);
    // The dark bow fires two arrows each attack.
    expect(used(setupOf({ weapon: 'Dark bow', ammo: 'Dragon arrow' }, RAPID))['Dragon arrow']).toBeCloseTo(200);
  });

  test('the serpentine helm and toxic staff of the dead use scales by the hour, added together', () => {
    expect(upkeepOf(piece('Serpentine helm'), one)[0].perHour).toBeCloseTo(11_000 / 16.5);
    const input = setupOf({ weapon: 'Toxic staff of the dead', head: 'Serpentine helm' }, AUTOCAST, 'Fire Surge');
    const scales = usesOf(input, 100, one).filter((u: Use) => u.name === "Zulrah's scales");
    expect(scales).toHaveLength(1);
    expect(scales[0].perHour).toBeCloseTo(600 + 11_000 / 16.5);
    // The staff also casts one spell in seven without using runes.
    expect(used(input)['Wrath rune']).toBeCloseTo(600 / 7);
  });
});
