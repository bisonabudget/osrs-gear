// The Custom monster: one fight's stats changed by the player, for a new monster or theorycrafting.
// Kept apart from the catalog so the worker can use it without the page's data.

export const CUSTOM_KEY = 'custom';
export const CUSTOM_NAME = 'Custom monster';

/** The attributes a Custom monster can have. Xerician is left out, as it only scales raid fights. */
export const CUSTOM_ATTRIBUTES = [
  'demon', 'dragon', 'fiery', 'flying', 'golem', 'kalphite', 'leafy', 'penance', 'rat', 'shade', 'spectral', 'undead',
  'vampyre1', 'vampyre2', 'vampyre3',
];
