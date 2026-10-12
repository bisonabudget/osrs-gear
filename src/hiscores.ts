// Levels from the Old School hiscores. Browsers can't read the hiscores from another site, so the
// request goes through the Cloudflare Worker in api/, or the dev server (see vite.config.ts) locally.
import type { Skills } from './worker/protocol';

const HISCORES = `${import.meta.env.VITE_API ?? ''}/hiscores`;

interface Entry { name: string, rank: number, level: number, xp: number }
export interface HiscoresReply { name: string, skills: Entry[] }

/** A player's levels from the hiscores, and the skills the hiscores don't list for them. */
export interface Character {
  name: string;
  skills: Skills;
  missing: string[];
}

const NAMES: [keyof Skills, string][] = [
  ['atk', 'Attack'], ['str', 'Strength'], ['def', 'Defence'], ['ranged', 'Ranged'], ['magic', 'Magic'],
  ['prayer', 'Prayer'], ['hp', 'Hitpoints'], ['agility', 'Agility'], ['slayer', 'Slayer'], ['mining', 'Mining'],
  ['herblore', 'Herblore'],
];

/** RuneScape names are 1 to 12 letters, numbers, spaces, hyphens or underscores. */
export const validName = (text: string) => /^[A-Za-z0-9 _-]{1,12}$/.test(text.trim());

export const readHiscores = (reply: HiscoresReply): Character => {
  const skills = {} as Skills;
  const missing: string[] = [];
  for (const [id, name] of NAMES) {
    const entry = reply.skills.find((s) => s.name === name);
    // A skill too low to be listed comes back as level 1 with -1 xp. Hitpoints never goes below 10.
    // Skills with xp but no rank still give the right level.
    if (!entry || entry.xp < 0) missing.push(name);
    const lowest = id === 'hp' ? 10 : 1;
    skills[id] = Math.min(99, Math.max(lowest, entry?.level ?? lowest));
  }
  return { name: reply.name, skills, missing };
};

export class HiscoresError extends Error {}

export const fetchHiscores = async (rsn: string): Promise<Character> => {
  const name = rsn.trim();
  const reply = await fetch(`${HISCORES}?player=${encodeURIComponent(name)}`).catch(() => null);
  if (reply?.status === 404) throw new HiscoresError(`Can't find ${name} on the hiscores.`);
  if (reply?.status === 429) throw new HiscoresError('Too many lookups. Try again in a minute.');
  const body = reply?.ok ? await reply.json().catch(() => null) as HiscoresReply | null : null;
  if (!Array.isArray(body?.skills)) throw new HiscoresError("The hiscores didn't answer. Try again in a moment.");
  return readHiscores(body);
};
