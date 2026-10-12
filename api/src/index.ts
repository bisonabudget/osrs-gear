// Fetches a player's hiscores for the site. Browsers can't read the hiscores from another site,
// so the site asks this Worker instead. Each name is kept for 10 minutes, so looking it up again
// doesn't reach the hiscores, and each visitor gets a few lookups a minute.
//
// Names are kept in memory, which lasts while Cloudflare keeps this copy of the Worker running, and
// in Cloudflare's cache, which only works once the Worker has its own domain (not on workers.dev).

const HISCORES = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json';
const USER_AGENT = 'osrs-gear (github.com/tristanbowdenfreeman-maker/osrs-gear)';
// How long a player's levels are kept, and how long "no such player" is.
const FOUND_SECONDS = 600;
const MISSING_SECONDS = 60;

export interface Env {
  ALLOWED_ORIGINS: string;
  /** Missing if the plan doesn't have rate limiting, when lookups go unlimited. */
  LOOKUPS?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
}

/** What the Worker uses from outside, swapped for stand-ins in the tests. */
export interface Outside {
  fetch: typeof fetch;
  cache: Pick<Cache, 'match' | 'put'>;
  now: () => number;
}

// Names looked up lately, by cache key: the reply, its status and when it stops being used.
const memory = new Map<string, { body: string, status: number, until: number }>();
const MEMORY_SIZE = 5000;

const remember = (key: string, body: string, status: number, seconds: number, now: number) => {
  if (memory.size >= MEMORY_SIZE) memory.delete(memory.keys().next().value!);
  memory.set(key, { body, status, until: now + seconds * 1000 });
};

// Lookups each visitor has made this minute, counted in memory too. Cloudflare's own rate limit
// is approximate and was seen letting 30 quick lookups through, so this backs it up.
const LOOKUPS_A_MINUTE = 10;
const visitors = new Map<string, { count: number, from: number }>();

const withinLimit = (visitor: string, now: number) => {
  const seen = visitors.get(visitor);
  if (!seen || now - seen.from >= 60_000) {
    if (visitors.size >= MEMORY_SIZE) visitors.delete(visitors.keys().next().value!);
    visitors.set(visitor, { count: 1, from: now });
    return true;
  }
  seen.count += 1;
  return seen.count <= LOOKUPS_A_MINUTE;
};

/** Forgets every name and visitor kept in memory, for the tests. */
export const forget = () => {
  memory.clear();
  visitors.clear();
};

/** RuneScape names are 1 to 12 letters, numbers, spaces, hyphens or underscores. */
const validName = (text: string) => /^[A-Za-z0-9 _-]{1,12}$/.test(text);

const corsHeaders = (origin: string | null, env: Env): Record<string, string> => {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  return origin && allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
};

const json = (body: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', ...headers },
});

export const handle = async (request: Request, env: Env, outside: Outside): Promise<Response> => {
  const url = new URL(request.url);
  const cors = corsHeaders(request.headers.get('Origin'), env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });
  if (request.method !== 'GET' || url.pathname !== '/hiscores') return json({ error: 'Not found' }, 404, cors);

  const name = (url.searchParams.get('player') ?? '').trim();
  if (!validName(name)) return json({ error: 'Not a RuneScape name' }, 400, cors);

  const visitor = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const now = outside.now();
  const allowed = withinLimit(visitor, now) && (env.LOOKUPS ? (await env.LOOKUPS.limit({ key: visitor })).success : true);
  if (!allowed) return json({ error: 'Too many lookups' }, 429, { ...cors, 'Retry-After': '60' });

  // Names are the same player whatever their case, and spaces, hyphens and underscores match.
  const id = `https://hiscores.cache/${encodeURIComponent(name.toLowerCase().replace(/[ _-]/g, '_'))}`;
  const key = new Request(id);
  const inMemory = memory.get(id);
  if (inMemory && inMemory.until > now) {
    return new Response(inMemory.body, { status: inMemory.status, headers: { 'Content-Type': 'application/json', ...cors, 'X-Cache': 'hit' } });
  }
  const kept = await outside.cache.match(key);
  if (kept) {
    const body = await kept.text();
    remember(id, body, kept.status, kept.status === 404 ? MISSING_SECONDS : FOUND_SECONDS, now);
    return new Response(body, { status: kept.status, headers: { 'Content-Type': 'application/json', ...cors, 'X-Cache': 'hit' } });
  }

  const reply = await outside.fetch(`${HISCORES}?player=${encodeURIComponent(name)}`, { headers: { 'User-Agent': USER_AGENT } })
    .catch(() => null);
  if (reply?.status === 404) {
    remember(id, JSON.stringify({ error: 'Not on the hiscores' }), 404, MISSING_SECONDS, now);
    await outside.cache.put(key, json({ error: 'Not on the hiscores' }, 404, { 'Cache-Control': `max-age=${MISSING_SECONDS}` }));
    return json({ error: 'Not on the hiscores' }, 404, cors);
  }
  if (!reply?.ok) return json({ error: "The hiscores didn't answer" }, 502, cors);

  const body = await reply.text();
  remember(id, body, 200, FOUND_SECONDS, now);
  await outside.cache.put(key, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${FOUND_SECONDS}` } }));
  return new Response(body, { headers: { 'Content-Type': 'application/json', ...cors, 'X-Cache': 'miss' } });
};

export default {
  // Cloudflare's fetch and cache only work when called on their own objects, hence the arrows.
  fetch: (request: Request, env: Env) => handle(request, env, {
    fetch: (input, init) => fetch(input, init),
    cache: { match: (key) => caches.default.match(key), put: (key, value) => caches.default.put(key, value) },
    now: () => Date.now(),
  }),
} satisfies ExportedHandler<Env>;
