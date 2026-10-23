import { useState, type DragEvent } from 'react';
import { IconChevronLeft, IconChevronRight, IconCheck, IconCalendarEvent, IconChecks } from '@tabler/icons-react';
import type { Habit, Step, Task } from '../types';
import { liveHabits, liveTasks, useStore } from '../store';
import { useUI } from '../uiStore';
import { PALETTE } from '../lib/colors';
import { CATEGORIES, calendarPlan, countOn, freqOf, perDayOf, weeklyProgress } from '../lib/habits';
import { DynIcon } from '../lib/icons';
import { addDays, appNow, dayKey, dayLabel, formatMin, parseDay, startOfWeek, weekdayShort } from '../lib/util';
import { Bar, colorVars } from '../components/ui';
import { Modal } from '../components/Modal';

type Item = { t: Task; s: Step };
const DRAG = 'application/x-focus-step';

const itemKey = (it: Item) => `${it.t.id}:${it.s.id}`;

// Шаг в календаре. Нажатие на шаг — панель «Перенести на день» (или выбор, если включён режим выбора).
// На компьютере по-прежнему можно перетаскивать мышью.
function StepChip({ it, selecting, selected, onTap }: { it: Item; selecting: boolean; selected: boolean; onTap: (it: Item) => void }) {
  const toggle = useStore((s) => s.toggleStep);
  const p = PALETTE[it.t.color];
  return (
    <div
      className={`step-chip tint ${it.s.done ? 'done' : ''} ${selected ? 'selected' : ''}`}
      draggable={!it.s.done && !selecting}
      onDragStart={(e) => e.dataTransfer.setData(DRAG, JSON.stringify({ taskId: it.t.id, stepId: it.s.id }))}
      onClick={() => !it.s.done && onTap(it)}
      style={{ ...colorVars(it.t.color), cursor: it.s.done ? 'default' : 'pointer' }}
      role="button"
      aria-pressed={selecting ? selected : undefined}
    >
      <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
        {selecting && !it.s.done ? (
          <span className="check" style={{ width: 18, height: 18, borderRadius: 9, borderColor: p[400], background: selected ? p[400] : 'transparent' }}>
            {selected && <IconCheck size={12} stroke={3} />}
          </span>
        ) : (
          <button
            className="check" style={{ width: 18, height: 18, borderRadius: 6, borderColor: p[400], background: it.s.done ? p[400] : 'transparent' }}
            onClick={(e) => { e.stopPropagation(); toggle(it.t.id, it.s.id); }} aria-label="Шаг выполнен"
          >
            {it.s.done && <IconCheck size={12} stroke={3} />}
          </button>
        )}
        <span className="grow">{it.s.title}</span>
      </div>
      <div className="row tint-sub" style={{ justifyContent: 'space-between', fontWeight: 600, fontSize: 11.5 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.t.title} · {it.s.minutes} мин</span>
      </div>
    </div>
  );
}

// Панель «Перенести»: крупные кнопки дней — удобно на телефоне, без перетаскивания
function MoveSheet({ items, onClose, onDone }: { items: Item[]; onClose: () => void; onDone: () => void }) {
  const data = useStore((s) => s.data);
  const schedule = useStore((s) => s.scheduleStep);
  const edit = useUI((s) => s.edit);
  const [week, setWeek] = useState(0);
  const today = dayKey();
  const start = addDays(startOfWeek(appNow()), week * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const cap = data.settings.dailyCapacityMin;
  const loadOf = (key: string) =>
    data.tasks.filter((t) => !t.deleted && !t.inbox).flatMap((t) => t.steps).filter((s) => s.date === key && !s.done).reduce((a, s) => a + s.minutes, 0);
  const move = (date?: string) => {
    items.forEach((it) => schedule(it.t.id, it.s.id, date));
    onDone();
    onClose();
  };
  const single = items.length === 1 ? items[0] : null;
  return (
    <Modal title={single ? 'Перенести шаг' : `Перенести шаги: ${items.length}`} onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 12 }}>
        {single ? <>«{single.s.title}» · {single.t.title}</> : items.slice(0, 4).map((it) => `«${it.s.title}»`).join(', ') + (items.length > 4 ? ` и ещё ${items.length - 4}` : '')}
      </p>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <button className="btn sm ghost" onClick={() => setWeek(week - 1)} aria-label="Прошлая неделя"><IconChevronLeft size={16} /></button>
        <span className="small" style={{ fontWeight: 700 }}>{week === 0 ? 'Эта неделя' : week === 1 ? 'Следующая неделя' : `${dayLabel(days[0])} – ${dayLabel(days[6])}`}</span>
        <button className="btn sm ghost" onClick={() => setWeek(week + 1)} aria-label="Следующая неделя"><IconChevronRight size={16} /></button>
      </div>
      <div className="move-grid">
        {days.map((d) => {
          const key = dayKey(d);
          const load = loadOf(key);
          return (
            <button key={key} className={`move-day ${key === today ? 'today' : ''}`} disabled={key < today} onClick={() => move(key)}>
              <span style={{ fontWeight: 800 }}>{key === today ? 'Сегодня' : weekdayShort(d)}</span>
              <span className="small">{dayLabel(d)}</span>
              <span className="small faint">{load ? formatMin(load) : 'свободно'}{load > cap ? ' · много' : ''}</span>
            </button>
          );
        })}
      </div>
      <div className="row wrap" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        <button className="btn" onClick={() => move(undefined)}>Убрать с дня</button>
        {single && <button className="btn ghost" onClick={() => { onClose(); edit(single.t); }}>Открыть задачу</button>}
      </div>
    </Modal>
  );
}

