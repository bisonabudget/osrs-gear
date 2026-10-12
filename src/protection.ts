// Protection: what a Monster's mechanics demand in one gear slot, from the OSRS Wiki's Slayer
// equipment page and each monster's page. Without it the monster drains the player's stats, hits
// them very hard or can't be damaged. Dragonfire isn't here, as an antifire potion is assumed, and
// neither is anything a quest or diary removes, as those count as done.

export type ProtectedSlot = 'head' | 'cape' | 'neck' | 'shield' | 'hands' | 'feet';

export interface Protection {
  slot: ProtectedSlot;
  /** The items that protect, any one of which is worn. Empty when the item can't be in a Setup. */
  items: string[];
  /** An item held in the slot that the DPS calculator doesn't know, which leaves the slot empty. */
  held?: string;
  /** Who it's needed against, to finish "Needed against ...". */
  against: string;
}

const SLAYER_HELMS = ['Slayer helmet', 'Slayer helmet (i)'];
const helm = (item: string, against: string): Protection => ({ slot: 'head', items: [item, ...SLAYER_HELMS], against });

const RULES: [monsters: string[], protection: Protection][] = [
  [['Aberrant spectre', 'Abhorrent spectre', 'Deviant spectre', 'Repugnant spectre'], helm('Nose peg', 'spectres')],
  [['Banshee', 'Screaming banshee', 'Twisted Banshee', 'Screaming twisted banshee'], helm('Earmuffs', 'banshees')],
  [['Dust devil', 'Choke devil'], helm('Facemask', 'dust devils')],
  [['Smoke devil', 'Nuclear smoke devil', 'Thermonuclear smoke devil'], helm('Facemask', 'smoke devils')],
  [['Wall beast'], helm('Spiny helmet', 'wall beasts')],
  [['Sourhog'], helm('Reinforced goggles', 'sourhogs')],
  [['Basilisk', 'Monstrous basilisk', 'Basilisk Knight'], { slot: 'shield', items: ['Mirror shield', "V's shield"], against: 'basilisks' }],
  [['Cockatrice', 'Cockathrice', 'Moonlight Cockatrice'], { slot: 'shield', items: ['Mirror shield', "V's shield"], against: 'cockatrices' }],
  [['Skeletal Wyvern', 'Spitting Wyvern', 'Taloned Wyvern', 'Long-tailed Wyvern', 'Ancient Wyvern'], {
    slot: 'shield', items: ['Elemental shield', 'Mind shield', 'Dragonfire shield', 'Dragonfire ward', 'Ancient wyvern shield'], against: "wyverns' icy breath",
  }],
  [['Dire gryphon', 'Shellbane gryphon'], { slot: 'cape', items: ['Tortugan shield'], against: 'this gryphon' }],
  [['Harpie Bug Swarm'], { slot: 'shield', items: [], held: 'Lit bug lantern', against: 'harpie bug swarms, which nothing else can damage' }],
  [['Cave horror', 'Cave abomination'], { slot: 'neck', items: ['Witchwood icon'], against: 'cave horrors' }],
  [['Fever spider'], { slot: 'hands', items: ['Slayer gloves'], against: 'fever spiders' }],
  [['Killerwatt'], { slot: 'feet', items: ['Insulated boots'], against: 'killerwatts' }],
];

const byMonster = new Map(RULES.flatMap(([monsters, p]) => monsters.map((m) => [m.toLowerCase(), p] as const)));

/** The Protection a Monster demands, if any. Quest copies like "Basilisk (The Fremennik Exiles)" count too. */
export const protectionFor = (monsterName: string): Protection | null => (
  byMonster.get(monsterName.replace(/ \(.*\)$/, '').toLowerCase()) ?? null
);

/** Every item that protects against some Monster, which the data build keeps. */
export const PROTECTIVE_ITEMS = new Set(RULES.flatMap(([, p]) => p.items));
