export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const pad = (n: number) => String(n).padStart(2, '0');

// Час, в который начинается новый день (настройка). Всё, что сделано после полуночи и до этого
// часа, засчитывается за предыдущий день — для тех, кто работает за полночь.
let dayStartHour = 0;
export const setDayStartHour = (h: number) => {
  dayStartHour = Math.min(8, Math.max(0, Math.round(h)));
};
const shift = () => dayStartHour * 3600000;

// Момент начала дня приложения для календарной даты (полночь + час начала дня)
export const dayStartTs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() + shift();

// «Сейчас» в днях приложения: в 01:30 при начале дня в 04:00 это ещё вчерашний вечер
export const appNow = () => new Date(Date.now() - shift());

// Ключ дня YYYY-MM-DD. Метка времени (число) — момент события, к ней применяется начало дня;
// объект Date — уже календарный день (например, колонка недели), он не сдвигается.
export const dayKey = (d: Date | number = appNow()) => {
  const x = typeof d === 'number' ? new Date(d - shift()) : d;
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
