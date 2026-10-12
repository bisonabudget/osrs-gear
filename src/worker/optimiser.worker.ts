// Runs the engine and the search away from the page, so typing a budget never freezes it.
import { getRangedDamageType, PlayerCombatStyle } from '@/types/PlayerCombatStyle';
import { spells } from '@/types/Spell';
import { takesSunfire, usesSunfire, withSunfire } from '../optimiser/sunfire';
import { customMonster, emptyEquipment, itemById, monsterByKey, SLOTS } from '../engine/data';
import { assumedBoosts, evaluate, SetupInput } from '../engine/evaluate';
import { Optimiser, Setup } from '../optimiser/optimise';
import { fetchPrices, Price } from '../prices';
import { inRaid, Raid } from '../toa';
import type { Drains } from '../drains';
import { withDrains } from '../engine/drains';
import { scaleMonster } from '@/lib/MonsterScaling';
import type {
  CharacterInput, CustomMonster, Outcome, Reply, Request, Results, SetupRef, SetupView, SlotOption, Stats,
} from './protocol';

let prices: Promise<Map<number, Price>> | null = null;

// The last few monster and character pairs searched, since each keeps what it has worked out.
const optimisers = new Map<string, Optimiser>();
const KEEP = 4;

const optimiserFor = async (
  monster: string, custom: CustomMonster | null, raid: Raid, drains: Drains, character: CharacterInput,
): Promise<Optimiser> => {
  const key = `${monster}|${JSON.stringify(custom)}|${raid.level}:${raid.path}|${JSON.stringify(drains)}|${JSON.stringify(character)}`;
  let o = optimisers.get(key);
  if (!o) {
    const base = monsterByKey.get(monster)?.monster;
    const raided = custom ? customMonster(custom) : base && inRaid(base, raid);
    if (!raided) throw new Error(`Unknown monster ${monster}`);
    const fight = withDrains(raided, drains);
    prices ??= fetchPrices();
    o = new Optimiser(fight, character, await prices.catch((e) => {
      prices = null;
      throw e;
    }));
    optimisers.set(key, o);
    if (optimisers.size > KEEP) optimisers.delete(optimisers.keys().next().value!);
  }
  return o;
};

const spellOf = (ref: SetupRef) => {
  const spell = ref.spell === null ? undefined : spells.find((s) => s.name === ref.spell);
  if (!spell) return null;
  return ref.sunfire && takesSunfire(spell) ? withSunfire(spell) : spell;
};

const toInput = (ref: SetupRef): SetupInput => {
  const equipment = emptyEquipment();
  for (const slot of SLOTS) {
    const id = ref.items[slot];
    equipment[slot] = id === undefined ? null : itemById.get(id)?.piece ?? null;
  }
  const dart = ref.dart === null ? undefined : itemById.get(ref.dart);
  if (dart && equipment.weapon) {
    equipment.weapon = { ...equipment.weapon, itemVars: { blowpipeDartName: dart.piece.name, blowpipeDartId: dart.piece.id } };
  }
  return {
    equipment,
    style: ref.style as PlayerCombatStyle,
    spell: spellOf(ref),
  };
};

const toRef = (input: SetupInput): SetupRef => ({
  items: Object.fromEntries(SLOTS.filter((s) => input.equipment[s]).map((s) => [s, input.equipment[s]!.id])),
  dart: input.equipment.weapon?.itemVars?.blowpipeDartId ?? null,
  style: { name: input.style.name, type: input.style.type, stance: input.style.stance },
  spell: input.spell?.name ?? null,
  sunfire: usesSunfire(input.spell),
});

const priceTime = (o: Optimiser, id: number): number | null => {
  const item = itemById.get(id);
  return item ? o.tradedAt(item) : null;
};

// What an Untradeable that costs something is made from, or the shop selling it.
const madeFrom = (o: Optimiser, id: number): string | null => {
  const item = itemById.get(id);
  if (!item || item.priceId !== null) return null;
  const cheapest = o.wayOf(item);
  return cheapest && cheapest.gp > 0 ? cheapest.way.text : null;
};

