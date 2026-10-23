import type { Task, Step } from '../types';
import { addDays, dayKey, parseDay } from './util';

const weight = (s: Step) => Math.max(1, s.minutes || 0);

// Доля выполнения задачи (0..1) на момент времени `at`.
// Шаги весят столько, сколько на них запланировано минут.
// Для регулярной цели (targetCount) — число выполненных шагов / цель.
export function taskProgress(task: Task, at = Number.POSITIVE_INFINITY): number {
  const doneBy = (s: Step) => s.done && (s.doneAt ?? 0) <= at;
  if (task.targetCount && task.targetCount > 0) {
    return Math.min(1, task.steps.filter(doneBy).length / task.targetCount);
  }
  if (task.steps.length === 0) {
    return task.completedAt && task.completedAt <= at ? 1 : 0;
  }
  const total = task.steps.reduce((a, s) => a + weight(s), 0);
  const done = task.steps.filter(doneBy).reduce((a, s) => a + weight(s), 0);
  return total ? done / total : 0;
}

export function isComplete(task: Task): boolean {
  if (task.targetCount && task.targetCount > 0) {
    return task.steps.filter((s) => s.done).length >= task.targetCount;
  }
  return task.steps.length > 0 && task.steps.every((s) => s.done);
}

export const nextStep = (task: Task) => task.steps.find((s) => !s.done);

export const remainingMinutes = (task: Task) =>
  task.steps.filter((s) => !s.done).reduce((a, s) => a + (s.minutes || 0), 0);

export const isActive = (t: Task) => !t.deleted && !t.inbox && !t.completedAt;

// ---------- постоянные задачи ----------

// Сколько раз постоянная задача выполнена в день (ключ YYYY-MM-DD, с учётом начала дня)
export const repeatCountOn = (t: Task, day = dayKey()) => (t.doneLog ?? []).filter((ts) => dayKey(ts) === day).length;

// Серия дней подряд с выполнением (сегодня ещё можно успеть — несделанное сегодня серию не рвёт)
export function repeatStreak(t: Task): number {
  const days = new Set((t.doneLog ?? []).map((ts) => dayKey(ts)));
  let d = parseDay(dayKey());
  if (!days.has(dayKey(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// Все шаги сделаны, но задача ещё не завершена — пора нажать «Завершить задачу» или добавить шаги
export const allStepsDone = (t: Task) => !t.repeat && !t.targetCount && t.steps.length > 0 && t.steps.every((s) => s.done);
