import type { Task, Step } from '../types';

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
