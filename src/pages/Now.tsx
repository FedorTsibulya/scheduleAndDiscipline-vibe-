import { useMemo, useRef, useState } from 'react';
import { IconDice5, IconInbox, IconPlus, IconCoin, IconFlame, IconTarget, IconSnowflake, IconBatteryOff } from '@tabler/icons-react';
import { liveMoods, liveTasks, useStore } from '../store';
import { goTo, useUI } from '../uiStore';
import { candidates, randomTask, suggest } from '../lib/suggest';
import { activeDays, balance, computeStreak, levelInfo, totalXp } from '../lib/game';
import { DynIcon } from '../lib/icons';
import { dayKey, formatMin, plural } from '../lib/util';
import { PALETTE } from '../lib/colors';
import { TaskCard } from '../components/TaskCard';
import { AskClaude } from '../components/AskClaude';
import { HabitPicker, PinnedToday } from '../components/Habits';
import { NO_MOOD } from '../lib/habits';
import { Check, Empty, colorVars } from '../components/ui';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function NowPage() {
  const data = useStore((s) => s.data);
  const mood = useStore((s) => s.currentMood);
  const setMood = useStore((s) => s.setMood);
  const addInbox = useStore((s) => s.addInbox);
  const toggleStep = useStore((s) => s.toggleStep);
  const askStart = useUI((s) => s.askStart);
  const moods = liveMoods(data);
  const tasks = liveTasks(data);
  const [randomId, setRandomId] = useState<string | null>(null);
  const [rolling, setRolling] = useState<string | null>(null);
  const [quick, setQuick] = useState('');
  const rollTimer = useRef<number>();

  const top = useMemo(() => suggest(tasks, mood, 3), [tasks, mood]);
  const pool = useMemo(() => candidates(tasks, mood), [tasks, mood]);
  const random = tasks.find((t) => t.id === randomId && !t.completedAt);
  const shown = random ? [random, ...top.filter((t) => t.id !== random.id)].slice(0, 3) : top;

  const xp = totalXp(data.points);
  const lvl = levelInfo(xp);
  const bal = balance(data.points);
  const streak = computeStreak(activeDays(data));

  // «Рулетка»: подсветка пробегает по задачам и останавливается на случайной
  const roll = () => {
    if (!pool.length) return;
    const final = randomTask(tasks, mood, randomId ?? undefined);
    if (!final) return;
    clearInterval(rollTimer.current);
    let i = 0;
    const order = [...pool].sort(() => Math.random() - 0.5);
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

  const today = dayKey();
  const plan = tasks
    .filter((t) => !t.inbox)
    .flatMap((t) =>
      t.steps
        // запланированное на сегодня + несделанное с прошлых дней + сделанное сегодня
        .filter((s) => s.date && (s.date === today || (!s.done && s.date < today) || (s.done && s.doneAt && dayKey(s.doneAt) === today)))
        .map((s) => ({ t, s })),
    )
    .sort((a, b) => Number(a.s.done) - Number(b.s.done));
  const planMin = plan.filter((x) => !x.s.done).reduce((a, x) => a + x.s.minutes, 0);
  const inboxCount = tasks.filter((t) => t.inbox).length;
  const rollingTask = tasks.find((t) => t.id === rolling);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{greeting()}! Что сделаем сейчас?</h1>
          <p className="sub">Выберите своё состояние, и приложение подскажет подходящие задачи.</p>
        </div>
        <div className="row wrap">
          <span className="pill violet" title={`${lvl.into} из ${lvl.need} опыта до следующего уровня`}>Ур. {lvl.level}</span>
          <span key={bal} className="pill gold bounce"><IconCoin size={16} /> {bal}</span>
          <span className="pill pink" title={streak.freezeReady ? 'Заморозка доступна: один пропуск не обнулит серию' : `Заморозка восстановится через ${streak.readyIn} дн.`}>
            <IconFlame size={16} /> {streak.current} {plural(streak.current, 'день', 'дня', 'дней')}
            {streak.freezeReady && <IconSnowflake size={14} />}
          </span>
        </div>
      </div>

      <div className="row wrap" style={{ marginBottom: 6 }}>
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

      {mood === NO_MOOD ? (
        <div className="section">
          <div className="section-head">
            <h2>Простые дела на 1–10 минут</h2>
            <button className="btn sm ghost" onClick={() => goTo('habits')}>Все простые дела и привычки</button>
          </div>
          <HabitPicker />
        </div>
      ) : (
      <>
      {tasks.some((t) => !t.inbox && !t.completedAt) && (
        <div style={{ marginTop: 16 }}><AskClaude /></div>
      )}

      <div className="section">
        <div className="section-head">
          <h2>Подходит сейчас</h2>
          <button className="btn violet" onClick={roll} disabled={!pool.length}>
            <IconDice5 size={18} className={rolling ? 'spin' : ''} /> Случайная задача
          </button>
        </div>
        {rollingTask && (
          <div className="card hero" style={{ marginBottom: 12, textAlign: 'center', animation: 'shuffle .2s ease' }}>
            <span className="task-title" style={{ color: PALETTE[rollingTask.color][600] }}>{rollingTask.title}</span>
          </div>
        )}
        {shown.length ? (
          <div className="stack">
            {shown.map((t) => (
              <div key={t.id}>
                {random?.id === t.id && <p className="small" style={{ fontWeight: 800, color: 'var(--accent)', margin: '0 0 6px 6px' }}>Выпала случайная задача — берите её!</p>}
                <TaskCard task={t} picked={random?.id === t.id} />
              </div>
            ))}
          </div>
        ) : tasks.some((t) => !t.inbox && !t.completedAt) ? (
          <Empty icon={<IconTarget size={32} />} title="Под это настроение задач нет" text="Выберите «Любое» или отметьте у задач, под какое настроение они подходят." />
        ) : (
          <Empty
            icon={<IconInbox size={32} />}
            title="Начните с записи дел"
            text="Запишите всё, что крутится в голове, во «Входящие», а потом разберите: разбейте на шаги и оцените."
            action={<button className="btn primary" onClick={() => goTo('inbox')}>Открыть входящие</button>}
          />
        )}
      </div>
      </>
      )}

      <PinnedToday onOpenAll={() => goTo('habits')} />

      <div className="section">
        <div className="section-head">
          <h2>План на сегодня</h2>
          {planMin > 0 && <span className="small muted">осталось {formatMin(planMin)} из {formatMin(data.settings.dailyCapacityMin)} в день</span>}
        </div>
        {plan.length ? (
          <div className="card">
            {plan.map(({ t, s }) => (
              <div key={s.id} className={`step-row ${s.done ? 'done' : ''}`}>
                <Check on={s.done} label="Шаг выполнен" onClick={() => toggleStep(t.id, s.id)} />
                <span style={{ width: 10, height: 10, borderRadius: 4, background: PALETTE[t.color][400], flexShrink: 0 }} />
                <div className="grow">
                  <p className="step-title" style={{ fontWeight: 700 }}>{s.title}</p>
                  <p className="small faint">{t.title} · {formatMin(s.minutes)}{s.date && s.date < today && !s.done ? ' · с прошлых дней' : ''}</p>
                </div>
                {!s.done && <button className="btn sm primary" onClick={() => askStart({ taskId: t.id, stepId: s.id })}>Фокус</button>}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small">На сегодня ничего не запланировано. Распределите шаги на экране «Неделя» или просто берите задачи сверху.</p>
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Быстрая запись</h2>
          {inboxCount > 0 && <button className="btn sm ghost" onClick={() => goTo('inbox')}>Во входящих: {inboxCount}</button>}
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (quick.trim()) { addInbox(quick); setQuick(''); } }}>
          <input className="input big grow" placeholder="Вспомнили дело? Запишите его, чтобы не держать в голове" value={quick} onChange={(e) => setQuick(e.target.value)} />
          <button className="btn primary icon" style={{ borderRadius: 999, padding: 12 }} aria-label="Добавить"><IconPlus size={20} /></button>
        </form>
      </div>
    </div>
  );
}
