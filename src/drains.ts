// Special attacks and spells that lower a monster's Defence (or Magic) before the fight, as the
// Wiki calculator has them. Each monster keeps its own.

export type DrainSpell = 'none' | 'vulnerability' | 'accursed';

export interface Drains {
  dwh: number;
  elderMaul: number;
  bgs: number;
  boneDagger: number;
  arclight: number;
  emberlight: number;
  tonalztic: number;
  seercull: number;
  ayak: number;
  spell: DrainSpell;
}

export type DrainCount = Exclude<keyof Drains, 'spell'>;

export const NO_DRAINS: Drains = {
  dwh: 0, elderMaul: 0, bgs: 0, boneDagger: 0, arclight: 0, emberlight: 0, tonalztic: 0, seercull: 0, ayak: 0, spell: 'none',
};

export interface DrainField {
  key: DrainCount;
  /** The weapon, also its Wiki image. */
  weapon: string;
  short: string;
  /** Whether the box takes hits landed or damage dealt. */
  counts: 'hits' | 'damage';
  max: number;
  note: string;
}

export const DRAIN_FIELDS: DrainField[] = [
  { key: 'dwh', weapon: 'Dragon warhammer', short: 'DWH', counts: 'hits', max: 10, note: 'Each hit lowers Defence by 30%.' },
  { key: 'elderMaul', weapon: 'Elder maul', short: 'Elder maul', counts: 'hits', max: 10, note: 'Each hit lowers Defence by 35%.' },
  {
    key: 'bgs', weapon: 'Bandos godsword', short: 'BGS', counts: 'damage', max: 200,
    note: 'Lowers Defence by the damage dealt, then Strength, Attack, Magic and Ranged with any left over.',
  },
  {
    key: 'boneDagger', weapon: 'Bone dagger', short: 'Bone dagger', counts: 'damage', max: 200,
    note: 'Lowers Defence by the damage dealt. Counted before the other specs.',
  },
  {
    key: 'arclight', weapon: 'Arclight', short: 'Arclight', counts: 'hits', max: 10,
    note: 'Each hit lowers Attack, Strength and Defence by 5% (10% on demons).',
  },
  {
    key: 'emberlight', weapon: 'Emberlight', short: 'Emberlight', counts: 'hits', max: 10,
    note: 'Each hit lowers Attack, Strength and Defence by 5% (15% on demons).',
  },
  {
    key: 'tonalztic', weapon: 'Tonalztics of Ralos', short: 'Tonalztics', counts: 'hits', max: 10,
    note: "Each hit lowers Defence by an eighth of the monster's Magic level.",
  },
  { key: 'seercull', weapon: 'Seercull', short: 'Seercull', counts: 'damage', max: 200, note: 'Lowers Magic by the damage dealt.' },
  { key: 'ayak', weapon: 'Eye of Ayak', short: 'Ayak', counts: 'damage', max: 200, note: 'Lowers magic defence by the damage dealt.' },
];

export const DRAIN_SPELLS: { key: DrainSpell, name: string, note: string }[] = [
  { key: 'none', name: 'No spell', note: '' },
  { key: 'vulnerability', name: 'Vulnerability', note: 'Lowers Defence by 10%.' },
  { key: 'accursed', name: 'Accursed', note: 'Lowers Defence and Magic by 15%.' },
];

/** The drains in a few words, like "DWH ×2, BGS 30", or null when there are none. */
export const drainSummary = (d: Drains): string | null => {
  const parts = DRAIN_FIELDS.filter((f) => d[f.key] > 0)
    .map((f) => (f.counts === 'hits' ? `${f.short} ×${d[f.key]}` : `${f.short} ${d[f.key]}`));
  const spell = DRAIN_SPELLS.find((s) => s.key === d.spell);
  if (spell && spell.key !== 'none') parts.push(spell.name);
  return parts.length ? parts.join(', ') : null;
};