const view = (o: Optimiser, setup: Setup): SetupView => {
  const ref = toRef(setup);
  const priceTimes: SetupView['priceTimes'] = {};
  const made: SetupView['madeFrom'] = {};
  for (const slot of SLOTS) {
    const id = ref.items[slot];
    if (id === undefined) continue;
    const time = priceTime(o, id);
    if (time !== null) priceTimes[slot] = time;
    const text = madeFrom(o, id);
    if (text) made[slot] = text;
  }
  return {
    ...ref, prices: setup.prices, priceTimes, madeFrom: made, ammoCost: setup.ammoCost, uses: setup.uses, ammoSlot: setup.ammoSlot, cost: setup.cost,
  };
};

// The monster defence an attack rolls against: the attack type, or for ranged the weapon's kind.
const againstOf = (setup: Setup): Stats['against'] => {
  const { type } = setup.style;
  if (type === 'stab' || type === 'slash' || type === 'crush' || type === 'magic') return type;
  if (type !== 'ranged' || !setup.equipment.weapon) return null;
  try {
    return getRangedDamageType(setup.equipment.weapon.category);
  } catch {
    return null;
  }
};

// The monster as the DPS calculator fights it, scaled by the raid and drained.
const foeOf = (o: Optimiser): Stats['foe'] => {
  const { skills, defensive } = scaleMonster(o.monster);
  return {
    skills: { hp: skills.hp, atk: skills.atk, str: skills.str, def: skills.def, magic: skills.magic, ranged: skills.ranged },
    magicDefence: defensive.magic,
  };
};

const statsOf = (o: Optimiser, setup: Setup): Stats => {
  const result = evaluate(setup, o.monster, o.character, true, o.fightCache);
  const { offensive, defensive, bonuses } = result.player;
  return {
    dps: result.dps,
    startDps: result.startDps,
    maxHit: result.maxHit,
    accuracy: result.accuracy,
    killTime: result.killTime,
    attackSpeed: result.player.attackSpeed,
    offensive,
    defensive: { stab: defensive.stab, slash: defensive.slash, crush: defensive.crush, magic: defensive.magic, ranged: defensive.ranged },
    strength: { melee: bonuses.str, ranged: bonuses.ranged_str, magic: bonuses.magic_str, prayer: bonuses.prayer },
    ...assumedBoosts(setup, o.character),
    against: againstOf(setup),
    element: setup.spell?.element ?? null,
    details: result.details,
    foe: foeOf(o),
  };
};

const outcome = (o: Optimiser, setup: Setup, request: Request): Outcome => ({
  setup: view(o, setup),
  stats: statsOf(o, setup),
  upgrades: o.upgrades(setup, request.classes).map((u) => ({
    slot: u.slot, itemId: u.item.piece.id, gain: u.gain, netCost: u.netCost, setup: toRef(u.setup),
  })),
});

// The page only shows the newest search, so one replaced while it waited is skipped.
let newest = 0;

const handle = async (id: number, request: Request): Promise<Results[Request['kind']]> => {
  const o = await optimiserFor(request.monster, request.custom, request.raid, request.drains, request.character);
  if ((request.kind === 'best' || request.kind === 'evaluate') && id !== newest) throw new Error('Replaced by a newer search');
  switch (request.kind) {
    case 'best': {
      const setup = o.optimise(request.budget, request.classes);
      return setup ? outcome(o, setup, request) : null;
    }
    case 'evaluate':
      return outcome(o, o.priced(toInput(request.setup)), request);
    case 'compare': {
      const setup = o.priced(toInput(request.setup));
      return { setup: view(o, setup), stats: statsOf(o, setup), upgrades: [] };
    }
    case 'slot': {
      const current = o.priced(toInput(request.setup));
      return o.slotOptions(current, request.slot, request.classes).map(({ swap: s, alike }): SlotOption => ({
        itemId: s.item.piece.id,
        alike: alike.map((a) => a.piece.id),
        dps: s.setup.dps,
        netCost: s.netCost,
        price: o.costOf(s.item) ?? 0,
        priceTime: priceTime(o, s.item.piece.id),
        madeFrom: madeFrom(o, s.item.piece.id),
        setup: toRef(s.setup),
      }));
    }
    default:
      throw new Error('Unknown request');
  }
};

self.onmessage = async (e: MessageEvent<{ id: number } & Request>) => {
  const { id, ...request } = e.data;
  if (request.kind === 'best' || request.kind === 'evaluate') newest = id;
  // Searches sent while another ran are all waiting now; let them arrive before starting.
  await new Promise((resolve) => setTimeout(resolve));
  let reply: Reply;
  try {
    reply = { id, result: await handle(id, request as Request) };
  } catch (err) {
    reply = { id, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(reply);
};
