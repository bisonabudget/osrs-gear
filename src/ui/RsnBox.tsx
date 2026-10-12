import { useEffect, useState } from 'react';
import { wikiImage } from '../catalog';
import { type Character, fetchHiscores, HiscoresError, validName } from '../hiscores';

interface Props {
  /** The RSN whose levels are loaded, if any. */
  name: string | null;
  onLoad: (character: Character) => void;
  onForget: () => void;
}

export const RsnBox = ({ name, onLoad, onForget }: Props) => {
  const [draft, setDraft] = useState(name ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => setDraft(name ?? ''), [name]);

  const load = async () => {
    if (!validName(draft)) {
      setProblem('An RSN is up to 12 letters, numbers, spaces, hyphens or underscores.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      onLoad(await fetchHiscores(draft));
    } catch (e) {
      setProblem(e instanceof HiscoresError ? e.message : 'Something went wrong loading your levels.');
    } finally {
      setBusy(false);
    }
  };

  const loaded = name !== null && draft.trim().toLowerCase() === name.toLowerCase();

  return (
    <form
      className="rsn"
      onSubmit={(e) => {
        e.preventDefault();
        void load();
      }}
    >
      <div className={`rsn-field${problem ? ' invalid' : ''}`}>
        <img src={wikiImage('Stats icon')} alt="" />
        <input
          type="text"
          value={draft}
          maxLength={12}
          placeholder="Your RSN"
          aria-label="RuneScape name"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            setProblem(null);
          }}
        />
        {name !== null && (
          <button type="button" className="rsn-forget" onClick={onForget} title="Forget this RSN and go back to 99s" aria-label="Forget RSN">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
        <button type="submit" className="rsn-load" disabled={busy || !draft.trim()}>
          {busy ? 'Loading…' : loaded ? 'Refresh' : 'Load levels'}
        </button>
      </div>
      {problem && <p className="rsn-problem" role="alert">{problem}</p>}
    </form>
  );
};
