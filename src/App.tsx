import { useCallback, useEffect, useMemo, useState } from 'react';
import { copyOf, customInfo, DEFAULT_MONSTER, monsterInfo, wikiImage } from './catalog';
import { CUSTOM_KEY } from './custom';
import type { Character } from './hiscores';
import { eitherOf } from './format';
import { protectionFor } from './protection';
import { wildernessOf } from './wilderness';
import { useStored } from './storage';
import { ask } from './worker/client';
import type {
  CharacterInput, CombatClass, CustomMonster, Outcome, SetupRef, Skills, Slot, SlotOption, UpgradeView,
} from './worker/protocol';
import { BudgetBox } from './ui/BudgetBox';
import { Compare } from './ui/Compare';
import { CustomEditor } from './ui/CustomEditor';
import { MonsterPicker } from './ui/MonsterPicker';
import { MonsterFacts, MonsterHead } from './ui/MonsterSheet';
import { Panel } from './ui/Panel';
import { Results } from './ui/Results';
import { RsnBox } from './ui/RsnBox';
import { ThemeButton } from './ui/ThemeButton';
import { Upgrades } from './ui/Upgrades';

const MAXED: Skills = {
  atk: 99, str: 99, def: 99, ranged: 99, magic: 99, prayer: 99, hp: 99, agility: 99, slayer: 99, mining: 99, herblore: 99,
};

const CLASSES: { id: CombatClass, name: string, icon: string }[] = [
  { id: 'melee', name: 'Melee', icon: 'Attack icon' },
  { id: 'ranged', name: 'Ranged', icon: 'Ranged icon' },
  { id: 'magic', name: 'Magic', icon: 'Magic icon' },
];

const toRef = ({ items, dart, style, spell }: SetupRef): SetupRef => ({ items, dart, style, spell });

