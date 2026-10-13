// Every fight the site offers with its engine monster, all loaded at once, for the tests. The
// search worker loads only the one being fought (see scripts/fight-files.ts).
import { getMonsters } from '@/lib/Monsters';
import { Monster } from '@/types/Monster';
import type { CustomMonster } from '../worker/protocol';
import fightRows from '../data/fights.json';
import { customMonster as copyOf, inFight } from './data';

export interface MonsterEntry {
  key: string;
  name: string;
  /** Tells apart two fights with the same name, or '' when there is only one. */
  label: string;
  level: number;
  image: string;
  slayer: boolean;
  boss: boolean;
  monster: Monster;
}

// The engine lists Jhallan twice under one id and version, the second time as a 1-hitpoint form
// the site leaves out, so only fights with more than 1 hitpoint are looked up.
const engineMonsters = new Map(getMonsters().filter((m) => m.skills.hp > 1).map((m) => [`${m.id}:${m.version}`, m]));

export const monsters: MonsterEntry[] = (fightRows as {
  id: number, version: string, name: string, label: string, level: number, image: string, slayer?: 1, boss?: 1,
}[]).map((row) => {
  const key = `${row.id}:${row.version}`;
  return {
    key,
    name: row.name,
    label: row.label,
    level: row.level,
    image: row.image,
    slayer: row.slayer === 1,
    boss: row.boss === 1,
    monster: inFight(engineMonsters.get(key)!),
  };
});

export const monsterByKey = new Map(monsters.map((m) => [m.key, m]));

/** The engine's monster for a Custom monster. */
export const customMonster = (c: CustomMonster): Monster => {
  const base = monsterByKey.get(c.from)?.monster;
  if (!base) throw new Error(`Unknown monster ${c.from}`);
  return copyOf(c, base);
};
