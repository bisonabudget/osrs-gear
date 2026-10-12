// Builds src/data/items.json and src/data/monsters.json from the Wiki DPS calculator's data,
// the GE item list and the Wiki's categories (bosses, quests and where each item comes from).
// It also writes the calculator's own item and monster files cut down to what the site uses,
// which the site is built with in their place.
// Run with: node scripts/build-data.ts
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import equipmentAliases from '../vendor/osrs-dps-calc/src/lib/EquipmentAliases.ts';
import { PROTECTIVE_ITEMS } from '../src/protection.ts';

const ROOT = join(import.meta.dirname, '..');
const ENGINE = join(ROOT, 'vendor/osrs-dps-calc');
const OUT = join(ROOT, 'src/data');
const USER_AGENT = 'osrs-gear (github.com/tristanbowdenfreeman-maker/osrs-gear)';

interface Equipment {
  name: string; id: number; version: string; slot: string; image: string; speed: number; category: string;
  bonuses: Record<string, number>; offensive: Record<string, number>; defensive: Record<string, number>;
  isTwoHanded: boolean;
}
interface Monster {
  id: number; name: string; version: string; image: string; level: number; size: number; speed: number;
  style: string[] | null; skills: Record<string, number>; offensive: Record<string, number>;
  defensive: Record<string, number | null>; attributes: string[]; immunities: { burn: string | null };
  weakness: { element: string, severity: number } | null; is_slayer_monster: boolean;
}

// When the Wiki says to slow down, wait as long as it asks (or longer each time) and try again.
const getJson = async <T>(url: string): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return res.json() as Promise<T>;
    if ((res.status !== 429 && res.status !== 503) || attempt === 6) throw new Error(`${url}: ${res.status}`);
    const wait = Number(res.headers.get('retry-after')) || 10 * attempt;
    await new Promise((resolve) => { setTimeout(resolve, wait * 1000); });
  }
};

const categoryMembers = async (category: string): Promise<string[]> => {
  const titles: string[] = [];
  let next: string | undefined;
  do {
    const url = 'https://oldschool.runescape.wiki/api.php?action=query&list=categorymembers&cmlimit=500&cmnamespace=0'
      + `&format=json&cmtitle=${encodeURIComponent(`Category:${category}`)}${next ? `&cmcontinue=${next}` : ''}`;
    const data = await getJson<{ query: { categorymembers: { title: string }[] }, continue?: { cmcontinue: string } }>(url);
    titles.push(...data.query.categorymembers.map((m) => m.title));
    next = data.continue?.cmcontinue;
  } while (next);
  return titles;
};

// The categories of each page, following redirects. A missing page has none.
const pageCategories = async (titles: string[]): Promise<Map<string, string[]>> => {
  const out = new Map<string, string[]>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url = 'https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=categories&cllimit=max'
      + `&clshow=!hidden&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`;
    const redirect = new Map<string, string>();
    const categories = new Map<string, string[]>();
    let next: string | undefined;
    do {
      const data = await getJson<{
        query: { normalized?: { from: string, to: string }[], redirects?: { from: string, to: string }[], pages: Record<string, { title: string, categories?: { title: string }[] }> },
        continue?: { clcontinue: string },
      }>(`${url}${next ? `&clcontinue=${encodeURIComponent(next)}` : ''}`);
      for (const r of [...(data.query.normalized ?? []), ...(data.query.redirects ?? [])]) redirect.set(r.from, r.to);
      for (const page of Object.values(data.query.pages)) {
        const found = (page.categories ?? []).map((c) => c.title.replace(/^Category:/, ''));
        categories.set(page.title, [...(categories.get(page.title) ?? []), ...found]);
      }
      next = data.continue?.clcontinue;
    } while (next);
    for (const title of batch) {
      let t = title;
      for (let hops = 0; hops < 3 && redirect.has(t); hops += 1) t = redirect.get(t)!;
      out.set(title, categories.get(t) ?? []);
    }
  }
  return out;
};

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8'));