export const App = () => {
  const [monsterKey, setMonsterKey] = useStored('monster', DEFAULT_MONSTER);
  const [budget, setBudget] = useStored('budget', 10_000_000);
  const [classes, setClasses] = useStored<CombatClass[]>('classes', ['melee', 'ranged', 'magic']);
  const [storedSkills, setSkills] = useStored<Skills>('skills', MAXED);
  // Levels saved before a skill was added to the site start that skill at 99.
  const skills = useMemo(() => ({ ...MAXED, ...storedSkills }), [storedSkills]);
  const [rsn, setRsn] = useStored<Omit<Character, 'skills'> | null>('rsn', null);
  const [untradeables, setUntradeables] = useStored('untradeables', true);
  const [unlockedOnly, setUnlockedOnly] = useStored('unlockedOnly', true);
  const [kandarinDiary, setKandarinDiary] = useStored('kandarinDiary', true);
  const [chargeSpell, setChargeSpell] = useStored('chargeSpell', false);
  // Only the monsters where someone changed the on-task switch.
  const [taskChoices, setTaskChoices] = useStored<Record<string, boolean>>('onTask', {});
  const [wildernessChoices, setWildernessChoices] = useStored<Record<string, boolean>>('inWilderness', {});

  // The one Custom monster, kept between visits whichever monster is picked.
  const [customMonster, setCustomMonster] = useStored<CustomMonster | null>('customMonster', null);
  const isCustom = monsterKey === CUSTOM_KEY && customMonster !== null && monsterInfo.has(customMonster.from);
  const monster = isCustom ? customInfo(customMonster) : monsterInfo.get(monsterKey) ?? monsterInfo.get(DEFAULT_MONSTER)!;
  const copiedFrom = isCustom ? monsterInfo.get(customMonster.from)!.name : undefined;
  const savedFrom = customMonster && monsterInfo.get(customMonster.from)?.name;
  // Opens the saved Custom monster, or starts one as a copy of the monster on show.
  const openCustom = () => {
    if (!savedFrom) setCustomMonster(copyOf(monster));
    setMonsterKey(CUSTOM_KEY);
  };
  // A Custom monster starts on task when the monster it was copied from does.
  const taskDefault = isCustom ? monsterInfo.get(customMonster.from)! : monster;
  const onTask = taskChoices[monster.key] ?? (taskDefault.slayer && !taskDefault.boss);
  // The Wilderness switch only shows for monsters fought both in and out of it.
  const wilderness = wildernessOf(taskDefault.name);
  const inWilderness = wilderness === 'always' || (wilderness === 'sometimes' && (wildernessChoices[monster.key] ?? false));
  const character: CharacterInput = useMemo(
    () => ({ skills, onTask, untradeables, unlockedOnly, kandarinDiary, chargeSpell, inWilderness }),
    [skills, onTask, untradeables, unlockedOnly, kandarinDiary, chargeSpell, inWilderness],
  );
  const customStats = isCustom ? customMonster : null;
  const common = useMemo(
    () => ({ monster: monster.key, custom: customStats, character, classes }),
    [monster.key, customStats, character, classes],
  );

  // A setup changed by hand stays only while everything else stays the same.
  const inputs = JSON.stringify([common, budget]);
  const [edited, setEdited] = useState<{ inputs: string, setup: SetupRef } | null>(null);
  const custom = edited?.inputs === inputs ? edited.setup : null;

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // The monster the outcome is for, which lags behind for a moment after picking another.
  const [outcomeFor, setOutcomeFor] = useState('');
  const [nothing, setNothing] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setBusy(true);
    const timer = setTimeout(() => {
      const reply = custom
        ? ask({ kind: 'evaluate', ...common, budget, setup: custom })
        : ask({ kind: 'best', ...common, budget });
      reply.then((o) => {
        if (stale) return;
        setOutcome(o);
        setOutcomeFor(common.monster);
        setNothing(o === null);
        setError(null);
        setBusy(false);
      }).catch((e: Error) => {
        if (stale) return;
        setError(e.message);
        setBusy(false);
      });
    }, 150);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [common, budget, custom]);

  const loadSlot = useCallback(
    (slot: Slot) => ask({ kind: 'slot', ...common, setup: toRef(outcome!.setup), slot }),
    [common, outcome],
  );
  const choose = (option: SlotOption) => setEdited({ inputs, setup: option.setup });
  // An upgrade raises the budget to what it costs, which finds the best setup there. One the
  // budget already covers (after a change by hand) is simply worn.
  const takeUpgrade = (upgrade: UpgradeView) => {
    const total = outcome!.setup.cost + upgrade.netCost;
    if (total > budget) setBudget(total);
    else setEdited({ inputs, setup: upgrade.setup });
  };
  const current = outcome && !nothing && outcomeFor === monster.key ? outcome : null;

  // A setup kept for a Comparison, worked out again against whatever is picked now.
  const [kept, setKept] = useStored<SetupRef | null>('kept', null);
  const [keptOutcome, setKeptOutcome] = useState<{ for: string, outcome: Outcome } | null>(null);
  useEffect(() => {
    if (!kept) return undefined;
    let stale = false;
    const key = JSON.stringify([common, kept]);
    ask({ kind: 'compare', ...common, setup: kept })
      .then((o) => { if (!stale) setKeptOutcome({ for: key, outcome: o }); })
      .catch((e: Error) => { if (!stale) setError(e.message); });
    return () => { stale = true; };
  }, [common, kept]);
  const keptNow = kept && keptOutcome?.for === JSON.stringify([common, kept]) ? keptOutcome.outcome : null;
  const guard = protectionFor(monster.name);

  // At least one style always stays on.
  const toggleClass = (cls: CombatClass) => setClasses((current) => {
    const next = current.includes(cls) ? current.filter((c) => c !== cls) : [...current, cls];
    return next.length ? CLASSES.map((c) => c.id).filter((c) => next.includes(c)) : current;
  });

  const controls = (
    <div className="controls">
      <div className="chips" role="group" aria-label="Combat styles">
        {CLASSES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip${classes.includes(c.id) ? ' on' : ''}`}
            aria-pressed={classes.includes(c.id)}
            onClick={() => toggleClass(c.id)}
          >
            <img src={wikiImage(c.icon)} alt="" />
            {c.name}
          </button>
        ))}
      </div>
      <div className="switches">
        <label className="switch" title="Untradeables earned in game, like a fire cape or defenders, count as free. Turn off to use only gear you can buy.">
          <input type="checkbox" checked={untradeables} onChange={(e) => setUntradeables(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          Untradeables
        </label>
        <label className="switch" title="Enchanted bolts trigger their effects 10% more often with the Kandarin hard diary done.">
          <input type="checkbox" checked={kandarinDiary} onChange={(e) => setKandarinDiary(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          Kandarin diary
        </label>
        <label className="switch" title="With Charge cast, god spells hit up to 30 instead of 20 when wearing the matching god cape.">
          <input type="checkbox" checked={chargeSpell} onChange={(e) => setChargeSpell(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          Charge
        </label>
      </div>
    </div>
  );

  return (
    <>
      <header className="top">
        <a className="brand" href="./">
          <img src={wikiImage('Coins 10000')} alt="" />
          <span>BiS on a Budget</span>
        </a>
        <div className="player">
          <RsnBox
            name={rsn?.name ?? null}
            onLoad={({ skills: levels, ...who }) => {
              setRsn(who);
              setSkills(levels);
            }}
            onForget={() => {
              setRsn(null);
              setSkills(MAXED);
            }}
          />
          <label className="switch" title="Leave out gear your levels are too low to wear. Quests aren't checked yet.">
            <input type="checkbox" checked={unlockedOnly} onChange={(e) => setUnlockedOnly(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            Only gear I can use
          </label>
        </div>
      </header>

      <main className="layout">
        <aside className="col col-monster">
          <div className="monster-main">
            <MonsterPicker
              monster={monster}
              onPick={setMonsterKey}
              onCustom={openCustom}
              customNote={savedFrom ? `Your saved one, copied from ${savedFrom}` : `Starts as a copy of ${monster.name}`}
            />
            <MonsterHead monster={monster} copiedFrom={copiedFrom} />
            <div className="task">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={onTask}
                  onChange={(e) => setTaskChoices({ ...taskChoices, [monster.key]: e.target.checked })}
                />
                <span className="switch-track" aria-hidden="true" />
                <img src={wikiImage('Slayer icon')} alt="" />
                On a slayer task
              </label>
              {wilderness === 'sometimes' && (
                <label className="switch" title="Craw's bow, Viggora's chainmace, Thammaron's sceptre and their upgrades only get their bonus in the Wilderness.">
                  <input
                    type="checkbox"
                    checked={inWilderness}
                    onChange={(e) => setWildernessChoices({ ...wildernessChoices, [monster.key]: e.target.checked })}
                  />
                  <span className="switch-track" aria-hidden="true" />
                  <img src={wikiImage('Skull (status) icon')} alt="" />
                  In the Wilderness
                </label>
              )}
            </div>
          </div>
          {isCustom ? (
            <CustomEditor custom={customMonster} onChange={setCustomMonster} onCopy={(m) => setCustomMonster(copyOf(m))} />
          ) : (
            <MonsterFacts
              monster={monster}
              stats={current?.stats ?? null}
              spell={current?.setup.spell ?? null}
            />
          )}
        </aside>

        <section className="col col-gear">
          <BudgetBox budget={budget} onChange={setBudget} />
          {controls}
          {custom && (
            <div className="edited">
              <span>You've changed this setup by hand.</span>
              <button type="button" onClick={() => setEdited(null)}>Back to best</button>
            </div>
          )}
          <Panel outcome={nothing ? null : outcome} skills={skills} rsn={rsn} onSkills={setSkills} loadSlot={loadSlot} onChoose={choose} />
          {outcome && !nothing && <Upgrades outcome={outcome} budget={budget} onTake={takeUpgrade} />}
        </section>

        <section className="col col-results" aria-live="polite">
          {error && <p className="problem">Something went wrong working this out: {error}</p>}
          {!error && nothing && !busy && (
            <p className="problem">
              Nothing you can use damages {monster.name} for this budget. Try a bigger budget or another combat style.
              {guard && guard.items.length > 0 && ` It needs ${eitherOf(guard.items)} in the ${guard.slot} slot, which your levels may not allow.`}
            </p>
          )}
          {!error && !outcome && busy && <p className="working">Finding the best setup…</p>}
          {!error && !nothing && outcome && kept && keptNow && current && (
            <Compare
              kept={keptNow}
              now={current}
              monster={monster}
              busy={busy}
              onWearKept={() => setEdited({ inputs, setup: kept })}
              onKeepNow={() => setKept(toRef(current.setup))}
              onStop={() => setKept(null)}
            />
          )}
          {!error && !nothing && outcome && kept && !(keptNow && current) && <p className="working">Working out the kept setup…</p>}
          {!error && !nothing && outcome && !kept && (
            <Results outcome={outcome} monster={monster} budget={budget} busy={busy} onKeep={() => setKept(toRef(outcome.setup))} />
          )}
        </section>
      </main>

      <footer className="small-print">
        <p>
          DPS from the <a href="https://tools.runescape.wiki/osrs-dps/" target="_blank" rel="noreferrer">OSRS Wiki DPS calculator</a>.
          Prices from the <a href="https://prices.runescape.wiki/" target="_blank" rel="noreferrer">OSRS Wiki real-time prices</a>, as Grand Exchange instant-buy prices.
        </p>
        <p>Not affiliated with Jagex. Old School RuneScape is a trademark of Jagex Ltd.</p>
      </footer>

      <ThemeButton />
    </>
  );
};
