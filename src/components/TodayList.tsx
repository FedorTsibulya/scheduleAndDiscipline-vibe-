import { useMemo, useState } from 'react';
import { IconCheck, IconPlayerPlay, IconPencil, IconArrowBackUp, IconFlame } from '@tabler/icons-react';
import type { Task } from '../types';
import { liveMoods, useStore } from '../store';
import { useUI } from '../uiStore';
import { allStepsDone, nextStep, repeatCountOn, repeatStreak, taskProgress } from '../lib/progress';
import { daysLeft, dueStatus } from '../lib/deadline';
import { stepPoints, TASK_BONUS } from '../lib/game';
import { PALETTE } from '../lib/colors';
import { DynIcon } from '../lib/icons';
import { formatMin, plural } from '../lib/util';
import { Dots } from './ui';

// Горит: срок сегодня или уже прошёл
export const isHot = (t: Task) => !!t.due && !t.completedAt && daysLeft(t.due) <= 0;

// Главное действие по задаче: отметить следующий шаг, «сделано» для постоянной, «завершить», если шаги кончились
function useMainAction(task: Task) {
  const toggleStep = useStore((s) => s.toggleStep);
  const completeTask = useStore((s) => s.completeTask);
  const doRepeat = useStore((s) => s.doRepeat);
  const step = nextStep(task);
  if (task.repeat) return { label: repeatCountOn(task) > 0 ? 'Ещё раз' : 'Сделано', run: () => doRepeat(task.id) };
  if (step) return { label: 'Шаг сделан', run: () => toggleStep(task.id, step.id) };
  return { label: allStepsDone(task) ? 'Завершить задачу' : 'Готово', run: () => completeTask(task.id) };
}

// Короткая подпись под названием: следующий шаг / серия постоянной задачи / «можно завершить»
function subtitle(task: Task): string {
  if (task.repeat) {
    const n = repeatCountOn(task);
    const s = repeatStreak(task);
    return `🔁 ${n ? `сегодня ${n} ${plural(n, 'раз', 'раза', 'раз')}` : 'сегодня ещё нет'}${s > 1 ? ` · ${s} ${plural(s, 'день', 'дня', 'дней')} подряд` : ''}`;
  }
  if (allStepsDone(task)) return 'все шаги сделаны — можно завершить';
  const step = nextStep(task);
  if (step) return `${step.title} · ${formatMin(step.minutes)}`;
  return 'без шагов';
}

// Нарисованный огонь по низу плашки: языки в три слоя (красный, оранжевый, жёлтая сердцевина),
// у каждого своя высота и ритм — набор выбирается один раз, чтобы пламя не «прыгало» при перерисовке
const FIRE_W = 420;
const FIRE_H = 34;
const FIRE_LAYERS = [
  { color: '#E24B4A', w: 26, h: 1, lag: 0 },
  { color: '#EF9F27', w: 18, h: 0.72, lag: 0.1 },
  { color: '#FAC775', w: 9, h: 0.42, lag: 0.2 },
];

function tonguePath(cx: number, w: number, h: number) {
  const x0 = cx - w / 2;
  const top = FIRE_H - h;
  return `M${x0} ${FIRE_H} C${x0} ${FIRE_H - h * 0.45} ${cx - w * 0.1} ${top + h * 0.35} ${cx} ${top} C${cx + w * 0.1} ${top + h * 0.35} ${x0 + w} ${FIRE_H - h * 0.45} ${x0 + w} ${FIRE_H} Z`;
}

function FireStrip() {
  const tongues = useMemo(() => {
    const n = 22;
    return Array.from({ length: n }, (_, i) => ({
      cx: (i + 0.5) * (FIRE_W / n) + (Math.random() - 0.5) * 6,
      h: 20 + Math.random() * 14,
      delay: Math.random(),
      dur: 0.6 + Math.random() * 0.6,
    }));
  }, []);
  return (
    <span className="fire-strip" aria-hidden="true">
      <svg viewBox={`0 0 ${FIRE_W} ${FIRE_H}`} preserveAspectRatio="none">
        {tongues.map((t, i) =>
          FIRE_LAYERS.map((l) => (
            <path
              key={`${i}-${l.color}`}
              className="tongue"
              fill={l.color}
              style={{ animationDelay: `${t.delay + l.lag}s`, animationDuration: `${t.dur}s` }}
              d={tonguePath(t.cx, l.w, t.h * l.h)}
            />
          )),
        )}
      </svg>
    </span>
  );
}

