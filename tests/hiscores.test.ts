import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchHiscores, type HiscoresReply, readHiscores, validName } from '../src/hiscores';

// Shaped like a real index_lite.json reply, with the skills the site doesn't use left in.
const reply: HiscoresReply = {
  name: 'Iron Bob',
  skills: [
    { name: 'Overall', rank: 512_000, level: 1650, xp: 60_000_000 },
    { name: 'Attack', rank: 300_000, level: 80, xp: 1_986_068 },
    { name: 'Defence', rank: 310_000, level: 75, xp: 1_210_421 },
    // Too far down to be ranked, but the xp is still there.
    { name: 'Strength', rank: -1, level: 85, xp: 3_258_594 },
    { name: 'Hitpoints', rank: 280_000, level: 86, xp: 3_597_792 },
    { name: 'Ranged', rank: 250_000, level: 90, xp: 5_346_332 },
    { name: 'Prayer', rank: 400_000, level: 70, xp: 737_627 },
    { name: 'Magic', rank: 260_000, level: 88, xp: 4_385_776 },
    { name: 'Agility', rank: 330_000, level: 72, xp: 924_390 },
    { name: 'Slayer', rank: 210_000, level: 81, xp: 2_336_000 },
    { name: 'Cooking', rank: 600_000, level: 70, xp: 737_627 },
    { name: 'Mining', rank: -1, level: 1, xp: -1 },
    { name: 'Herblore', rank: 350_000, level: 78, xp: 1_629_200 },
    { name: 'Sailing', rank: -1, level: 1, xp: 0 },
  ],
};

describe('hiscores', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('reads the levels the site uses', () => {
    expect(readHiscores(reply)).toEqual({
      name: 'Iron Bob',
      skills: { atk: 80, str: 85, def: 75, ranged: 90, magic: 88, prayer: 70, hp: 86, agility: 72, slayer: 81, mining: 1, herblore: 78 },
      missing: ['Mining'],
    });
  });

  test('a Hitpoints level missing from the hiscores is at least 10', () => {
    const low = { ...reply, skills: reply.skills.map((s) => (s.name === 'Hitpoints' ? { ...s, rank: -1, level: 1, xp: -1 } : s)) };
    const { skills, missing } = readHiscores(low);
    expect(skills.hp).toBe(10);
    expect(missing).toEqual(['Hitpoints', 'Mining']);
  });

  test.each(['Lynx Titan', 'a', 'Iron_Bob-99', ' Zezima '])('accepts %s as an RSN', (name) => expect(validName(name)).toBe(true));
  test.each(['', 'thirteen char', 'bob!', 'zé'])('rejects "%s" as an RSN', (name) => expect(validName(name)).toBe(false));

  test('asks the dev server for the player', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(reply), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchHiscores(' Iron Bob ')).resolves.toMatchObject({ name: 'Iron Bob' });
    expect(fetch).toHaveBeenCalledWith('/hiscores?player=Iron%20Bob');
  });

  test('says when the player is not on the hiscores', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 404 })));
    await expect(fetchHiscores('Nobody')).rejects.toThrow("Can't find Nobody on the hiscores.");
  });

  test('says when there have been too many lookups', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(fetchHiscores('Iron Bob')).rejects.toThrow('Too many lookups. Try again in a minute.');
  });

  test.each([
    ['the network fails', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['the hiscores are down', () => Promise.resolve(new Response('busy', { status: 503 }))],
    ['the reply is not hiscores', () => Promise.resolve(new Response('{"error":true}', { status: 200 }))],
  ])('says to try again when %s', async (_, answer) => {
    vi.stubGlobal('fetch', vi.fn(answer));
    await expect(fetchHiscores('Iron Bob')).rejects.toThrow("The hiscores didn't answer.");
  });
});
