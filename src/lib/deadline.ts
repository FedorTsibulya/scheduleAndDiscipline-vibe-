import type { Task } from '../types';
import { addDays, dayKey, dayLabel, parseDay, plural } from './util';

export type DeadlineKind = 'today' | 'days3' | 'week' | 'month' | 'date';

export const DEADLINE_OPTIONS: { kind: DeadlineKind; label: string }[] = [
  { kind: 'today', label: 'Сегодня' },
  { kind: 'days3', label: '2–3 дня' },
  { kind: 'week', label: 'За неделю' },
  { kind: 'month', label: 'До конца месяца' },
  { kind: 'date', label: 'Своя дата' },
];

// Превратить выбранный вариант в конкретную дату — от момента выбора.
// Дальше статус пересчитывается сам: «за неделю» через 5 дней станет «через 2 дня», потом «сегодня».
export function dueFromKind(kind: Exclude<DeadlineKind, 'date'>, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (kind === 'today') return dayKey(d);
  if (kind === 'days3') return dayKey(addDays(d, 3));
  if (kind === 'week') return dayKey(addDays(d, 7));
  return dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)); // последний день месяца
}

// Сколько дней осталось до срока (отрицательное — просрочено)
export function daysLeft(due: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseDay(due).getTime() - today.getTime()) / 86400000);
}

export type DueLevel = 'overdue' | 'today' | 'soon' | 'week' | 'later';

export function dueStatus(due: string, now = new Date()): { level: DueLevel; label: string; days: number } {
  const n = daysLeft(due, now);
  if (n < 0) return { level: 'overdue', days: n, label: `Просрочено на ${-n} ${plural(-n, 'день', 'дня', 'дней')}` };
  if (n === 0) return { level: 'today', days: n, label: 'Срок сегодня' };
  if (n === 1) return { level: 'soon', days: n, label: 'Срок завтра' };
  if (n <= 3) return { level: 'soon', days: n, label: `Через ${n} ${plural(n, 'день', 'дня', 'дней')}` };
  if (n <= 7) return { level: 'week', days: n, label: `Через ${n} ${plural(n, 'день', 'дня', 'дней')}` };
  return { level: 'later', days: n, label: `До ${dayLabel(parseDay(due))}` };
}

// Срочная — если до срока 3 дня или меньше (или он уже прошёл). Используется в матрице и подборе задач.
export const isUrgent = (t: Task, now = new Date()) => !!t.due && daysLeft(t.due, now) <= 3;

export const DUE_COLORS: Record<DueLevel, { bg: string; fg: string }> = {
  overdue: { bg: 'var(--danger-soft)', fg: 'var(--danger-text)' },
  today: { bg: 'var(--danger-soft)', fg: 'var(--danger-text)' },
  soon: { bg: 'var(--warning-soft)', fg: 'var(--warning-text)' },
  week: { bg: 'var(--surface-2)', fg: 'var(--text-2)' },
  later: { bg: 'var(--surface-2)', fg: 'var(--text-3)' },
};
