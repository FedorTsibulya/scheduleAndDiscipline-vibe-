import type { AppData, PointsEvent, Task } from '../types';
import { addDays, appNow, dayKey } from './util';

export const TASK_BONUS = 50;
export const ACHIEVEMENT_BONUS = 25;

// Очки за шаг: база 10, +5 за каждую ступень сложности,
// бонус за «долгоиграющие» задачи — чтобы отложенное было выгодно наконец сделать.
export function stepPoints(task: Task, now = Date.now()) {
  const base = 10 + (task.difficulty - 1) * 5;
  const ageDays = (now - task.createdAt) / 86400000;
  const postponed = ageDays >= 30 ? 15 : ageDays >= 7 ? 5 : 0;
  return { amount: base + postponed, postponed };
}

// +1 за каждые 5 минут; сдержанное обещание приносит минимум 1 очко, даже если фокус был коротким
export const focusPoints = (min: number, completed = false) => Math.max(completed && min >= 1 ? 1 : 0, Math.floor(min / 5));

const alive = (p: PointsEvent) => !p.deleted;

export const balance = (points: PointsEvent[]) =>
  points.filter(alive).reduce((a, p) => a + p.amount, 0);

export const totalXp = (points: PointsEvent[]) =>
  Math.max(0, points.filter((p) => alive(p) && p.kind !== 'purchase').reduce((a, p) => a + p.amount, 0));

// Каждый следующий уровень требует на 50 опыта больше: 100, 150, 200…
export function levelInfo(xp: number) {
  let level = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level += 1;
    need = 100 + 50 * (level - 1);
  }
  return { level, into: rest, need };
}

// Дни, когда была хоть какая-то работа: закрытый шаг, фокус от 5 минут или простое дело из пула.
// Простые дела тоже держат серию — в день без сил достаточно стакана воды.
export function activeDays(data: AppData): Set<string> {
  const s = new Set<string>();
  for (const l of data.habitLogs ?? []) if (!l.deleted) s.add(l.day);
  for (const t of data.tasks) {
    if (t.deleted) continue;
    for (const st of t.steps) if (st.done && st.doneAt) s.add(dayKey(st.doneAt));
    if (t.completedAt) s.add(dayKey(t.completedAt));
  }
  for (const se of data.sessions) {
    if (!se.deleted && se.kind === 'focus' && se.actualMin >= 5) s.add(dayKey(se.start));
  }
  return s;
}

// Серия дней подряд с «заморозкой»: один пропущенный день в 7 дней не обнуляет серию.
// Считается из истории, поэтому одинаково на всех устройствах.
export function computeStreak(active: Set<string>, now = appNow()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const keys = [...active].sort();
  const empty = { current: 0, todayDone: false, freezeReady: true, freezeUsedOn: undefined as string | undefined, readyIn: 0 };
  if (!keys.length) return empty;
  const earliest = keys[0];
  const todayDone = active.has(dayKey(today));
  let d = todayDone ? today : addDays(today, -1);
  let i = 0;
  let count = 0;
  let lastFreeze = -100;
  const freezes: { key: string; offset: number }[] = [];
  for (; i < 3650; i++) {
    const k = dayKey(d);
    if (k < earliest) break;
    if (active.has(k)) count++;
    else if (i - lastFreeze >= 7) {
      // пропуск прощается, если за последние 7 дней заморозка ещё не тратилась
      lastFreeze = i;
      freezes.push({ key: k, offset: i });
    } else break;
    d = addDays(d, -1);
  }
  // Заморозка, «съевшая» начало, без единого активного дня до неё — не серия
  if (count === 0) return { ...empty, todayDone };
  const recent = freezes[0];
  const daysSince = recent ? recent.offset + (todayDone ? 0 : 1) : 99;
  return {
    current: count,
    todayDone,
    freezeReady: daysSince >= 7,
    freezeUsedOn: recent?.key,
    readyIn: Math.max(0, 7 - daysSince),
  };
}

// Лучшая серия за всё время (с теми же правилами заморозки)
export function bestStreak(active: Set<string>): number {
  const keys = [...active].sort();
  if (!keys.length) return 0;
  let best = 0;
  for (const k of keys) {
    const [y, m, dd] = k.split('-').map(Number);
    const next = dayKey(new Date(y, m - 1, dd + 1));
    if (active.has(next)) continue; // считаем только от концов серий
    best = Math.max(best, computeStreak(active, new Date(y, m - 1, dd)).current);
  }
  return best;
}
