// The Warriors' Guild defenders, each earned after the one before, so a player who has one has
// earned all those below it. An Avernic defender is a dragon defender with a hilt added.
export const DEFENDERS = ['Bronze', 'Iron', 'Steel', 'Black', 'Mithril', 'Adamant', 'Rune', 'Dragon']
  .map((metal) => `${metal} defender`);

const MADE_FROM: Record<string, string> = { 'Avernic defender': 'Dragon defender' };

/**
 * Whether the defender an item is, or is made from, has been earned, given the best defender
 * the player has (null for none, undefined for all). Items that aren't defenders always have.
 */
export const defenderEarned = (name: string, best: string | null | undefined): boolean => {
  const rank = DEFENDERS.indexOf(MADE_FROM[name] ?? name);
  if (rank < 0 || best === undefined) return true;
  return best !== null && rank <= DEFENDERS.indexOf(best);
};
