// Each fight's engine monster, made by the fightLoader plugin in vite.config.ts.
declare module 'virtual:fights' {
  import type { MonsterRow } from '../engine/data';

  export const loadFight: (key: string) => Promise<MonsterRow>;
}
