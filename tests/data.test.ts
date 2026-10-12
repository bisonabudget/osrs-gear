// The data scripts/build-data.ts writes, checked against the rules the site depends on.
import { describe, expect, test } from 'vitest';
import { items, monsterByKey } from '../src/engine/data';
import { scaleMonster } from '@/lib/MonsterScaling';
import engineEquipment from '../src/data/engine-equipment.json';
import engineMonsters from '../src/data/engine-monsters.json';
import fights from '../src/data/fights.json';
import monsterRows from '../src/data/monsters.json';
import equipmentAliases from '@/lib/EquipmentAliases';
import { PROTECTIVE_ITEMS } from '../src/protection';

describe('items', () => {
  test('every item adds to some attack, unless the engine does more with it or a monster demands it', () => {
    const useless = items.filter(({ piece, special }) => !special && !PROTECTIVE_ITEMS.has(piece.name)
      && !Object.values(piece.offensive).some((v) => v > 0)
      && piece.bonuses.str <= 0 && piece.bonuses.ranged_str <= 0 && piece.bonuses.magic_str <= 0);
    expect(useless.map((i) => i.piece.name)).toEqual([]);
  });

  test('items carry the levels needed to wear them', () => {
    const needs = (name: string) => items.find((i) => i.piece.name === name)?.needs;
    expect(needs('Ghrazi rapier')).toEqual({ atk: 80 });
    expect(needs('Twisted bow')).toEqual({ ranged: 85 });
    expect(needs('Bow of Faerdhinen')).toEqual({ ranged: 80, agility: 70 });
    // Warhammers need Strength since the 2021 rebalance; the game data and osrsreboxed still say Attack.
    expect(needs('Rune warhammer')).toEqual({ str: 40 });
    // The game lists the Crafting level to make a battlestaff, which doesn't count.
    expect(needs('Fire battlestaff')).toEqual({ atk: 30, magic: 30 });
    expect(needs('Fire cape')).toEqual({});
    const known = new Set(['atk', 'str', 'def', 'ranged', 'magic', 'prayer', 'hp', 'agility', 'slayer', 'combat']);
    for (const { piece, needs: n } of items) {
      for (const [skill, level] of Object.entries(n)) {
        expect(known.has(skill), `${piece.name} needs ${skill}`).toBe(true);
        expect(level, piece.name).toBeGreaterThan(1);
        expect(level, piece.name).toBeLessThanOrEqual(skill === 'combat' ? 126 : 99);
      }
    }
  });

  test('cosmetic clothing is gone', () => {
    expect(items.filter((i) => /^Elegant|^Team-\d+ cape$/.test(i.piece.name))).toEqual([]);
  });

  test('untradeable versions the engine treats differently are kept', () => {
    const names = new Set(items.map((i) => i.piece.name));
    for (const name of ['Eldritch Nightmare staff', 'Volatile Nightmare staff', 'Harmonised Nightmare staff', "Slayer's staff (e)"]) {
      expect(names.has(name), name).toBe(true);
    }
  });

  test('the engine is built with every item, and the base item of each', () => {
    const ids = new Set(engineEquipment.map((e) => e.id));
    const base = new Map<number, number>();
    for (const [k, variants] of Object.entries(equipmentAliases)) for (const v of variants) if (!base.has(v)) base.set(v, Number(k));
    for (const { piece } of items) {
      expect(ids.has(piece.id), piece.name).toBe(true);
      if (base.has(piece.id)) expect(ids.has(base.get(piece.id)!), `base of ${piece.name}`).toBe(true);
    }
  });
});

describe('monsters', () => {
  test('only ones that can be killed', () => {
    const names = monsterRows.map((m) => m.name);
    expect(names.filter((n) => / impling$/i.test(n) || n === 'Tentacle (Abyssal Sire)')).toEqual([]);
    expect(monsterRows.filter((m) => m.skills[0] <= 1)).toEqual([]);
    expect(monsterRows.filter((m) => /invincible|whirlpool|shadow clone/i.test(m.version))).toEqual([]);
    for (const n of ['Vorkath', 'Zulrah', 'Abyssal demon', 'Chicken']) expect(names).toContain(n);
  });

  test('the engine and the worker have the same fights as the page', () => {
    // The engine's own list has a few entries twice.
    const keys = (list: { id: number, version: string }[]) => [...new Set(list.map((m) => `${m.id}:${m.version}`))].sort();
    expect(keys(fights)).toEqual(keys(monsterRows));
    expect(keys(engineMonsters)).toEqual(keys(monsterRows));
  });

  test('each fight has its own key', () => {
    const keys = monsterRows.map((m) => `${m.id}:${m.version}`);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  // Hitpoints are checked before scaling: the engine scales Theatre of Blood monsters to the party,
  // and the stat block shows the Wiki's full figure.
  test('the stat block shows the stats the engine fights with', () => {
    const SKILLS = ['atk', 'str', 'def', 'magic', 'ranged'] as const;
    const DEFENCES = ['stab', 'slash', 'crush', 'magic', 'light', 'standard', 'heavy'] as const;
    const wrong: string[] = [];
    for (const row of monsterRows) {
      const { monster } = monsterByKey.get(`${row.id}:${row.version}`)!;
      const fought = scaleMonster(monster);
      const shown = [...row.skills, ...row.defence].join();
      const used = [monster.skills.hp, ...SKILLS.map((k) => fought.skills[k]), ...DEFENCES.map((d) => fought.defensive[d] ?? 0)].join();
      if (shown !== used) wrong.push(`${row.name} ${row.version}: ${shown} / ${used}`);
    }
    expect(wrong).toEqual([]);
  });
});
