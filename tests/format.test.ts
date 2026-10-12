import { describe, expect, test } from 'vitest';
import { coinTone, formatAmount, formatGp, parseBudget } from '../src/format';

describe('budget box', () => {
  test.each([
    ['25m', 25e6], ['1.2b', 1.2e9], ['500k', 5e5], ['10,000,000', 1e7], ['  7.5M ', 7.5e6], ['no limit', Infinity], ['300', 300],
  ])('reads %s', (text, gp) => expect(parseBudget(text)).toBe(gp));

  test.each(['', 'abc', '25mx', '1..2m', '-5m'])('rejects "%s"', (text) => expect(parseBudget(text)).toBeNull());
});

describe('coins', () => {
  test.each([
    [12_345, '12,345'], [450_000, '450K'], [1_250_000, '1.25M'], [12_500_000, '12.5M'], [1.2e9, '1.2B'], [999_999, '1M'], [10_000_000, '10M'], [-2_390_000, '-2.39M'], [Infinity, 'No limit'],
  ])('shows %d as %s', (gp, text) => expect(formatGp(gp)).toBe(text));

  test('takes the colour of a coin stack that size', () => {
    expect(coinTone(99_999)).toBe('yellow');
    expect(coinTone(100_000)).toBe('white');
    expect(coinTone(9_999_999)).toBe('white');
    expect(coinTone(10_000_000)).toBe('green');
  });
});

describe('amounts used an hour', () => {
  test.each([
    [1200, '1,200'], [666.67, '667'], [10, '10'], [9.6, '9.6'], [0.15, '0.15'], [1 / 3, '0.33'], [0.012, '0.012'],
  ])('shows %s as %s', (n, text) => expect(formatAmount(n)).toBe(text));
});
