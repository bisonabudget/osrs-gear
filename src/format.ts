// Turning numbers into what the page shows, and the budget box's text back into a number.

/** Reads "25m", "1.2b", "500k", "10,000,000" or "no limit". Null if it can't. */
export const parseBudget = (text: string): number | null => {
  const t = text.trim().toLowerCase().replace(/[,_\s]/g, '');
  if (!t) return null;
  if (t === 'nolimit' || t === 'max' || t === '∞') return Infinity;
  const m = /^(\d+(?:\.\d+)?|\.\d+)([kmb]?)(?:gp|coins)?$/.exec(t);
  if (!m) return null;
  const scale = { '': 1, k: 1e3, m: 1e6, b: 1e9 }[m[2] as '' | 'k' | 'm' | 'b'];
  return Math.round(Number(m[1]) * scale);
};

// Three significant figures, without trailing zeros after the point.
const trim = (n: number) => {
  const size = Math.abs(n);
  const digits = size < 10 ? 2 : size < 100 ? 1 : 0;
  const text = n.toFixed(digits);
  return digits ? text.replace(/\.?0+$/, '') : text;
};

/** GP the way a player reads it: 12,345, 450K, 1.25M, 12.5M, 1.2B. */
export const formatGp = (gp: number): string => {
  if (gp === Infinity) return 'No limit';
  const n = Math.round(gp);
  const size = Math.abs(n);
  if (size < 100_000) return n.toLocaleString('en-GB');
  // Just under a million rounds up to 1M, so the switch to the next unit comes a little early.
  if (size < 999_500) return `${trim(n / 1e3)}K`;
  if (size < 999_500_000) return `${trim(n / 1e6)}M`;
  return `${trim(n / 1e9)}B`;
};

/** The colour the game gives a coin stack of this size. */
export const coinTone = (gp: number): 'yellow' | 'white' | 'green' => {
  if (gp < 100_000) return 'yellow';
  if (gp < 10_000_000) return 'white';
  return 'green';
};

export const formatSeconds = (s: number): string => {
  if (!Number.isFinite(s)) return 'Never';
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** A count of something, like 1,200 or 0.15. */
export const formatAmount = (n: number): string => (n >= 10
  ? Math.round(n).toLocaleString('en-GB')
  : String(Number(n.toPrecision(2))));

/** How long ago a Unix time was, like "4 min ago". */
export const formatAgo = (unix: number, now = Date.now() / 1000): string => {
  const s = Math.max(0, now - unix);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 48 * 3600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};

export const formatPercent = (x: number): string => `${(x * 100).toFixed(x >= 0.995 || x < 0.1 ? 1 : 0)}%`;

/** "a", "a and b", "a, b and c". */
export const listOf = (words: string[]): string => (words.length < 2
  ? words.join('')
  : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

/** "a", "a or b", "a, b or c". */
export const eitherOf = (words: string[]): string => (words.length < 2
  ? words.join('')
  : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`);
