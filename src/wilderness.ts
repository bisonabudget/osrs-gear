// Where a monster is fought, for Craw's bow, Viggora's chainmace, Thammaron's sceptre and their
// upgrades, which only get their bonus in the Wilderness.
const ONLY = /^(Artio|Callisto|Calvar'ion|Chaos Elemental|Chaos Fanatic|Crazy archaeologist|Elder Chaos druid|Lava dragon|Scorpia|Spindel|Venenatis|Vet'ion|Revenant )|Hellhound \((Calvar'ion|Vet'ion)\)$/;

// Monsters also found outside it, from Krystilia's Wilderness Slayer tasks on the OSRS Wiki.
// Versions named after somewhere else, like "Bandit (Pollnivneach)", aren't in the Wilderness.
const ALSO = new Set([
  'Abyssal demon', 'Ankou', 'Aviansie', 'Bandit', 'Black bear', 'Black demon', 'Black dragon', 'Black Knight', 'Bloodveld',
  'Chaos druid', 'Dark warrior', 'Deadly red spider', 'Dust devil', 'Earth warrior', 'Ent', 'Fire giant', 'Giant spider',
  'Greater demon', 'Green dragon', 'Grizzly bear', 'Hellhound', 'Hill Giant', 'Ice giant', 'Ice warrior', 'Jelly',
  'Lesser demon', 'Magic axe', 'Mammoth', 'Moss giant', 'Nechryael', 'Pirate', 'Poison spider', 'Rogue', 'Scorpion',
  'Skeleton', 'Spider', 'Spiritual mage', 'Spiritual ranger', 'Spiritual warrior', 'Zombie',
]);

/** Whether a monster is always, sometimes or never fought in the Wilderness. */
export const wildernessOf = (name: string): 'always' | 'sometimes' | 'never' => {
  if (ONLY.test(name)) return 'always';
  return ALSO.has(name) ? 'sometimes' : 'never';
};
