import { useEffect, useState } from 'react';
import { formatGp, parseBudget } from '../format';

interface Props {
  budget: number;
  onChange: (gp: number) => void;
}

export const BudgetBox = ({ budget, onChange }: Props) => {
  const [text, setText] = useState(formatGp(budget));
  const [editing, setEditing] = useState(false);
  const parsed = parseBudget(text);
  const unlimited = budget === Infinity;

  useEffect(() => {
    if (!editing) setText(unlimited ? '' : formatGp(budget));
  }, [budget, editing, unlimited]);

  const commit = () => {
    if (parsed !== null) onChange(parsed);
    setEditing(false);
  };

  return (
    <div className="budget">
      <label className="label" htmlFor="budget">Budget</label>
      <div className={`budget-row${parsed === null && editing && text ? ' invalid' : ''}`}>
        <span className="budget-coins" aria-hidden="true" />
        <input
          id="budget"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder={unlimited ? 'No limit' : '25m, 1.2b'}
          value={text}
          onFocus={(e) => {
            setEditing(true);
            e.target.select();
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setText(formatGp(budget));
              setEditing(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <button
          type="button"
          className={`chip${unlimited ? ' on' : ''}`}
          aria-pressed={unlimited}
          onClick={() => onChange(unlimited ? 10_000_000 : Infinity)}
        >
          No limit
        </button>
      </div>
      {editing && text && parsed === null && <p className="hint">Try 25m, 1.2b or 500k</p>}
    </div>
  );
};
