import type { AppData } from '../types';
import { activeDays, bestStreak, computeStreak, levelInfo, totalXp } from './game';
import { bestHabitStreak } from './habits';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  check: (c: Ctx) => boolean;
}

interface Ctx {
  data: AppData;
  stepsDone: number;
  tasksDone: number;
  focusMin: number;
  streak: number;
  level: number;
}

export function buildCtx(data: AppData): Ctx {
  const tasks = data.tasks.filter((t) => !t.deleted);
  const days = activeDays(data);
  return {
    data,
    stepsDone: tasks.reduce((a, t) => a + t.steps.filter((s) => s.done).length, 0),
    tasksDone: tasks.filter((t) => t.completedAt).length,
    focusMin: data.sessions.filter((s) => !s.deleted && s.kind === 'focus').reduce((a, s) => a + s.actualMin, 0),
    streak: Math.max(computeStreak(days).current, bestStreak(days)),
    level: levelInfo(totalXp(data.points)).level,
  };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-step', title: 'Первый шаг', description: 'Выполнить первый шаг', icon: 'sparkles', check: (c) => c.stepsDone >= 1 },
  { id: 'first-task', title: 'Первая победа', description: 'Завершить первую задачу', icon: 'star', check: (c) => c.tasksDone >= 1 },
  { id: 'steps-50', title: 'Полсотни шагов', description: 'Выполнить 50 шагов', icon: 'run', check: (c) => c.stepsDone >= 50 },
  { id: 'steps-200', title: 'Марафонец', description: 'Выполнить 200 шагов', icon: 'flame', check: (c) => c.stepsDone >= 200 },
  { id: 'focus-10h', title: '10 часов фокуса', description: 'Набрать 10 часов в таймере фокуса', icon: 'target', check: (c) => c.focusMin >= 600 },
  { id: 'focus-50h', title: '50 часов фокуса', description: 'Набрать 50 часов в таймере фокуса', icon: 'brain', check: (c) => c.focusMin >= 3000 },
  { id: 'streak-7', title: 'Неделя подряд', description: 'Серия из 7 дней', icon: 'sun', check: (c) => c.streak >= 7 },
  { id: 'streak-30', title: 'Месяц подряд', description: 'Серия из 30 дней', icon: 'moon', check: (c) => c.streak >= 30 },
  {
    id: 'postponed', title: 'Победил отложенное', description: 'Завершить задачу, которая ждала 30+ дней', icon: 'heart',
    check: (c) => c.data.tasks.some((t) => !t.deleted && t.completedAt && t.completedAt - t.createdAt >= 30 * 86400000),
  },
  {
    id: 'creative-5', title: 'Творец', description: 'Завершить 5 творческих задач', icon: 'palette',
    check: (c) => c.data.tasks.filter((t) => !t.deleted && t.completedAt && t.creativity === 3).length >= 5,
  },
  {
    id: 'hard-5', title: 'Крепкий орешек', description: 'Завершить 5 сложных задач', icon: 'bolt',
    check: (c) => c.data.tasks.filter((t) => !t.deleted && t.completedAt && t.difficulty === 3).length >= 5,
  },
  {
    id: 'early-bird', title: 'Ранняя пташка', description: 'Полный фокус, начатый до 9 утра', icon: 'coffee',
    check: (c) => c.data.sessions.some((s) => !s.deleted && s.kind === 'focus' && s.completed && new Date(s.start).getHours() < 9),
  },
  {
    id: 'all-moods', title: 'На любой вкус', description: 'Фокус в 5 разных настроениях', icon: 'smile',
    check: (c) => new Set(c.data.sessions.filter((s) => !s.deleted && s.kind === 'focus' && s.moodId).map((s) => s.moodId)).size >= 5,
  },
  {
    id: 'reward-first', title: 'Заслуженный отдых', description: 'Купить первую награду', icon: 'gift',
    check: (c) => c.data.points.some((p) => !p.deleted && p.kind === 'purchase'),
  },
  {
    id: 'habit-first', title: 'Маленький шаг', description: 'Сделать первое простое дело из пула', icon: 'droplet',
    check: (c) => c.data.habitLogs.some((l) => !l.deleted),
  },
  {
    id: 'habit-7', title: 'Привычка заводится', description: 'Одна привычка 7 дней подряд', icon: 'plant',
    check: (c) => bestHabitStreak(c.data) >= 7,
  },
  {
    id: 'habit-30', title: 'Это уже я', description: 'Одна привычка 30 дней подряд', icon: 'heart',
    check: (c) => bestHabitStreak(c.data) >= 30,
  },
  {
    id: 'habit-100', title: 'Мастер мелочей', description: 'Сделать 100 простых дел', icon: 'sparkles',
    check: (c) => c.data.habitLogs.filter((l) => !l.deleted).length >= 100,
  },
  {
    id: 'habit-hard-10', title: 'Не только мелочи', description: 'Сделать 10 дел посерьёзнее', icon: 'barbell',
    check: (c) => c.data.habitLogs.filter((l) => !l.deleted && c.data.habits.find((x) => x.id === l.habitId)?.tier === 'hard').length >= 10,
  },
  {
    id: 'habit-all-day', title: 'Идеальный день', description: 'Выполнить все закреплённые привычки за день', icon: 'sun',
    check: (c) => c.data.points.some((p) => !p.deleted && p.kind === 'habit' && p.stepId?.startsWith('all-')),
  },
  { id: 'level-5', title: 'Уровень 5', description: 'Дорасти до 5 уровня', icon: 'flame', check: (c) => c.level >= 5 },
  { id: 'level-10', title: 'Уровень 10', description: 'Дорасти до 10 уровня', icon: 'star', check: (c) => c.level >= 10 },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
