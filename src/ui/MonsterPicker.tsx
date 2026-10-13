import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MonsterInfo, monsterImage, monsterList, searchMonsters } from '../catalog';
import { Img } from './Img';

interface Props {
  /** The monster picked now, for the random pick to avoid. Without it there's no dice. */
  monster?: MonsterInfo;
  onPick: (key: string) => void;
  /** Opens the Custom monster, which then shows first in the list. */
  onCustom?: () => void;
  /** What the Custom monster row says under its name. */
  customNote?: string;
  placeholder?: string;
}

export const MonsterPicker = ({ monster, onPick, onCustom, customNote, placeholder }: Props) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchMonsters(query), [query]);
  const q = query.trim().toLowerCase();
  // The Custom monster is the first row, while the search is empty or could be "custom monster".
  const showCustom = onCustom !== undefined && (!q || 'custom monster'.startsWith(q) || q.startsWith('custom'));
  const rows = showCustom ? results.length + 1 : results.length;
  const choose = (i: number) => {
    if (showCustom && i === 0) {
      onCustom!();
      setQuery('');
      setOpen(false);
    } else {
      const m = results[i - (showCustom ? 1 : 0)];
      if (m) pick(m);
    }
  };
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const pick = (m: MonsterInfo) => {
    onPick(m.key);
    setQuery('');
    setOpen(false);
  };

  const roll = () => {
    if (!monster) return;
    let next = monster;
    while (next.key === monster.key) next = monsterList[Math.floor(Math.random() * monsterList.length)];
    onPick(next.key);
  };

  return (
    <div className="monster-search" ref={box}>
      <div className="search-field">
        <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </svg>
        <input
          type="search"
          placeholder={placeholder ?? `Search ${monsterList.length.toLocaleString('en-GB')} monsters`}
          value={query}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={placeholder ?? 'Search monsters'}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, rows - 1));
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            else if (e.key === 'Enter' && active < rows) choose(active);
            else if (e.key === 'Escape') setOpen(false);
            else return;
            e.preventDefault();
          }}
        />
        {monster && <button type="button" className="dice" onClick={roll} title="Pick a random monster" aria-label="Pick a random monster">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <circle cx="15.5" cy="15.5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="15.5" cy="8.5" r="1.5" />
            <circle cx="8.5" cy="15.5" r="1.5" />
          </svg>
        </button>}
      </div>
      {open && (
        <ul className="search-results" id={listId} role="listbox">
          {showCustom && (
            <li
              role="option"
              aria-selected={active === 0}
              className={`custom-row${active === 0 ? ' active' : ''}`}
              onPointerEnter={() => setActive(0)}
              onClick={() => choose(0)}
            >
              <span className="custom-mark" aria-hidden="true">?</span>
              <span className="result-name">
                Custom monster
                {customNote && <small>{customNote}</small>}
              </span>
            </li>
          )}
          {!query && <li className="search-hint">Bosses</li>}
          {results.map((m, j) => {
            const i = j + (showCustom ? 1 : 0);
            return (
            <li
              key={m.key}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(m)}
            >
              <Img src={monsterImage(m.image)} alt="" loading="lazy" />
              <span className="result-name">
                {m.name}
                {m.label && <small>{m.label}</small>}
              </span>
              <span className="result-level">{m.level}</span>
            </li>
            );
          })}
          {!results.length && <li className="search-hint">No monster called that</li>}
        </ul>
      )}
    </div>
  );
};
