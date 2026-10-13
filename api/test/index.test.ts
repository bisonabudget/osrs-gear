import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Env, forget, handle, Outside } from '../src/index';

const SITE = 'https://tristanbowdenfreeman-maker.github.io';
const PLAYER = { name: 'Zezima', skills: [{ name: 'Attack', rank: 1, level: 99, xp: 13034431 }] };

// A rate limit that lets through `allowed` lookups, then says no.
const limiter = (allowed = Infinity) => {
  let used = 0;
  return { limit: vi.fn(async () => ({ success: (used += 1) <= allowed })) };
};

const env = (allowed?: number): Env => ({ ALLOWED_ORIGINS: `${SITE},http://localhost:5173`, LOOKUPS: limiter(allowed) });

// A stand-in for the hiscores and Cloudflare's cache. The cache keeps nothing, like on workers.dev.
const outside = (reply: () => Response | Promise<Response>, time = { now: 0 }): Outside & { fetch: ReturnType<typeof vi.fn> } => ({
  fetch: vi.fn(async () => reply()),
  cache: { match: async () => undefined, put: async () => undefined },
  now: () => time.now,
});

const ask = (player: string, init: RequestInit & { ip?: string } = {}) => new Request(
  `https://api.test/hiscores?player=${encodeURIComponent(player)}`,
  { ...init, headers: { Origin: SITE, 'CF-Connecting-IP': init.ip ?? '1.2.3.4' } },
);

beforeEach(forget);

