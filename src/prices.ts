// Grand Exchange prices from the Wiki's real-time prices API.
// https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices
const API = 'https://prices.runescape.wiki/api/v1/osrs';

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

export const fetchPrices = async (): Promise<Map<number, Price>> => {
  const [latest, hour] = await Promise.all([
    fetch(`${API}/latest`).then((r) => r.json() as Promise<{ data: Record<string, Latest> }>),
    fetch(`${API}/1h`).then((r) => r.json() as Promise<{ data: Record<string, Hour>, timestamp: number }>),
  ]);
  return pickPrices(latest.data, hour.data, hour.timestamp, Date.now() / 1000);
};