// Привычка в дне календаря: пунктирная рамка; отметить можно за сегодня и за вчера (если забыли)
function HabitChip({ habit, done, missed, day, canMark, isToday }: { habit: Habit; done: boolean; missed: boolean; day: string; canMark: boolean; isToday: boolean }) {
  const toggle = useStore((s) => s.toggleHabit);
  const logs = useStore((s) => s.data.habitLogs);
  const color = (CATEGORIES[habit.category] ?? CATEGORIES.care).color;
  const p = PALETTE[color];
  return (
    <div className={`step-chip tint ${done ? 'done' : ''}`}
      style={{ ...colorVars(color), borderStyle: 'dashed', cursor: 'default', opacity: missed ? 0.5 : undefined }}
      title={missed ? (canMark ? 'Пропущено — можно отметить за вчера' : 'Пропущено') : isToday ? 'Привычка на сегодня' : 'Запланированная привычка'}>
      <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
        {canMark ? (
          <button className="check" style={{ width: 18, height: 18, borderRadius: 9, borderColor: p[400], background: done ? p[400] : 'transparent' }}
            onClick={() => toggle(habit.id, day)} aria-label={isToday ? 'Привычка выполнена' : 'Отметить за вчера'}>
            {done && <IconCheck size={12} stroke={3} />}
          </button>
        ) : (
          <span style={{ display: 'inline-flex', marginTop: 1 }}>{done ? <IconCheck size={15} stroke={3} /> : <DynIcon name={habit.icon} size={15} />}</span>
        )}
        <span className="grow">{habit.title}</span>
      </div>
      <div className="row wrap tint-sub" style={{ justifyContent: 'space-between', fontWeight: 600, fontSize: 11.5, gap: 2 }}>
        <span>привычка · {perDayOf(habit) > 1 ? `${countOn(logs, habit.id, day)}/${perDayOf(habit)}` : `${habit.minutes} мин`}</span>
        {missed && <span>пропуск</span>}
      </div>
    </div>
  );
}

