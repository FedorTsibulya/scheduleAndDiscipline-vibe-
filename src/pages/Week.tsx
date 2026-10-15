import { useState, type DragEvent } from 'react';
import { IconChevronLeft, IconChevronRight, IconCheck, IconCalendarEvent } from '@tabler/icons-react';
import type { Step, Task } from '../types';
import { liveTasks, useStore } from '../store';
import { useUI } from '../uiStore';
import { PALETTE } from '../lib/colors';
import { addDays, dayKey, dayLabel, formatMin, startOfWeek, weekdayShort } from '../lib/util';
import { Bar, colorVars } from '../components/ui';

type Item = { t: Task; s: Step };
const DRAG = 'application/x-focus-step';

function StepChip({ it, days, onMove }: { it: Item; days: Date[]; onMove: (it: Item, date?: string) => void }) {
  const toggle = useStore((s) => s.toggleStep);
  const edit = useUI((s) => s.edit);
  const p = PALETTE[it.t.color];
  return (
    <div
      className={`step-chip tint ${it.s.done ? 'done' : ''}`}
      draggable={!it.s.done}
      onDragStart={(e) => e.dataTransfer.setData(DRAG, JSON.stringify({ taskId: it.t.id, stepId: it.s.id }))}
      style={colorVars(it.t.color)}
    >
      <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
        <button
          className="check" style={{ width: 18, height: 18, borderRadius: 6, borderColor: p[400], background: it.s.done ? p[400] : 'transparent' }}
          onClick={() => toggle(it.t.id, it.s.id)} aria-label="Шаг выполнен"
        >
          {it.s.done && <IconCheck size={12} stroke={3} />}
        </button>
        <span className="grow" style={{ cursor: 'pointer' }} onClick={() => edit(it.t)}>{it.s.title}</span>
      </div>
      <div className="row tint-sub" style={{ justifyContent: 'space-between', fontWeight: 600, fontSize: 11.5 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.t.title} · {it.s.minutes} мин</span>
        {!it.s.done && (
          // на телефоне перетаскивание неудобно — переносим через список дней
          <label style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} title="Перенести на другой день">
            <IconCalendarEvent size={15} />
            <select
              value={it.s.date ?? ''} onChange={(e) => onMove(it, e.target.value || undefined)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} aria-label="Перенести на день"
            >
              <option value="">Не запланировано</option>
              {days.map((d) => <option key={dayKey(d)} value={dayKey(d)}>{weekdayShort(d)}, {dayLabel(d)}</option>)}
              {it.s.date && !days.some((d) => dayKey(d) === it.s.date) && <option value={it.s.date}>{it.s.date}</option>}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

export function WeekPage() {
  const data = useStore((s) => s.data);
  const schedule = useStore((s) => s.scheduleStep);
  const [offset, setOffset] = useState(0);
  const [over, setOver] = useState<string | null>(null);
  const start = addDays(startOfWeek(new Date()), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = dayKey();
  const cap = data.settings.dailyCapacityMin;

  const tasks = liveTasks(data).filter((t) => !t.inbox && !t.completedAt);
  const items: Item[] = tasks.flatMap((t) => t.steps.map((s) => ({ t, s })));
  const allItems: Item[] = liveTasks(data).filter((t) => !t.inbox).flatMap((t) => t.steps.map((s) => ({ t, s })));
  const pool = items.filter((x) => !x.s.done && !x.s.date);
  const overdue = items.filter((x) => !x.s.done && x.s.date && x.s.date < today);

  const move = (it: Item, date?: string) => schedule(it.t.id, it.s.id, date);

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
          <p className="sub">Перетащите шаги по дням или нажмите на значок календаря. Полоска показывает загрузку дня.</p>
        </div>
        <div className="row">
          <button className="btn icon" onClick={() => setOffset(offset - 1)} aria-label="Прошлая неделя"><IconChevronLeft size={18} /></button>
          <button className="btn sm" onClick={() => setOffset(0)} disabled={offset === 0}>Эта неделя</button>
          <button className="btn icon" onClick={() => setOffset(offset + 1)} aria-label="Следующая неделя"><IconChevronRight size={18} /></button>
        </div>
      </div>

      <div className="section-head"><h2>Не запланировано</h2><span className="small muted">{pool.length} шагов</span></div>
      <div className={`pool ${over === 'pool' ? 'over' : ''}`} {...dropProps(null)}>
        {pool.length ? pool.map((it) => <div key={it.s.id} style={{ width: 200 }}><StepChip it={it} days={days} onMove={move} /></div>)
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

      <div className="week section">
        {days.map((d) => {
          const key = dayKey(d);
          const list = allItems.filter((x) => x.s.date === key).sort((a, b) => Number(a.s.done) - Number(b.s.done));
          const load = list.reduce((a, x) => a + x.s.minutes, 0);
          const ratio = load / cap;
          const color = ratio > 1 ? 'var(--danger)' : ratio > 0.8 ? 'var(--warning)' : 'var(--success)';
          return (
            <div key={key} className={`day-col ${key === today ? 'today' : ''} ${over === key ? 'over' : ''}`} {...dropProps(key)}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, color: key === today ? 'var(--accent)' : undefined }}>{weekdayShort(d)}, {dayLabel(d)}</span>
              </div>
              <Bar value={Math.min(1, ratio)} color={color} thin />
              <span className="small faint" style={{ marginTop: -2 }}>{formatMin(load)} из {formatMin(cap)}{ratio > 1 ? ' — перегруз!' : ''}</span>
              {list.map((it) => <StepChip key={it.s.id} it={it} days={days} onMove={move} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
