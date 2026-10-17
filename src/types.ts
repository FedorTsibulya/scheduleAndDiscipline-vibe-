// Все синхронизируемые записи имеют id и updatedAt: при слиянии данных
// с разных устройств побеждает более свежая версия каждой записи.
// Удаление — это флаг deleted (иначе удалённое «воскресло» бы при синхронизации).
export interface Syncable {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

export type ColorKey = 'purple' | 'pink' | 'coral' | 'amber' | 'teal' | 'green' | 'blue' | 'red' | 'gray';

export interface Mood extends Syncable {
  name: string;
  icon: string; // ключ из src/lib/icons.tsx
  color: ColorKey;
  order: number;
}

export interface Step {
  id: string;
  title: string;
  minutes: number;
  done: boolean;
  doneAt?: number;
  date?: string; // YYYY-MM-DD — на какой день запланирован шаг
}

export type Level3 = 1 | 2 | 3;

export interface Task extends Syncable {
  title: string;
  notes: string;
  createdAt: number;
  inbox: boolean; // ещё не разобрана
  moods: string[]; // id настроений
  difficulty: Level3;
  creativity: Level3; // 1 рутина, 2 смешанная, 3 творческая
  important: boolean;
  urgent?: boolean; // устарело: теперь срочность вычисляется из срока (due)
  due?: string; // YYYY-MM-DD — срок выполнения
  dueKind?: 'today' | 'days3' | 'week' | 'month' | 'date'; // какой вариант срока выбирали (для подсказки в редакторе)
  color: ColorKey;
  steps: Step[];
  completedAt?: number;
  // Регулярная цель (например, «12 тренировок за месяц»): прогресс = выполненные шаги / цель
  targetCount?: number;
}

export type SessionKind = 'focus' | 'rest';

export interface Session extends Syncable {
  kind: SessionKind;
  taskId?: string;
  stepId?: string;
  moodId?: string;
  start: number;
  plannedMin: number;
  actualMin: number;
  completed: boolean;
  interruptReason?: string;
}

export interface Reward extends Syncable {
  title: string;
  cost: number;
  icon: string;
}

export type PointsKind = 'step' | 'task' | 'focus' | 'achievement' | 'purchase' | 'habit';

export type HabitCategory = 'body' | 'mind' | 'home' | 'care' | 'people' | 'hobby';

// easy — простое дело на 1–10 минут, hard — дело посерьёзнее с большей наградой
export type HabitTier = 'easy' | 'hard';

// Простое ежедневное дело / полезная привычка
export interface Habit extends Syncable {
  title: string;
  minutes: number;
  category: HabitCategory;
  tier: HabitTier;
  icon: string;
  why: string; // зачем это нужно
  tip: string; // как закрепить привычку
  anchor: string; // «после того как …» — к чему привязать
  mine: boolean; // закреплена: выполнять регулярно, видна на экране «Сейчас»
  // Периодичность закреплённой привычки:
  // days — по дням недели (days: 0 = пн … 6 = вс; нет — каждый день),
  // every — раз в everyDays дней («через день» = 2), weekly — timesPerWeek раз за неделю (пн–вс)
  freq?: 'days' | 'every' | 'weekly';
  days?: number[];
  everyDays?: number;
  timesPerWeek?: number;
  builtIn?: boolean;
}

// Отметка «сделано» за конкретный день
export interface HabitLog extends Syncable {
  habitId: string;
  day: string; // YYYY-MM-DD
  at: number;
}

export interface PointsEvent extends Syncable {
  at: number;
  amount: number; // отрицательное — покупка награды
  kind: PointsKind;
  reason: string;
  taskId?: string;
  stepId?: string;
}

export interface UnlockedAchievement extends Syncable {
  at: number;
}

export interface Settings {
  updatedAt: number;
  dailyCapacityMin: number;
  focusMin: number;
  restMin: number;
  longRestMin: number;
  sound: boolean;
  notifications: boolean;
  midReminder: boolean;
  theme: 'auto' | 'light' | 'dark';
}

export interface AppData {
  version: 1;
  tasks: Task[];
  moods: Mood[];
  sessions: Session[];
  rewards: Reward[];
  points: PointsEvent[];
  achievements: UnlockedAchievement[];
  habits: Habit[];
  habitLogs: HabitLog[];
  settings: Settings;
}

// Только для этого устройства — никогда не уходит в GitHub
export interface SyncConfig {
  owner: string;
  repo: string;
  path: string;
  token: string;
  auto: boolean;
}

export interface ActiveTimer {
  kind: SessionKind;
  taskId?: string;
  stepId?: string;
  moodId?: string;
  start: number;
  plannedMin: number;
  pausedAt?: number;
  pausedTotalMs: number;
  midNotified?: boolean;
}