// ---------------------------------------------------------------- items

const equipment = readJson<Equipment[]>(join(ENGINE, 'cdn/json/equipment.json'));
// Maps each cosmetic or variant item id to the item the engine treats it as.
const aliases = readJson<Record<string, number>>(join(ENGINE, 'cdn/json/equipment_aliases.json'));
const geItems = await getJson<{ id: number, name: string }[]>('https://prices.runescape.wiki/api/v1/osrs/mapping');
const geIds = new Set(geItems.map((i) => i.id));
const geIdByName = new Map(geItems.map((i) => [i.name.toLowerCase(), i.id]));

// Items the engine treats specially by name: every string in its source that is an item name,
// plus names containing a string it matches with includes/startsWith/endsWith.
const engineSource = ['src/lib', 'src/lib/dists', 'src/lib/scaling']
  .flatMap((dir) => readdirSync(join(ENGINE, dir)).filter((f) => f.endsWith('.ts')).map((f) => join(ENGINE, dir, f)))
  .concat(join(ENGINE, 'src/utils.ts'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
const literals = new Set([...engineSource.matchAll(/'((?:[^'\\\n]|\\.)+)'|"([^"\n]+)"/g)].map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'")));
const namePatterns = [...engineSource.matchAll(/\.(?:includes|startsWith|endsWith)\('([^']+)'\)/g)].map((m) => m[1]);
const isSpecial = (name: string) => literals.has(name) || namePatterns.some((p) => name.includes(p));

const aliasIds = new Set(Object.keys(aliases).map(Number));
// Copies that only exist in other game modes, minigames or the Gauntlet, or can't be used as they are.
const JUNK_NAME = /\((?:nz|cr|bh|Deadman|basic|attuned|perfected|beta|Last Man Standing|l)\)$|^Corrupted |\(Deadman Mode\)/i;
const JUNK_VERSION = /^(?:Locked|Broken|Inactive|Uncharged|Empty|Deadman Mode|Trailblazer|Trailblazer Reloaded|Cosmetic|Charged and Locked|0|Partially charged|Unlit)$/i;
const VERSION_ORDER = ['Charged', 'Active', 'Activated', 'Restored', 'Repaired', 'Undamaged', 'Full', 'Normal', '', '100'];

const offenceScore = (e: Equipment) => Object.values(e.offensive).reduce((a, b) => a + b, 0)
  + e.bonuses.str + e.bonuses.ranged_str + e.bonuses.magic_str;
// An item with no attack or strength bonus can't raise DPS (elegant clothes, team capes, plain
// armour), unless the engine does more with it than add up its stats.
const addsToAttacks = (e: Equipment) => Object.values(e.offensive).some((v) => v > 0)
  || e.bonuses.str > 0 || e.bonuses.ranged_str > 0 || e.bonuses.magic_str > 0;
// Two items with the same key do the same for DPS, unless the engine treats one of them specially.
const statsKey = (e: Equipment) => JSON.stringify([
  e.slot, e.offensive, e.bonuses.str, e.bonuses.ranged_str, e.bonuses.magic_str,
  ...(e.slot === 'weapon' ? [e.speed, e.category, e.isTwoHanded] : []),
]);

const byName = new Map<string, Equipment[]>();
for (const e of equipment) {
  // A weapon with no category has no attack styles (broken tools, event toys), and an "Unarmed"
  // one is a quest or minigame item held in the hands.
  const notAWeapon = e.slot === 'weapon' && (!e.category || e.category === 'Unarmed' || e.speed <= 0);
  if (aliasIds.has(e.id) || JUNK_NAME.test(e.name) || notAWeapon) continue;
  byName.set(e.name, [...(byName.get(e.name) ?? []), e]);
}

// Untradeable items that only work in Leagues, Deadman, an event, a minigame or the Gauntlet, or
// that can no longer be got. Barbarian Assault and Castle Wars arrows only work in those games.
const itemCategories = await pageCategories([...byName.keys()]);
const NOT_MAIN_GAME = /League$|^Discontinued content$|^Event rewards$|^Deadman|^Emir's Arena$|^Bounty Hunter$|^The Gauntlet$|^Clan Wars$|^Quest Speedrunning$/;
const MINIGAME_AMMO = /^Barbarian Assault$|^Castle Wars$/;
const notInMainGame = (e: Equipment) => {
  const categories = itemCategories.get(e.name) ?? [];
  if (categories.includes('Tradeable items')) return false;
  return categories.some((c) => NOT_MAIN_GAME.test(c) || (e.slot === 'ammo' && MINIGAME_AMMO.test(c)));
};

// One way to get an untradeable item: the GE items and coins it takes. A way that needs
// something earned in game (a drop, a reward or points) is marked, and what's earned is free.
interface Way { parts?: [number, number][], coins?: number, earned?: 1, text: string }

// The levels an item needs before it can be worn, by skill. "combat" is the combat level.
type Needs = Record<string, number>;

// The page shows names, icons and slots without loading the engine's data, so rows carry them.
// An untradeable with no ways is earned in game and costs nothing.
interface ItemRow {
  id: number, name: string, slot: string, image: string, priceId: number | null, ways?: Way[], needs?: Needs, special?: 1
}
const items: ItemRow[] = [];
const tradeableStats = new Map<string, string[]>(); // stats -> tradeable names, to spot untradeable copies
const chosen: { e: Equipment, priceId: number | null }[] = [];
const outside: string[] = [];

for (const [name, versions] of byName) {
  const usable = versions.filter((e) => !JUNK_VERSION.test(e.version));
  if (!usable.length) continue;
  usable.sort((a, b) => offenceScore(b) - offenceScore(a)
    || rank(a.version) - rank(b.version));
  const e = usable[0];
  // An item's price is its own, or a GE-traded version of the same item (a charged weapon is
  // priced as the uncharged one), or for an imbued "(i)" item the item before imbuing.
  const tradeable = versions.find((v) => geIds.has(v.id));
  const priceId = geIds.has(e.id) ? e.id
    : tradeable?.id ?? geIdByName.get(name.toLowerCase()) ?? geIdByName.get(name.replace(/ ?\((?:i|ei)\)$/, '').toLowerCase()) ?? null;
  if (priceId === null && notInMainGame(e)) {
    outside.push(name);
    continue;
  }
  chosen.push({ e, priceId });
  if (priceId !== null) tradeableStats.set(statsKey(e), [...(tradeableStats.get(statsKey(e)) ?? []), name]);
}

function rank(version: string) {
  const i = VERSION_ORDER.indexOf(version);
  return i === -1 ? VERSION_ORDER.length : i;
}

// Untradeable copies of an item, like ornament kit, clan and colour versions, would otherwise
// count as free. One with the same stats as a GE item is dropped (for an item the engine treats
// specially, only when its name contains the GE item's name), and of several untradeables with
// the same stats one is kept. One the engine names exactly, like the Eldritch Nightmare staff or
// the Slayer's staff (e), does something its GE version doesn't, so it is always kept.
const baseName = (name: string) => name.replace(/ \([^)]*\)/g, '').toLowerCase();
const isCopyOfTradeable = (e: Equipment, special: boolean) => !literals.has(e.name)
  && (tradeableStats.get(statsKey(e)) ?? []).some((n) => !special || e.name.toLowerCase().includes(baseName(n)));
const keptUntradeable = new Set<string>();
let copies = 0;
let noOffence = 0;
chosen.sort((a, b) => a.e.name.length - b.e.name.length);
for (const { e, priceId } of chosen) {
  const special = isSpecial(e.name);
  // Protection is worn for what it does against a monster, so it is kept whatever its stats.
  const protective = PROTECTIVE_ITEMS.has(e.name);
  if (!special && !protective && !addsToAttacks(e)) {
    noOffence += 1;
    continue;
  }
  if (priceId === null && !protective) {
    const key = statsKey(e);
    if (isCopyOfTradeable(e, special) || (!special && keptUntradeable.has(key))) {
      copies += 1;
      continue;
    }
    if (!special) keptUntradeable.add(key);
  }
  items.push({ id: e.id, name: e.name, slot: e.slot, image: e.image, priceId, ...(special ? { special: 1 as const } : {}) });
}
items.sort((a, b) => a.id - b.id);

// ---------------------------------------------------------------- untradeable costs

// Untradeables made from GE items (Avernic treads, Ferocious gloves) or sold for coins (Barrows
// gloves, the max cape) cost what goes into them. The Wiki's recipes and shops say what that is.
interface Recipe { materials: { name: string, qty: number }[], made: number }
const recipes = new Map<string, Recipe[]>();
const shops = new Map<string, Map<string, number>>(); // item -> shop -> coins
// This shop only sells back items the player has already earned.
const RESTOCK_SHOPS = new Set(['Lost Property shop']);
const MAX_WAYS = 6;

const bucket = async (name: string, fields: string[], key: string, values: string[]) => {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < values.length; i += 40) {
    const or = values.slice(i, i + 40).map((v) => `{'${key}',${JSON.stringify(v)}}`).join(',');
    const query = `bucket('${name}').select(${fields.map((f) => `'${f}'`).join(',')}).where(bucket.Or(${or})).limit(5000).run()`;
    const data = await getJson<{ bucket: Record<string, string>[], error?: string }>(
      `https://oldschool.runescape.wiki/api.php?action=bucket&format=json&query=${encodeURIComponent(query)}`,
    );
    if (data.error) throw new Error(`${query}: ${data.error}`);
    rows.push(...data.bucket);
  }
  return rows;
};

const quantity = (text: string) => Number(String(text).replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0] ?? 1);
const isGe = (name: string) => geIdByName.has(name.toLowerCase());

