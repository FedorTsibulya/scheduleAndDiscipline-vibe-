import { IconPlayerPlay, IconCheck, IconPencil, IconAlertTriangle, IconFlame, IconRepeat, IconArrowBackUp } from '@tabler/icons-react';
import type { Task } from '../types';
import { liveMoods, useStore } from '../store';
import { useUI } from '../uiStore';
import { allStepsDone, nextStep, repeatCountOn, repeatStreak, taskProgress } from '../lib/progress';
import { TASK_BONUS, stepPoints } from '../lib/game';
import { DynIcon } from '../lib/icons';
import { PALETTE } from '../lib/colors';
import { dayKey, formatMin, plural } from '../lib/util';
import { Bar, Dots, DueTag, MoodTag, TaskIcon, CREATIVITY } from './ui';

export function TaskCard({ task, picked, compact }: { task: Task; picked?: boolean; compact?: boolean }) {
  const moods = liveMoods(useStore((s) => s.data));
  const toggleStep = useStore((s) => s.toggleStep);
  const completeTask = useStore((s) => s.completeTask);
  const doRepeat = useStore((s) => s.doRepeat);
  const undoRepeat = useStore((s) => s.undoRepeat);
  const todayCount = task.repeat ? repeatCountOn(task) : 0;
  const streak = task.repeat ? repeatStreak(task) : 0;
  const stepsDone = allStepsDone(task);
  const edit = useUI((s) => s.edit);
  const askStart = useUI((s) => s.askStart);
  const step = nextStep(task);
  const pct = taskProgress(task);
  const p = PALETTE[task.color];
  const doneCount = task.steps.filter((s) => s.done).length;
  const total = task.targetCount || task.steps.length;
  const pts = stepPoints(task);
  const today = dayKey();
  const overdue = step?.date && step.date < today;
  const firstMood = moods.find((m) => task.moods.includes(m.id));

  return (
    <div className={`card ${picked ? 'picked' : ''}`} style={{ padding: compact ? '12px 14px' : undefined }}>
      <div className="task-card">
        <TaskIcon color={task.color}>{firstMood ? <DynIcon name={firstMood.icon} size={22} /> : task.title.slice(0, 1).toUpperCase()}</TaskIcon>
        <div className="grow">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p className="task-title">{task.title}</p>
            <button className="btn icon ghost" onClick={() => edit(task)} aria-label="Редактировать"><IconPencil size={16} /></button>
          </div>
          {task.repeat ? (
            <p className="small" style={{ color: 'var(--text-2)', marginTop: 2 }}>
              <IconRepeat size={13} style={{ verticalAlign: -2 }} /> Постоянная задача · сегодня {todayCount > 0 ? `сделано ${todayCount} ${plural(todayCount, 'раз', 'раза', 'раз')}` : 'ещё не сделана'}
              {streak > 1 && <span style={{ color: 'var(--accent)', fontWeight: 800 }}> · {streak} {plural(streak, 'день', 'дня', 'дней')} подряд</span>}
            </p>
          ) : step ? (
            <p className="small" style={{ color: 'var(--text-2)', marginTop: 2 }}>
              {total > 0 && <>Шаг {doneCount + 1} из {total} · </>}{step.title}
              <span className="faint"> · {formatMin(step.minutes)}</span>
            </p>
          ) : stepsDone ? (
            <p className="small" style={{ color: 'var(--success)', marginTop: 2, fontWeight: 700 }}>Все шаги сделаны. Завершите задачу или добавьте следующий шаг.</p>
          ) : task.steps.length === 0 ? (
            <p className="small faint" style={{ marginTop: 2 }}>Без шагов. Разбейте задачу, чтобы проще было начать.</p>
          ) : null}
          {!compact && (
            <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
              {task.important && <span className="tag" style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}><IconFlame size={13} /> Важно</span>}
              <DueTag due={task.due} />
              {overdue && <span className="tag" style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}><IconAlertTriangle size={13} /> Шаг просрочен</span>}
              {moods.filter((m) => task.moods.includes(m.id)).slice(0, 2).map((m) => <MoodTag key={m.id} mood={m} />)}
              <span className="tag" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>{CREATIVITY[task.creativity]}</span>
              <Dots n={task.difficulty} title={`Сложность ${task.difficulty} из 3`} />
            </div>
          )}
          {!task.repeat && (
            <div className="row" style={{ marginTop: 10 }}>
              <div className="grow"><Bar value={pct} color={p[400]} thin /></div>
              <span className="small" style={{ fontWeight: 800, color: 'var(--text-2)' }}>{Math.round(pct * 100)}%</span>
            </div>
          )}
          <div className="row wrap" style={{ marginTop: 12, justifyContent: 'space-between' }}>
            <span className="pill gold" style={{ fontSize: 12.5, padding: '3px 10px' }}>
              {stepsDone ? `+${TASK_BONUS} за задачу` : `+${pts.amount} ${task.repeat ? 'за раз' : 'за шаг'}`}
            </span>
            <div className="row">
              {task.repeat ? (
                <>
                  {todayCount > 0 && <button className="btn sm ghost" onClick={() => undoRepeat(task.id)} title="Отменить последнее выполнение"><IconArrowBackUp size={15} /></button>}
                  <button className="btn sm" onClick={() => doRepeat(task.id)}><IconCheck size={15} /> {todayCount > 0 ? 'Ещё раз' : 'Сделано'}</button>
                </>
              ) : step ? (
                <button className="btn sm" onClick={() => toggleStep(task.id, step.id)}><IconCheck size={15} /> Шаг сделан</button>
              ) : (
                <button className={`btn sm ${stepsDone ? 'violet' : ''}`} onClick={() => completeTask(task.id)}><IconCheck size={15} /> {stepsDone ? 'Завершить задачу' : 'Готово'}</button>
              )}
              <button className="btn primary sm" onClick={() => askStart({ taskId: task.id, stepId: step?.id })}><IconPlayerPlay size={15} /> Фокус</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
