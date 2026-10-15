export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (d: Date | number = new Date()) => {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

export const parseDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7; // понедельник = 0
  return addDays(x, -wd);
};

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export const weekdayShort = (d: Date) => WD[(d.getDay() + 6) % 7];
export const dayLabel = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]}`;

export const formatMin = (min: number) => {
  const m = Math.round(min);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
};

export const formatClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};

// Русские окончания: plural(5, 'очко', 'очка', 'очков')
export const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