// The recipes and coin shops of the untradeables, then of the untradeables they're made from.
const looked = new Set<string>();
let toLook = items.filter((i) => i.priceId === null).map((i) => i.name);
while (toLook.length) {
  const batch = [...new Set(toLook)].filter((n) => !looked.has(n.toLowerCase()));
  batch.forEach((n) => looked.add(n.toLowerCase()));
  if (!batch.length) break;
  const [recipeRows, shopRows] = await Promise.all([
    bucket('recipe', ['page_name', 'production_json'], 'page_name', batch),
    bucket('storeline', ['page_name', 'sold_item', 'store_sell_price', 'store_currency'], 'sold_item', batch),
  ]);
  toLook = [];
  for (const row of recipeRows) {
    const p = JSON.parse(row.production_json) as { materials?: { name: string, quantity: string }[], output?: { name?: string, quantity?: string } };
    const materials = (p.materials ?? []).map((m) => ({ name: m.name, qty: quantity(m.quantity) }));
    // A recipe with no materials is a drop or a reward, not something made.
    if (!materials.length) continue;
    const key = (p.output?.name ?? row.page_name).toLowerCase();
    recipes.set(key, [...(recipes.get(key) ?? []), { materials, made: quantity(p.output?.quantity ?? '1') }]);
    toLook.push(...materials.filter((m) => m.name !== 'Coins' && !isGe(m.name)).map((m) => m.name));
  }
  for (const row of shopRows) {
    const gp = Number(row.store_sell_price);
    if (row.store_currency !== 'Coins' || RESTOCK_SHOPS.has(row.page_name) || !(gp > 0)) continue;
    const key = row.sold_item.toLowerCase();
    const sold = shops.get(key) ?? new Map<string, number>();
    // A shop with two prices gives a discount for something, like an achievement diary; use the full price.
    sold.set(row.page_name, Math.max(sold.get(row.page_name) ?? 0, gp));
    shops.set(key, sold);
  }
}