describe('the hiscores lookup', () => {
  test('passes on a found player, with CORS for the site', async () => {
    const o = outside(() => Response.json(PLAYER));
    const reply = await handle(ask('Zezima'), env(), o);
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual(PLAYER);
    expect(reply.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(reply.headers.get('X-Cache')).toBe('miss');
    expect(o.fetch.mock.calls[0][1].headers['User-Agent']).toContain('osrs-gear');
  });

  test('gives no CORS header to other sites', async () => {
    const request = new Request('https://api.test/hiscores?player=Zezima', { headers: { Origin: 'https://other.site' } });
    const reply = await handle(request, env(), outside(() => Response.json(PLAYER)));
    expect(reply.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  test('answers the browser preflight', async () => {
    const reply = await handle(ask('Zezima', { method: 'OPTIONS' }), env(), outside(() => Response.json(PLAYER)));
    expect(reply.status).toBe(204);
  });

  test('turns down names RuneScape does not allow, without asking the hiscores', async () => {
    const o = outside(() => Response.json(PLAYER));
    for (const name of ['', 'thirteen char', 'bad!name']) expect((await handle(ask(name), env(), o)).status).toBe(400);
    expect(o.fetch).not.toHaveBeenCalled();
  });

  test('only answers /hiscores', async () => {
    const reply = await handle(new Request('https://api.test/other'), env(), outside(() => Response.json(PLAYER)));
    expect(reply.status).toBe(404);
  });

  test('keeps a player for 10 minutes, whatever the case or spacing', async () => {
    const time = { now: 0 };
    const o = outside(() => Response.json(PLAYER), time);
    await handle(ask('Iron Man'), env(), o);
    time.now = 9 * 60_000;
    const again = await handle(ask('iron_man'), env(), o);
    expect(again.headers.get('X-Cache')).toBe('hit');
    expect(await again.json()).toEqual(PLAYER);
    expect(o.fetch).toHaveBeenCalledTimes(1);
    time.now = 11 * 60_000;
    await handle(ask('Iron Man'), env(), o);
    expect(o.fetch).toHaveBeenCalledTimes(2);
  });

  test('keeps "no such player" for a minute', async () => {
    const time = { now: 0 };
    const o = outside(() => new Response('', { status: 404 }), time);
    expect((await handle(ask('Nobody'), env(), o)).status).toBe(404);
    expect((await handle(ask('Nobody'), env(), o)).status).toBe(404);
    expect(o.fetch).toHaveBeenCalledTimes(1);
    time.now = 61_000;
    await handle(ask('Nobody'), env(), o);
    expect(o.fetch).toHaveBeenCalledTimes(2);
  });

  test('says so when the hiscores fail, and does not keep the failure', async () => {
    const o = outside(() => new Response('', { status: 503 }));
    expect((await handle(ask('Zezima'), env(), o)).status).toBe(502);
    const down = outside(() => Promise.reject(new Error('offline')));
    expect((await handle(ask('Zezima'), env(), down)).status).toBe(502);
    await handle(ask('Zezima'), env(), o);
    expect(o.fetch).toHaveBeenCalledTimes(2);
  });

  test('stops a visitor after their lookups for the minute, with CORS so the site can say why', async () => {
    const e = env(10);
    const o = outside(() => Response.json(PLAYER));
    for (let i = 0; i < 10; i += 1) expect((await handle(ask(`Player${i}`), e, o)).status).toBe(200);
    const stopped = await handle(ask('Player10'), e, o);
    expect(stopped.status).toBe(429);
    expect(stopped.headers.get('Retry-After')).toBe('60');
    expect(stopped.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(e.LOOKUPS!.limit).toHaveBeenLastCalledWith({ key: '1.2.3.4' });
  });

  test('still limits a visitor when Cloudflare\'s rate limit lets everything through', async () => {
    const time = { now: 0 };
    const o = outside(() => Response.json(PLAYER), time);
    const e = { ALLOWED_ORIGINS: SITE };
    for (let i = 0; i < 10; i += 1) expect((await handle(ask(`Player${i}`), e, o)).status).toBe(200);
    expect((await handle(ask('Player10'), e, o)).status).toBe(429);
    expect((await handle(ask('Player10', { ip: '5.6.7.8' }), e, o)).status).toBe(200);
    time.now = 60_000;
    expect((await handle(ask('Player11'), e, o)).status).toBe(200);
  });
});

describe('the prices', () => {
  const LATEST = { 4151: { high: 1500000, highTime: 100, low: 1490000, lowTime: 100 } };
  const HOUR = { 4151: { avgHighPrice: 1495000, avgLowPrice: 1485000 } };
  const wiki = (url: string) => Response.json(url.endsWith('/latest') ? { data: LATEST } : { data: HOUR, timestamp: 3600 });
  const askPrices = () => new Request('https://api.test/prices', { headers: { Origin: SITE } });
  const pricesOutside = (reply: (url: string) => Response | Promise<Response>, time = { now: 0 }) => {
    const o = outside(() => new Response(''), time);
    o.fetch.mockImplementation(async (url: string) => reply(url));
    return o;
  };

  test('passes on the latest prices and the last hour, named as the site, with CORS', async () => {
    const o = pricesOutside(wiki);
    const reply = await handle(askPrices(), env(), o);
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ latest: LATEST, hour: HOUR, hourTime: 3600 });
    expect(reply.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(reply.headers.get('Cache-Control')).toBe('max-age=60');
    expect(o.fetch.mock.calls.map((c) => c[0])).toEqual([
      'https://prices.runescape.wiki/api/v1/osrs/latest',
      'https://prices.runescape.wiki/api/v1/osrs/1h',
    ]);
    expect(o.fetch.mock.calls[0][1].headers['User-Agent']).toContain('osrs-gear');
  });

  test('asks the Wiki at most once a minute, however many visitors come', async () => {
    const time = { now: 0 };
    const o = pricesOutside(wiki, time);
    await Promise.all([1, 2, 3].map(() => handle(askPrices(), env(), o)));
    expect((await handle(askPrices(), env(), o)).headers.get('X-Cache')).toBe('hit');
    expect(o.fetch).toHaveBeenCalledTimes(2);
    time.now = 60_000;
    await handle(askPrices(), env(), o);
    expect(o.fetch).toHaveBeenCalledTimes(4);
  });

  test('keeps giving the last prices when the Wiki stops answering', async () => {
    const time = { now: 0 };
    let up = true;
    const o = pricesOutside((url) => (up ? wiki(url) : new Response('', { status: 503 })), time);
    await handle(askPrices(), env(), o);
    up = false;
    time.now = 60_000;
    const reply = await handle(askPrices(), env(), o);
    expect(reply.status).toBe(200);
    expect(reply.headers.get('X-Cache')).toBe('stale');
    expect(await reply.json()).toEqual({ latest: LATEST, hour: HOUR, hourTime: 3600 });
  });

  test('shares the prices through Cloudflare\'s cache between copies of the Worker', async () => {
    const kept = new Map<string, Response>();
    const cache = {
      match: async (key: Request) => kept.get(key.url)?.clone(),
      put: async (key: Request, value: Response) => { kept.set(key.url, value); },
    };
    const time = { now: 0 };
    const o = { ...pricesOutside(wiki, time), cache };
    await handle(askPrices(), env(), o);
    forget(); // another copy of the Worker, with nothing in memory
    time.now = 30_000;
    const reply = await handle(askPrices(), env(), o);
    expect(reply.headers.get('X-Cache')).toBe('hit');
    expect(await reply.json()).toEqual({ latest: LATEST, hour: HOUR, hourTime: 3600 });
    expect(o.fetch).toHaveBeenCalledTimes(2);
    forget();
    time.now = 60_000;
    expect((await handle(askPrices(), env(), o)).headers.get('X-Cache')).toBe('miss');
    expect(o.fetch).toHaveBeenCalledTimes(4);
  });

  test('says so when the Wiki has never answered', async () => {
    const reply = await handle(askPrices(), env(), pricesOutside(() => Promise.reject(new Error('offline'))));
    expect(reply.status).toBe(502);
  });

  test('does not count against the hiscore lookups', async () => {
    const e = env(10);
    const o = pricesOutside(wiki);
    for (let i = 0; i < 20; i += 1) expect((await handle(askPrices(), e, o)).status).toBe(200);
    expect(e.LOOKUPS!.limit).not.toHaveBeenCalled();
  });
});
