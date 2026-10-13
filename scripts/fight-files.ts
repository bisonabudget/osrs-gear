// Splits the engine's monster list into one small file per fight, so the search downloads only
// the monster being fought. Used by the build (vite.config.ts) and checked by tests/data.test.ts.
import { createHash } from 'node:crypto';
import engineRows from '../src/data/engine-monsters.json';
import fightRows from '../src/data/fights.json';

export interface FightFile {
  /** Named by what's in it, so a saved copy is never out of date. */
  file: string;
  body: string;
}

/** Each fight's engine monster, by fight key. */
export const fightFiles = (): Map<string, FightFile> => {
  // As in src/engine/data.ts: Jhallan is listed twice under one key, the second time with 1 hitpoint.
  const rows = new Map(engineRows.filter((m) => m.skills.hp > 1).map((m) => [`${m.id}:${m.version}`, m]));
  return new Map(fightRows.map((f) => {
    const key = `${f.id}:${f.version}`;
    const row = rows.get(key);
    if (!row) throw new Error(`No engine monster for ${key}`);
    const body = JSON.stringify(row);
    return [key, { file: `fights/${createHash('sha256').update(body).digest('hex').slice(0, 12)}.json`, body }];
  }));
};