// What a way takes in the end: GE items by id, coins, and whether anything earned goes in.
interface Bag { parts: Map<number, number>, coins: number, earned: boolean }
const bagKey = (b: Bag) => JSON.stringify([[...b.parts].sort((x, y) => x[0] - y[0]), b.coins, b.earned]);
const isFree = (b: Bag) => !b.parts.size && !b.coins;
// Bag a needs no more of anything than bag b, so b is never the better way.
const covers = (a: Bag, b: Bag) => (!a.earned || b.earned) && a.coins <= b.coins
  && [...a.parts].every(([id, n]) => (b.parts.get(id) ?? 0) >= n);
const keepBest = <T>(list: T[], bagOf: (t: T) => Bag): T[] => {
  const seen = new Set<string>();
  const unique = list.filter((t) => !seen.has(bagKey(bagOf(t))) && seen.add(bagKey(bagOf(t))));
  return unique.filter((t, i) => !unique.some((u, j) => j !== i && covers(bagOf(u), bagOf(t)))).slice(0, MAX_WAYS);
};
const scale = (b: Bag, n: number): Bag => ({
  parts: new Map([...b.parts].map(([id, q]) => [id, q * n])), coins: b.coins * n, earned: b.earned,
});
const add = (a: Bag, b: Bag): Bag => {
  const parts = new Map(a.parts);
  for (const [id, n] of b.parts) parts.set(id, (parts.get(id) ?? 0) + n);
  return { parts, coins: a.coins + b.coins, earned: a.earned || b.earned };
};

