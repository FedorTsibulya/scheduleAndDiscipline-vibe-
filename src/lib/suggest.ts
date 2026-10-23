import type { Task } from '../types';
import { allStepsDone, isActive, nextStep, repeatCountOn } from './progress';
import { dayKey } from './util';
import { daysLeft } from './deadline';

// Насколько задача «просится» сейчас: важность, срочность, запланированность на сегодня,
// просрочка, давность и совпадение с настроением.
export function scoreTask(t: Task, moodId: string | null, now = Date.now()): number {
  const today = dayKey(now);
  const step = nextStep(t);
  // все шаги сделаны — осталось только завершить: в подборке, но в самом конце
  if (allStepsDone(t)) return 0.5;
  let s = 1;
  // постоянная задача: если сегодня уже сделана — ниже, если нет — повыше (её смысл в регулярности)
  if (t.repeat) s += repeatCountOn(t, today) > 0 ? -1 : 2;
  if (t.important) s += 3;
  if (t.due) {
    // чем ближе срок, тем выше задача; просроченные — выше всех
    const left = daysLeft(t.due, new Date(now));
    s += left < 0 ? 5 : left === 0 ? 4 : left <= 3 ? 3 : left <= 7 ? 1 : 0;
  }
  if (step?.date) {
    if (step.date === today) s += 3;
    else if (step.date < today) s += 4;
  }
  s += Math.min(2, (now - t.createdAt) / (7 * 86400000));
  if (moodId && t.moods.includes(moodId)) s += 2;
  return s;
}

export function candidates(tasks: Task[], moodId: string | null): Task[] {
  return tasks.filter((t) => {
    if (!isActive(t)) return false;
    // регулярная цель, у которой не осталось шагов, предлагать нечего
    if (t.targetCount && t.steps.length && !nextStep(t)) return false;
    // без настроения подходит под любое; с настроением — только под отмеченные
    return !moodId || t.moods.length === 0 || t.moods.includes(moodId);
  });
}

export function suggest(tasks: Task[], moodId: string | null, n = 3): Task[] {
  return candidates(tasks, moodId)
    .map((t) => ({ t, s: scoreTask(t, moodId) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.t);
}

// Случайная задача: чем выше оценка, тем больше шанс, но шанс есть у всех
export function randomTask(tasks: Task[], moodId: string | null, excludeId?: string): Task | undefined {
  let pool = candidates(tasks, moodId);
  if (pool.length > 1 && excludeId) pool = pool.filter((t) => t.id !== excludeId);
  if (!pool.length) return undefined;
  const w = pool.map((t) => scoreTask(t, moodId));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
