import { useEffect, useMemo, useRef, useState } from 'react';
import { IconDice5, IconInbox, IconPlus, IconTarget, IconSnowflake, IconBatteryOff, IconSparkles, IconChevronDown } from '@tabler/icons-react';
import { liveMoods, liveTasks, useStore } from '../store';
import { goTo } from '../uiStore';
import { candidates, randomTask, scoreTask } from '../lib/suggest';
import { activeDays, balance, computeStreak, levelInfo, totalXp } from '../lib/game';
import { DynIcon } from '../lib/icons';
import { NO_MOOD } from '../lib/habits';
import { aiConfigured } from '../lib/ai';
import { AskClaude } from '../components/AskClaude';
import { HabitPicker, HabitReminderStrip } from '../components/Habits';
import { HotRow, TodayRow, isHot } from '../components/TodayList';
import { Empty, colorVars } from '../components/ui';

const LIST_SIZE = 6;

// Главный экран (дизайн «огненная строка»): сверху горящие задачи компактными строками,
// ниже спокойный список с цветными кружками-галочками; детали — по нажатию на задачу
export function NowPage() {
  const data = useStore((s) => s.data);
  const ai = useStore((s) => s.ai);
  const mood = useStore((s) => s.currentMood);
  const setMood = useStore((s) => s.setMood);
  const addInbox = useStore((s) => s.addInbox);
  const moods = liveMoods(data);
  const tasks = liveTasks(data);
  const [randomId, setRandomId] = useState<string | null>(null);
  const [rolling, setRolling] = useState<string | null>(null);
  const [quick, setQuick] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [claude, setClaude] = useState(false);
  const rollTimer = useRef<number>();
  const moodRow = useRef<HTMLDivElement>(null);

  // выбранное настроение должно быть видно в прокручиваемой строке
  useEffect(() => {
    const el = moodRow.current?.querySelector<HTMLElement>('.chip.on');
    const row = moodRow.current;
    if (el && row && row.scrollWidth > row.clientWidth) row.scrollTo({ left: el.offsetLeft - 16, behavior: 'smooth' });
  }, [mood]);

  const pool = useMemo(() => candidates(tasks, mood === NO_MOOD ? null : mood), [tasks, mood]);
  // горящие показываем всегда, независимо от настроения
  const hot = tasks.filter((t) => !t.inbox && isHot(t)).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
  const ranked = pool
    .filter((t) => !isHot(t))
    .map((t) => ({ t, s: scoreTask(t, mood) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
  const random = ranked.find((t) => t.id === randomId);
  const list = random ? [random, ...ranked.filter((t) => t.id !== random.id)] : ranked;
  const visible = showAll ? list : list.slice(0, LIST_SIZE);

  const lvl = levelInfo(totalXp(data.points));
  const bal = balance(data.points);
  const streak = computeStreak(activeDays(data));
  const inboxCount = tasks.filter((t) => t.inbox).length;
  const hasTasks = tasks.some((t) => !t.inbox && !t.completedAt);

  // «Рулетка»: подсветка пробегает по задачам и останавливается на случайной (она встаёт первой)
  const roll = () => {
    const rollPool = ranked;
    if (!rollPool.length) return;
    const final = randomTask(rollPool, null, randomId ?? undefined);
    if (!final) return;
    clearInterval(rollTimer.current);
    let i = 0;
    const order = [...rollPool].sort(() => Math.random() - 0.5);
    setRandomId(null);
    rollTimer.current = window.setInterval(() => {
      setRolling(order[i % order.length].id);
      i++;
      if (i > 9) {
        clearInterval(rollTimer.current);
        setRolling(null);
        setRandomId(final.id);
      }
    }, 90);
  };

  return (
    <div>
      <div className="page-head" style={{ marginBottom: 10 }}>
        <h1>Сегодня</h1>
        <span className="small muted" title={streak.freezeReady ? 'Заморозка доступна: один пропуск не обнулит серию' : `Заморозка восстановится через ${streak.readyIn} дн.`}>
          Ур. {lvl.level} · ⭐ <span key={bal} className="bounce" style={{ display: 'inline-block' }}>{bal}</span> · 🔥 {streak.current}
          {streak.freezeReady && <IconSnowflake size={12} style={{ verticalAlign: -1, marginLeft: 2 }} />}
        </span>
      </div>

      <HabitReminderStrip onOpenAll={() => goTo('habits')} />

      {/* на телефоне — одна строка с прокруткой влево-вправо */}
      <div className="mood-scroll" ref={moodRow}>
        <button className={`chip ${mood === null ? 'on' : ''}`} style={colorVars('gray')} onClick={() => setMood(null)}>Любое</button>
        {moods.map((m) => (
          <button key={m.id} className={`chip ${mood === m.id ? 'on' : ''}`} style={colorVars(m.color)} onClick={() => setMood(m.id)}>
            <DynIcon name={m.icon} size={17} /> {m.name}
          </button>
        ))}
        <button className={`chip ${mood === NO_MOOD ? 'on' : ''}`} style={colorVars('red')} onClick={() => setMood(NO_MOOD)}>
          <IconBatteryOff size={17} /> Нет настроения ни на что
        </button>
      </div>

      {hot.length > 0 && (
        <div className="stack" style={{ gap: 8, marginTop: 12 }}>
          {hot.map((t) => <HotRow key={t.id} task={t} />)}
        </div>
      )}

      {mood === NO_MOOD ? (
        <div className="section" style={{ marginTop: 18 }}>
          <div className="section-head">
            <h2>Простые дела на 1–10 минут</h2>
            <button className="btn sm ghost" onClick={() => goTo('habits')}>Все</button>
          </div>
          <HabitPicker />
        </div>
      ) : (
        <div className="section" style={{ marginTop: 18 }}>
          {visible.length ? (
            <div className="today-list">
              {visible.map((t) => <TodayRow key={t.id} task={t} picked={random?.id === t.id} rolling={rolling === t.id} />)}
            </div>
          ) : hasTasks ? (
            hot.length ? null : <Empty icon={<IconTarget size={32} />} title="Под это настроение задач нет" text="Выберите «Любое» или отметьте у задач, под какое настроение они подходят." />
          ) : (
            <Empty
              icon={<IconInbox size={32} />}
              title="Начните с записи дел"
              text="Запишите всё, что крутится в голове, во «Входящие», а потом разберите: разбейте на шаги и оцените."
              action={<button className="btn primary" onClick={() => goTo('inbox')}>Открыть входящие</button>}
            />
          )}
          {list.length > LIST_SIZE && !showAll && (
            <button className="btn sm ghost" style={{ marginTop: 6 }} onClick={() => setShowAll(true)}>
              <IconChevronDown size={15} /> Ещё {list.length - LIST_SIZE}
            </button>
          )}

          {ranked.length > 1 && (
            <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
              <button className="btn violet grow" style={{ justifyContent: 'center' }} onClick={roll}>
                <IconDice5 size={18} className={rolling ? 'spin' : ''} /> Случайная задача
              </button>
              {aiConfigured(ai) && hasTasks && (
                <button className={`btn ${claude ? 'violet' : ''}`} onClick={() => setClaude(!claude)}><IconSparkles size={16} /> Спросить Claude</button>
              )}
            </div>
          )}
          {claude && <div style={{ marginTop: 12 }}><AskClaude /></div>}
          {random && <p className="small" style={{ color: 'var(--accent)', fontWeight: 700, marginTop: 8 }}>Выпала «{random.title}» — она первая в списке.</p>}
        </div>
      )}

      <form className="quick-add" onSubmit={(e) => { e.preventDefault(); if (quick.trim()) { addInbox(quick); setQuick(''); } }}>
        <input className="input" placeholder="Записать дело, чтобы не держать в голове" value={quick} onChange={(e) => setQuick(e.target.value)} aria-label="Быстрая запись" />
        <button className="btn icon" aria-label="Добавить во входящие"><IconPlus size={18} /></button>
        {inboxCount > 0 && <button type="button" className="btn sm ghost" onClick={() => goTo('inbox')}>Входящие: {inboxCount}</button>}
      </form>
    </div>
  );
}