// Every way to get one of the item. An item with no recipe and no shop is earned. A recipe that
// leads back to an item already being made is skipped, so a crystal helm isn't made from a
// crystal helm (Amlodd) made from a crystal helm.
const waysOf = (name: string, making: Set<string>): { bag: Bag, text: string }[] => {
  const key = name.toLowerCase();
  if (isGe(name)) return [{ bag: { parts: new Map([[geIdByName.get(key)!, 1]]), coins: 0, earned: false }, text: '' }];
  if (making.has(key)) return [];
  const own = recipes.get(key) ?? [];
  const sold = shops.get(key);
  if (!own.length && !sold) return [{ bag: { parts: new Map(), coins: 0, earned: true }, text: '' }];
  const found: { bag: Bag, text: string }[] = [];
  if (sold) {
    const [shop, gp] = [...sold].sort((a, b) => a[1] - b[1])[0];
    found.push({ bag: { parts: new Map(), coins: gp, earned: false }, text: `Sold by ${shop}` });
  }
  const inner = new Set(making).add(key);
  for (const recipe of own) {
    let bags: Bag[] = [{ parts: new Map(), coins: 0, earned: false }];
    for (const m of recipe.materials) {
      const options = m.name === 'Coins'
        ? [{ parts: new Map(), coins: m.qty, earned: false }]
        : waysOf(m.name, inner).map((w) => scale(w.bag, m.qty));
      bags = keepBest(bags.flatMap((b) => options.map((o) => add(b, o))), (b) => b);
      if (!bags.length) break;
    }
    const text = `Made from ${listOf(recipe.materials.map((m) => {
      if (m.name === 'Coins') return `${m.qty.toLocaleString('en-GB')} coins`;
      return m.qty === 1 ? m.name : `${m.qty.toLocaleString('en-GB')} × ${m.name}`;
    }))}`;
    found.push(...bags.map((b) => ({ bag: scale(b, 1 / recipe.made), text })));
  }
  return keepBest(found, (f) => f.bag);
};

function listOf(names: string[]) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

