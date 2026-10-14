// Grand Exchange prices from the Wiki's real-time prices API.
// https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices
// On the live site they come through the Cloudflare Worker in api/, which asks the Wiki at most
// once a minute for every visitor. If the Worker doesn't answer, the site says so and doesn't ask
// the Wiki itself, so visitors' browsers never add to the Wiki's load. The dev server, which has no
// Worker, asks the Wiki.
const API = 'https://prices.runescape.wiki/api/v1/osrs';
const SHARED = import.meta.env.VITE_API ? `${import.meta.env.VITE_API}/prices` : null;

export interface Price {
  gp: number;
  /** Unix seconds of the trade the price comes from, or of the end of the hour it averages. */
  time: number;
}

interface Latest { high: number | null, highTime: number | null, low: number | null, lowTime: number | null }
interface Hour { avgHighPrice: number | null, avgLowPrice: number | null }

// An instant-buy price older than this is stale, and the last hour's average is used instead.
const STALE_SECONDS = 2 * 60 * 60;

export const pickPrices = (
  latest: Record<string, Latest>,
  hour: Record<string, Hour>,
  hourTime: number,
  now: number,
): Map<number, Price> => {
  const prices = new Map<number, Price>();
  for (const [id, l] of Object.entries(latest)) {
    const h = hour[id];
    const fresh = l.high !== null && l.highTime !== null && now - l.highTime <= STALE_SECONDS;
    let price: Price | null = null;
    if (fresh) price = { gp: l.high!, time: l.highTime! };
    else if (h?.avgHighPrice) price = { gp: h.avgHighPrice, time: hourTime + 3600 };
    else if (l.high !== null) price = { gp: l.high, time: l.highTime ?? 0 };
    else if (l.low !== null) price = { gp: l.low, time: l.lowTime ?? 0 };
    if (price) prices.set(Number(id), price);
  }
  return prices;
};

interface Prices { latest: Record<string, Latest>, hour: Record<string, Hour>, hourTime: number }

/** Shown to visitors when the Worker doesn't answer. */
export const PRICES_DOWN = "Today's prices couldn't be loaded, as this site's price server isn't answering. "
  + "To keep load off the Wiki, the site doesn't ask the Wiki directly. Please try again in a minute.";

const fromWorker = async (url: string): Promise<Prices> => {
  const reply = await fetch(url).catch(() => null);
  if (!reply?.ok) throw new Error(PRICES_DOWN);
  return (reply.json() as Promise<Prices>).catch(() => { throw new Error(PRICES_DOWN); });
};

const fromWiki = async (): Promise<Prices> => {
  const [latest, hour] = await Promise.all([
    fetch(`${API}/latest`).then((r) => r.json() as Promise<{ data: Record<string, Latest> }>),
    fetch(`${API}/1h`).then((r) => r.json() as Promise<{ data: Record<string, Hour>, timestamp: number }>),
  ]);
  return { latest: latest.data, hour: hour.data, hourTime: hour.timestamp };
};

export const fetchPrices = async (): Promise<Map<number, Price>> => {
  const p = SHARED ? await fromWorker(SHARED) : await fromWiki();
  return pickPrices(p.latest, p.hour, p.hourTime, Date.now() / 1000);
};