export function WeekPage() {
  const data = useStore((s) => s.data);
  const schedule = useStore((s) => s.scheduleStep);
  const [offset, setOffset] = useState(0);
  const [over, setOver] = useState<string | null>(null);
  const start = addDays(startOfWeek(appNow()), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = dayKey();
  const yesterday = dayKey(addDays(parseDay(today), -1));
  const cap = data.settings.dailyCapacityMin;

  const tasks = liveTasks(data).filter((t) => !t.inbox && !t.completedAt);
  const items: Item[] = tasks.flatMap((t) => t.steps.map((s) => ({ t, s })));
  const allItems: Item[] = liveTasks(data).filter((t) => !t.inbox).flatMap((t) => t.steps.map((s) => ({ t, s })));
  const pool = items.filter((x) => !x.s.done && !x.s.date);
  // закреплённые привычки, отмеченные «показывать в календаре»
  const calHabits = liveHabits(data).filter((h) => h.mine && h.inCalendar);
  const weeklyHabits = calHabits.filter((h) => freqOf(h) === 'weekly');
  const overdue = items.filter((x) => !x.s.done && x.s.date && x.s.date < today);

  const move = (it: Item, date?: string) => schedule(it.t.id, it.s.id, date);

  // выбор нескольких шагов и панель переноса
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Item[] | null>(null);
  const stopSelecting = () => { setSelecting(false); setSelected([]); };
  const onTap = (it: Item) => {
    if (!selecting) return setSheet([it]);
    const k = itemKey(it);
    setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  };
  const chip = (it: Item) => <StepChip key={it.s.id} it={it} selecting={selecting} selected={selected.includes(itemKey(it))} onTap={onTap} />;

  const dropProps = (key: string | null) => ({
    onDragOver: (e: DragEvent) => {
      if (e.dataTransfer.types.includes(DRAG)) {
        e.preventDefault();
        setOver(key ?? 'pool');
      }
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(null);
      const raw = e.dataTransfer.getData(DRAG);
      if (!raw) return;
      const { taskId, stepId } = JSON.parse(raw);
      schedule(taskId, stepId, key ?? undefined);
    },
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Неделя</h1>
          <p className="sub">Нажмите на шаг, чтобы перенести его на другой день, или выберите несколько сразу. На компьютере шаги можно перетаскивать.</p>
        </div>
        <div className="row wrap">
          <button className={`btn sm ${selecting ? "violet" : ""}`} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
            <IconChecks size={16} /> {selecting ? "Отменить выбор" : "Выбрать несколько"}
          </button>
          <button className="btn icon" onClick={() => setOffset(offset - 1)} aria-label="Прошлая неделя"><IconChevronLeft size={18} /></button>
          <button className="btn sm" onClick={() => setOffset(0)} disabled={offset === 0}>Эта неделя</button>
          <button className="btn icon" onClick={() => setOffset(offset + 1)} aria-label="Следующая неделя"><IconChevronRight size={18} /></button>
        </div>
      </div>

      <div className="section-head"><h2>Не запланировано</h2><span className="small muted">{pool.length} шагов</span></div>
      <div className={`pool ${over === 'pool' ? 'over' : ''}`} {...dropProps(null)}>
        {pool.length ? pool.map((it) => <div key={it.s.id} className="pool-item">{chip(it)}</div>)
          : <span className="small faint">Все шаги распределены. Перетащите сюда шаг, чтобы снять его с дня.</span>}
      </div>

      {overdue.length > 0 && offset === 0 && (
        <div className="card soft" style={{ marginTop: 14 }}>
          <div className="row wrap" style={{ justifyContent: 'space-between' }}>
            <p style={{ fontWeight: 700 }}>С прошлых дней осталось шагов: {overdue.length}. Ничего страшного — перенесите их.</p>
            <button className="btn sm primary" onClick={() => overdue.forEach((it) => move(it, today))}>Всё на сегодня</button>
          </div>
        </div>
      )}

      {weeklyHabits.length > 0 && (
        <div className="card soft row wrap" style={{ marginTop: 14, gap: 8 }}>
          <span className="small muted" style={{ fontWeight: 700 }}>Привычки на неделю:</span>
          {weeklyHabits.map((h) => {
            const pr = weeklyProgress(h, data.habitLogs, days[0]);
            const ok = pr.done >= pr.need;
            return (
              <span key={h.id} className="tag tint" style={{ ...colorVars((CATEGORIES[h.category] ?? CATEGORIES.care).color), padding: '4px 10px' }}>
                {ok ? <IconCheck size={13} /> : <DynIcon name={h.icon} size={13} />} {h.title} · {pr.done} из {pr.need}
              </span>
            );
          })}
        </div>
      )}

      <div className="week section">
        {days.map((d) => {
          const key = dayKey(d);
          const list = allItems.filter((x) => x.s.date === key).sort((a, b) => Number(a.s.done) - Number(b.s.done));
          const habitsHere = calHabits.map((h) => ({ h, plan: calendarPlan(h, data.habitLogs, d) })).filter((x) => x.plan.show || x.plan.missed);
          // в загрузку дня входят ещё не сделанные привычки на сегодня и будущие дни
          const habitLoad = key >= today ? habitsHere.filter((x) => !x.plan.done).reduce((a, x) => a + x.h.minutes, 0) : 0;
          const load = list.reduce((a, x) => a + x.s.minutes, 0) + habitLoad;
          const ratio = load / cap;
          const color = ratio > 1 ? 'var(--danger)' : ratio > 0.8 ? 'var(--warning)' : 'var(--success)';
          return (
            <div key={key} className={`day-col ${key === today ? 'today' : ''} ${over === key ? 'over' : ''}`} {...dropProps(key)}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, color: key === today ? 'var(--accent)' : undefined }}>{weekdayShort(d)}, {dayLabel(d)}</span>
              </div>
              <Bar value={Math.min(1, ratio)} color={color} thin />
              <span className="small faint" style={{ marginTop: -2 }}>{formatMin(load)} из {formatMin(cap)}{ratio > 1 ? ' — перегруз!' : ''}</span>
              {habitsHere.map(({ h, plan }) => <HabitChip key={h.id} habit={h} done={plan.done} missed={plan.missed} day={key} isToday={key === today} canMark={key === today || key === yesterday} />)}
              {list.map(chip)}
            </div>
          );
        })}
      </div>

      {selecting && (
        <div className="select-bar">
          <span style={{ fontWeight: 800 }}>{selected.length ? `Выбрано: ${selected.length}` : 'Нажимайте на шаги, чтобы выбрать'}</span>
          <div className="row">
            <button className="btn sm ghost" style={{ color: 'inherit' }} onClick={stopSelecting}>Отмена</button>
            <button className="btn sm" disabled={!selected.length}
              onClick={() => setSheet(allItems.filter((it) => selected.includes(itemKey(it))))}>
              <IconCalendarEvent size={15} /> Перенести
            </button>
          </div>
        </div>
      )}
      {sheet && <MoveSheet items={sheet} onClose={() => setSheet(null)} onDone={stopSelecting} />}
    </div>
  );
}