let costed = 0;
for (const item of items) {
  if (item.priceId !== null) continue;
  const ways = waysOf(item.name, new Set());
  if (!ways.length || (ways.length === 1 && isFree(ways[0].bag))) continue;
  item.ways = ways.map(({ bag, text }) => ({
    ...(bag.parts.size ? { parts: [...bag.parts].map(([id, n]) => [id, +n.toFixed(4)] as [number, number]) } : {}),
    ...(bag.coins ? { coins: +bag.coins.toFixed(2) } : {}),
    ...(bag.earned ? { earned: 1 as const } : {}),
    text,
  }));
  costed += 1;
}

// ---------------------------------------------------------------- requirements

// Most items' requirements come from the game's own item data. scripts/requirements.json has the
// ones it leaves out or gets wrong, checked against the Wiki, and wins where both have an item.
const DUMP = 'https://raw.githubusercontent.com/Joshua-F/osrs-dumps/master/config/dump.obj';
// Each requirement is two params: the skill, then the level.
const REQUIREMENT_PARAMS = [[434, 436], [435, 437], [191, 613], [579, 614], [610, 615], [611, 616], [612, 617]];
const SKILL_KEYS: Record<string, string> = {
  attack: 'atk', strength: 'str', defence: 'def', ranged: 'ranged', magic: 'magic', prayer: 'prayer',
  hitpoints: 'hp', agility: 'agility', slayer: 'slayer',
};
const dumpReply = await fetch(DUMP, { headers: { 'User-Agent': USER_AGENT } });
if (!dumpReply.ok) throw new Error(`${DUMP}: ${dumpReply.status}`);
const gameNeeds = new Map<number, Needs>();
for (const entry of (await dumpReply.text()).split(/^\/\/ (?=\d+$)/m).slice(1)) {
  const params = new Map([...entry.matchAll(/^param=param_(\d+),(.*)$/gm)].map((m) => [Number(m[1]), m[2]]));
  if (!REQUIREMENT_PARAMS.some(([skill]) => params.has(skill))) continue;
  const needs: Needs = {};
  for (const [skill, level] of REQUIREMENT_PARAMS) {
    // The game also lists skills used to make or use an item (Crafting, Woodcutting); only wearing counts here.
    const key = SKILL_KEYS[params.get(skill) ?? ''];
    const value = Number(params.get(level));
    if (key && value > 1) needs[key] = value;
  }
  gameNeeds.set(parseInt(entry, 10), needs);
}
const checked = new Map(readJson<{ id: number, needs: Needs }[]>(join(ROOT, 'scripts/requirements.json')).map((r) => [r.id, r.needs]));
const unchecked: string[] = [];
for (const item of items) {
  const needs = checked.get(item.id) ?? gameNeeds.get(item.id);
  if (!needs) unchecked.push(item.name);
  else if (Object.keys(needs).length) item.needs = needs;
}
if (unchecked.length) {
  console.warn(`No requirements known for ${unchecked.length} items, so anyone can wear them. Add them to `
    + `scripts/requirements.json: ${unchecked.join(', ')}`);
}

// ---------------------------------------------------------------- monsters

const monsters = readJson<Monster[]>(join(ENGINE, 'cdn/json/monsters.json'));
const [bosses, quests] = await Promise.all([categoryMembers('Bosses'), categoryMembers('Quests')]);
const bossNames = new Set(bosses);
// Slayer monsters that are in the Wiki's boss category for a quest version of them.
const NOT_BOSSES = new Set(['Black demon', 'Ice demon', 'Grey golem', 'Black golem', 'White golem']);
const questNames = quests.map((q) => q.toLowerCase());

const isQuestCopy = (m: Monster) => {
  const v = m.version.toLowerCase();
  if (/post-quest/.test(v)) return false;
  return /\b(?:quest|cutscene|tutorial)\b/.test(v) || questNames.some((q) => v === q || v.startsWith(`${q},`) || v.startsWith(`${q} (`));
};
const fightKey = (m: Monster) => JSON.stringify([m.level, m.size, m.skills, m.defensive, m.attributes, m.immunities, m.weakness]);
const DEFAULT_VERSIONS = ['', 'Standard', 'Normal', 'Regular', 'Post-quest'];