// Огненная строка: задача, срок которой сегодня или уже прошёл
export function HotRow({ task }: { task: Task }) {
  const askStart = useUI((s) => s.askStart);
  const edit = useUI((s) => s.edit);
  const action = useMainAction(task);
  const st = dueStatus(task.due!);
  return (
    <div className={`hot-row ${st.level === 'overdue' ? 'overdue' : ''}`}>
      <span className="flame" aria-hidden="true">🔥</span>
      <button className="grow hot-main" onClick={() => edit(task)}>
        <span className="t">{task.title}</span>
        <span className="s">{st.level === 'overdue' ? st.label.toLowerCase() : 'срок сегодня'} · {subtitle(task)}</span>
      </button>
      <button className="hot-btn" onClick={action.run} aria-label={action.label} title={action.label}><IconCheck size={16} stroke={3} /></button>
      <button className="hot-btn" onClick={() => askStart({ taskId: task.id, stepId: nextStep(task)?.id })} aria-label="Начать фокус" title="Начать фокус"><IconPlayerPlay size={16} /></button>
      {st.level === 'overdue' && <FireStrip />}
    </div>
  );
}

// Строка списка: цветной кружок — главное действие, нажатие на строку раскрывает детали
export function TodayRow({ task, picked, rolling }: { task: Task; picked?: boolean; rolling?: boolean }) {
  const moods = liveMoods(useStore((s) => s.data));
  const undoRepeat = useStore((s) => s.undoRepeat);
  const askStart = useUI((s) => s.askStart);
  const edit = useUI((s) => s.edit);
  const [open, setOpen] = useState(false);
  const action = useMainAction(task);
  const color = PALETTE[task.color][400];
  const pts = task.repeat || nextStep(task) || !allStepsDone(task) ? stepPoints(task).amount : TASK_BONUS;
  const pct = task.repeat ? 0 : taskProgress(task);
  const soon = task.due && !isHot(task) ? dueStatus(task.due) : null;
  const taskMoods = moods.filter((m) => task.moods.includes(m.id));
  return (
    <div className={`today-row ${picked ? 'picked' : ''} ${rolling ? 'rolling' : ''} ${open ? 'open' : ''}`}>
      <div className="row" style={{ gap: 12 }}>
        <button className="ring-check" style={{ borderColor: color }} onClick={action.run} aria-label={action.label} title={`${action.label} · +${pts}`}>
          <IconCheck size={13} stroke={3} style={{ color }} />
        </button>
        <button className="grow today-main" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="t">
            {task.title}
            {task.important && <IconFlame size={13} style={{ color: 'var(--accent)', marginLeft: 4, verticalAlign: -1 }} aria-label="важно" />}
          </span>
          <span className="s">
            {subtitle(task)}
            {soon && soon.level !== 'later' && <span style={{ color: soon.level === 'soon' ? 'var(--warning)' : undefined }}> · {soon.label.toLowerCase()}</span>}
          </span>
          {pct > 0 && pct < 1 && <span className="mini-bar"><span style={{ width: `${Math.round(pct * 100)}%`, background: color }} /></span>}
        </button>
      </div>
      {open && (
        <div className="today-details">
          <div className="row wrap" style={{ gap: 6 }}>
            {taskMoods.map((m) => <span key={m.id} className="small muted row" style={{ gap: 3 }}><DynIcon name={m.icon} size={13} /> {m.name}</span>)}
            <Dots n={task.difficulty} title={`Сложность ${task.difficulty} из 3`} />
            <span className="small faint">+{pts} {task.repeat ? 'за раз' : 'за шаг'}</span>
          </div>
          <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
            <button className="btn sm primary" onClick={() => askStart({ taskId: task.id, stepId: nextStep(task)?.id })}><IconPlayerPlay size={14} /> Фокус</button>
            <button className="btn sm" onClick={action.run}><IconCheck size={14} /> {action.label}</button>
            {task.repeat && repeatCountOn(task) > 0 && <button className="btn sm ghost" onClick={() => undoRepeat(task.id)}><IconArrowBackUp size={14} /> Отменить раз</button>}
            <button className="btn sm ghost" onClick={() => edit(task)}><IconPencil size={14} /> Изменить</button>
          </div>
        </div>
      )}
    </div>
  );
}
