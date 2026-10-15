import type { AppData, Mood, Reward, Settings } from '../types';
import { DEFAULT_HABITS } from './habits';

const t0 = 1;

export const DEFAULT_MOODS: Mood[] = [
  { id: 'm-energetic', name: 'Бодрый', icon: 'bolt', color: 'amber', order: 0, updatedAt: t0 },
  { id: 'm-sluggish', name: 'Вялый', icon: 'battery', color: 'gray', order: 1, updatedAt: t0 },
  { id: 'm-creative', name: 'Творческий', icon: 'palette', color: 'purple', order: 2, updatedAt: t0 },
  { id: 'm-anxious', name: 'Тревожный', icon: 'wave', color: 'blue', order: 3, updatedAt: t0 },
  { id: 'm-social', name: 'Социальный', icon: 'users', color: 'pink', order: 4, updatedAt: t0 },
  { id: 'm-focused', name: 'Сосредоточенный', icon: 'target', color: 'teal', order: 5, updatedAt: t0 },
  { id: 'm-tired', name: 'Устал физически', icon: 'zzz', color: 'coral', order: 6, updatedAt: t0 },
];

export const DEFAULT_REWARDS: Reward[] = [
  { id: 'r-coffee', title: 'Вкусный кофе или чай', cost: 60, icon: 'coffee', updatedAt: t0 },
  { id: 'r-episode', title: 'Серия сериала', cost: 120, icon: 'movie', updatedAt: t0 },
  { id: 'r-game', title: 'Час игры без чувства вины', cost: 200, icon: 'gamepad', updatedAt: t0 },
  { id: 'r-treat', title: 'Заказать что-то вкусное', cost: 400, icon: 'pizza', updatedAt: t0 },
];

export const DEFAULT_SETTINGS: Settings = {
  updatedAt: t0,
  dailyCapacityMin: 240,
  focusMin: 25,
  restMin: 5,
  longRestMin: 15,
  sound: true,
  notifications: true,
  midReminder: true,
  theme: 'auto',
};

export const emptyData = (): AppData => ({
  version: 1,
  tasks: [],
  moods: DEFAULT_MOODS.map((m) => ({ ...m })),
  sessions: [],
  rewards: DEFAULT_REWARDS.map((r) => ({ ...r })),
  points: [],
  achievements: [],
  habits: DEFAULT_HABITS.map((h) => ({ ...h })),
  habitLogs: [],
  settings: { ...DEFAULT_SETTINGS },
});

export const INTERRUPT_REASONS = [
  'Отвлёкся на телефон',
  'Устал',
  'Непонятно, что делать дальше',
  'Срочное дело',
  'Задача оказалась больше',
  'Другое',
];

export const CHEERS = [
  'Отлично!', 'Так держать!', 'Ещё шаг позади!', 'Красота!', 'Ты в потоке!',
  'Мощно!', 'Вот это да!', 'Шаг за шагом!', 'Огонь!', 'Продолжай в том же духе!',
];