// Monsters that can't be fought to the death: hunter creatures and implings are caught, scenery
// and the forms below can't be damaged, the Sire's tentacles are only stunned, and a monster with
// 1 hitpoint dies to any hit, so gear makes no difference.
const monsterCategories = await pageCategories([...new Set(monsters.map((m) => m.name))]);
const CANT_DAMAGE = /\b(?:invincible|whirlpool|shadow clone)\b/i;
// Charged or held back during a fight, never killed.
const NOT_KILLED = new Set(['Tentacle (Abyssal Sire)', 'Totem (The Nightmare)', "Totem (Phosani's Nightmare)"]);
let notKillable = 0;
const killable = (m: Monster) => {
  const categories = monsterCategories.get(m.name) ?? [];
  return m.skills.hp > 1 && !/ impling$/i.test(m.name) && !NOT_KILLED.has(m.name) && !CANT_DAMAGE.test(m.version)
    && !categories.some((c) => c === 'Hunter creatures' || c === 'Scenery');
};

const byMonsterName = new Map<string, Monster[]>();
for (const m of monsters) {
  if (!(m.skills?.hp > 0) || isQuestCopy(m)) continue;
  if (!killable(m)) {
    notKillable += 1;
    continue;
  }
  byMonsterName.set(m.name, [...(byMonsterName.get(m.name) ?? []), m]);
}

interface MonsterRow {
  id: number, version: string, name: string, label: string, level: number, image: string, slayer?: 1, boss?: 1,
  size: number, speed: number,
  /** Hitpoints, Attack, Strength, Defence, Magic and Ranged levels. */
  skills: number[],
  /** Attack, strength, magic, magic strength, ranged and ranged strength bonuses. */
  offence: number[],
  /** Stab, slash, crush, magic, light, standard and heavy defence bonuses. */
  defence: number[], armour?: number, attacks?: string[],
  weakness?: { element: string, severity: number }, attributes?: string[], burn?: string,
}
const DEFENCES = ['stab', 'slash', 'crush', 'magic', 'light', 'standard', 'heavy'];
const SKILLS = ['hp', 'atk', 'str', 'def', 'magic', 'ranged'];
const OFFENCES = ['atk', 'str', 'magic', 'magic_str', 'ranged', 'ranged_str'];

// The ways a monster attacks, written the same way each time ("Typeless slash", not "Typeless Slash").
const attacksOf = (style: string[] | null) => [...new Set((style ?? [])
  .flatMap((s) => s.split(/<br\s*\/?>/))
  .map((s) => s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').replace(/,$/, '').trim())
  .filter((s) => s && !/^(?:n\/a|none)$/i.test(s))
  .map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase()))];
