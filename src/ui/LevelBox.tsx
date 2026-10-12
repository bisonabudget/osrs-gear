import { useEffect, useState } from 'react';
import { wikiImage } from '../catalog';

interface Props {
  label: string;
  icon: string;
  /** Says what the level does, on hover. */
  title: string;
  value: number;
  max: number;
  step: number;
  onChange: (level: number) => void;
}

// A small level box, such as the raid level. It can be cleared while typing, and only whole numbers
// in range are passed on.
export const LevelBox = ({ label, icon, title, value, max, step, onChange }: Props) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="level-box" title={title}>
      <img src={wikiImage(icon)} alt="" />
      {label}
      <input
        className="stat-input"
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Math.round(Number(e.target.value));
          if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= max) onChange(n);
        }}
        onBlur={() => setText(String(value))}
      />
    </label>
  );
};
