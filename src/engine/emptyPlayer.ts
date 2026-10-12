// A player with 99s and nothing equipped, matching generateEmptyPlayer in the Wiki
// calculator's state.tsx. The engine's tests import it from '@/state', which points here.
import { Player } from '@/types/Player';
import { getCombatStylesForCategory } from '@/utils';
import { EquipmentCategory } from '@/enums/EquipmentCategory';
import { DEFAULT_ATTACK_SPEED } from '@/lib/constants';

const levels = (value: number) => ({
  atk: value, def: value, hp: value, magic: value, prayer: value, ranged: value, str: value, mining: value, herblore: value,
});

export const generateEmptyPlayer = (name?: string): Player => ({
  name: name ?? 'Loadout 1',
  style: getCombatStylesForCategory(EquipmentCategory.NONE)[0],
  skills: levels(99),
  boosts: levels(0),
  equipment: {
    ammo: null, body: null, cape: null, feet: null, hands: null, head: null,
    legs: null, neck: null, ring: null, shield: null, weapon: null,
  },
  attackSpeed: DEFAULT_ATTACK_SPEED,
  prayers: [],
  bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
  defensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
  offensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
  buffs: {
    potions: [],
    onSlayerTask: true,
    inWilderness: false,
    kandarinDiary: true,
    chargeSpell: false,
    markOfDarknessSpell: false,
    forinthrySurge: false,
    soulreaperStacks: 0,
    baAttackerLevel: 0,
    chinchompaDistance: 4,
    usingSunfireRunes: false,
  },
  spell: null,
});