// Stats the engine works out as a fight starts, where its data has 0 or another phase's value:
// Vardorvis's Strength and Defence at full health, and Yama's magic defence when tanked with
// magic. tests/data.test.ts checks these against the engine.
const FIGHT_START: Record<string, { skills?: Record<string, number>, defensive?: Record<string, number> }> = {
  'Vardorvis:Post-quest': { skills: { str: 270, def: 215 } },
  'Vardorvis:Awakened': { skills: { str: 391, def: 268 } },
  'Yama:Normal': { defensive: { magic: 60 } },
};
const monsterRows: MonsterRow[] = [];
for (const [name, versions] of byMonsterName) {
  // Versions with the same stats are the same fight in different places; keep one of each.
  const fights = new Map<string, Monster>();
  const preferred = [...versions].sort((a, b) => versionRank(a.version) - versionRank(b.version));
  for (const m of preferred) if (!fights.has(fightKey(m))) fights.set(fightKey(m), m);
  const kept = [...fights.values()].sort((a, b) => a.level - b.level);
  const levelCount = (level: number) => kept.filter((k) => k.level === level).length;
  for (const m of kept) {
    const start = FIGHT_START[`${name}:${m.version}`];
    const skills = { ...m.skills, ...start?.skills };
    const defensive = { ...m.defensive, ...start?.defensive };
    let label = kept.length > 1 ? cleanLabel(m.version, m.level) : '';
    // A bare number only tells apart versions that the combat level already does.
    if (/^\d+$/.test(label) && levelCount(m.level) === 1) label = '';
    monsterRows.push({
      id: m.id,
      version: m.version,
      name,
      label,
      level: m.level,
      image: m.image,
      ...(m.is_slayer_monster ? { slayer: 1 as const } : {}),
      ...(bossNames.has(name) && !NOT_BOSSES.has(name) ? { boss: 1 as const } : {}),
      size: m.size,
      speed: m.speed,
      skills: SKILLS.map((k) => skills[k] ?? 0),
      offence: OFFENCES.map((k) => m.offensive[k] ?? 0),
      defence: DEFENCES.map((d) => defensive[d] ?? 0),
      ...(m.defensive.flat_armour ? { armour: m.defensive.flat_armour } : {}),
      ...(attacksOf(m.style).length ? { attacks: attacksOf(m.style) } : {}),
      ...(m.weakness?.severity ? { weakness: m.weakness } : {}),
      ...(m.attributes.length ? { attributes: m.attributes } : {}),
      ...(m.immunities?.burn ? { burn: m.immunities.burn } : {}),
    });
  }
}

// The normal fight first, so it is the one kept when another version has the same stats.
function versionRank(version: string) {
  if (DEFAULT_VERSIONS.includes(version)) return 0;
  return /\bnormal\b/i.test(version) ? 1 : 2;
}

// "Level 13" repeats the combat level shown next to every result, and "Post-quest" means the normal fight.
function cleanLabel(version: string, level: number) {
  return version
    .replace(new RegExp(`^Level ${level}\\b ?`), '')
    .replace(/^Post-quest\b/, '')
    .replace(/^[\s,]+/, '')
    .replace(/^\((.*)\)$/, '$1')
    .trim();
}

// The engine swaps a recoloured or locked item for its base item, so those come too.
const canonical = new Map<number, number>();
for (const [base, variants] of Object.entries(equipmentAliases as Record<string, number[]>)) {
  for (const v of variants) if (!canonical.has(v)) canonical.set(v, Number(base));
}
const engineIds = new Set(items.flatMap((i) => [i.id, canonical.get(i.id) ?? i.id]));
const fightIds = new Set(monsterRows.map((m) => `${m.id}:${m.version}`));

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'items.json'), `${JSON.stringify(items)}\n`);
writeFileSync(join(OUT, 'monsters.json'), `${JSON.stringify(monsterRows)}\n`);
// The worker only needs to tell the fights apart; the page has the rest.
writeFileSync(join(OUT, 'fights.json'), `${JSON.stringify(monsterRows.map(({ id, version, name, label, level, image, slayer, boss }) => ({
  id, version, name, label, level, image, slayer, boss,
})))}\n`);
writeFileSync(join(OUT, 'engine-equipment.json'), `${JSON.stringify(equipment.filter((e) => engineIds.has(e.id)))}\n`);
writeFileSync(join(OUT, 'engine-monsters.json'), `${JSON.stringify(monsters.filter((m) => fightIds.has(`${m.id}:${m.version}`)))}\n`);
console.log(`items: ${items.length} (${items.filter((i) => i.priceId === null).length} untradeable, ${costed} of them with a cost, `
  + `${items.filter((i) => i.special).length} special, ${items.filter((i) => i.needs).length} with requirements; ${noOffence} with no attack or strength bonus, ${copies} untradeable copies `
  + `and ${outside.length} items outside the main game dropped)`);
console.log(`monsters: ${monsterRows.length} fights from ${monsters.length} entries, ${monsterRows.filter((m) => m.boss).length} bosses, `
  + `${notKillable} that can't be killed dropped`);
