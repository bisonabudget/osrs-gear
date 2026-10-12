// Settings kept in this browser between visits.
import { useEffect, useState } from 'react';

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw, (_, v) => (v === 'Infinity' ? Infinity : v)) as T;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value, (_, v) => (v === Infinity ? 'Infinity' : v)));
  } catch {
    // Private windows and blocked storage just don't remember.
  }
};

export const useStored = <T,>(key: string, fallback: T) => {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  useEffect(() => write(key, value), [key, value]);
  return [value, setValue] as const;
};
