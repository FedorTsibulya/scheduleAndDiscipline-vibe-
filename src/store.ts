import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ActiveTimer, AppData, Habit, Mood, PointsEvent, PointsKind, Reward, Session, Settings, Step, SyncConfig, Task,
} from './types';
import { emptyData } from './lib/defaults';
import { dayKey, dayStartTs, parseDay, setDayStartHour, uid } from './lib/util';
import { ALL_HABITS_BONUS, habitPoints, pinnedFor, upgradeBuiltinHabits } from './lib/habits';
import { isComplete } from './lib/progress';
import { ACHIEVEMENTS, buildCtx } from './lib/achievements';
import type { AiConfig, WeeklyReview } from './lib/ai';
import { buildMerged, planReopen, type MergeMode } from './lib/taskOps';
import { dueFromKind } from './lib/deadline';
import { ACHIEVEMENT_BONUS, TASK_BONUS, balance, focusPoints, levelInfo, stepPoints, totalXp } from './lib/game';

// ---------- праздники (не сохраняются) ----------

export type Celebration =
  | { id: string; type: 'step'; points: number; postponed: number }
  | { id: string; type: 'task'; title: string; points: number; taskId: string }
  | { id: string; type: 'achievement'; achievementId: string }
  | { id: string; type: 'level'; level: number }
  | { id: string; type: 'focus'; points: number; minutes: number }
  | { id: string; type: 'habit'; points: number; title: string }
  | { id: string; type: 'allHabits'; points: number; count: number }
  | { id: string; type: 'undo'; points: number };

type CelebrationInput =
  | { type: 'undo'; points: number }
  | { type: 'habit'; points: number; title: string }
  | { type: 'allHabits'; points: number; count: number }
  | { type: 'step'; points: number; postponed: number }
  | { type: 'task'; title: string; points: number; taskId: string }
  | { type: 'achievement'; achievementId: string }
  | { type: 'level'; level: number }
  | { type: 'focus'; points: number; minutes: number };

export type SyncStatus = { state: 'idle' | 'syncing' | 'ok' | 'error'; at?: number; message?: string };

interface State {
  data: AppData;
  timer: ActiveTimer | null;
  sync: SyncConfig;
  syncStatus: SyncStatus;
  ai: AiConfig;
  lastReview: { at: number; review: WeeklyReview } | null;
  currentMood: string | null;
  celebrations: Celebration[];

  // задачи
  addInbox: (title: string) => void;
  saveTask: (t: Task) => void;
  deleteTask: (id: string) => void;
  toggleStep: (taskId: string, stepId: string) => void;
  completeTask: (taskId: string) => void;
  reopenTask: (taskId: string) => void;
  mergeTasks: (ids: string[], mode: MergeMode, keepSubsteps: boolean) => string | null;
  scheduleStep: (taskId: string, stepId: string, date: string | undefined) => void;

  // простые дела и привычки
  toggleHabit: (habitId: string, day?: string) => void;
  saveHabit: (h: Habit) => void;
  deleteHabit: (id: string) => void;

  // настроения, награды, настройки
  setMood: (id: string | null) => void;
  saveMood: (m: Mood) => void;
  deleteMood: (id: string) => void;
  saveReward: (r: Reward) => void;
  deleteReward: (id: string) => void;
  buyReward: (id: string) => boolean;
  updateSettings: (patch: Partial<Settings>) => void;

  // таймер
  startTimer: (t: Omit<ActiveTimer, 'start' | 'pausedTotalMs'>) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  markMidNotified: () => void;
  finishTimer: (completed: boolean, reason?: string) => Session | null;
  cancelTimer: () => void;

  // синхронизация и данные
  setSyncConfig: (c: Partial<SyncConfig>) => void;
  setSyncStatus: (s: SyncStatus) => void;
  setAi: (c: Partial<AiConfig>) => void;
  setLastReview: (r: WeeklyReview) => void;
  replaceData: (d: AppData) => void;
  importData: (d: AppData) => void;
  resetAll: () => void;

  dismissCelebration: (id: string) => void;
}

const now = () => Date.now();

const pointsEvent = (kind: PointsKind, amount: number, reason: string, extra: Partial<PointsEvent> = {}): PointsEvent => ({
  id: uid(), updatedAt: now(), at: now(), kind, amount, reason, ...extra,
});

// При отмене (вернуть задачу, снять отметку шага или привычки) достижения, условие которых
// больше не выполняется, отзываются вместе со своими очками — иначе отмена «не возвращает» награду
function revokeLost(data: AppData): { data: AppData; points: number } {
  const ctx = buildCtx(data);
  const lost = ACHIEVEMENTS.filter((a) => data.achievements.some((u) => u.id === a.id && !u.deleted) && !a.check(ctx));
  if (!lost.length) return { data, points: 0 };
  const ids = new Set(lost.map((a) => a.id));
  // старые события очков за достижения не хранят id — узнаём их по тексту
  const isLost = (p: PointsEvent) =>
    !p.deleted && p.kind === 'achievement' && lost.some((a) => p.stepId === a.id || p.reason === `Достижение: ${a.title}`);
  const removed = data.points.filter(isLost).reduce((a, p) => a + p.amount, 0);
  return {
    points: removed,
    data: {
      ...data,
      achievements: data.achievements.map((u) => (ids.has(u.id) && !u.deleted ? { ...u, deleted: true, updatedAt: now() } : u)),
      points: data.points.map((p) => (isLost(p) ? { ...p, deleted: true, updatedAt: now() } : p)),
    },
  };
}

// После каждого изменения: проверяем новые достижения и повышение уровня
function withRewards(prev: AppData, next: AppData, extra: CelebrationInput[], revoke = false): { data: AppData; cel: CelebrationInput[] } {
  const cel = [...extra];
  if (revoke) {
    const r = revokeLost(next);
    next = r.data;
    // сколько очков снято всего: разница баланса до и после
    const lostTotal = balance(prev.points) - balance(next.points);
    if (lostTotal > 0) cel.push({ type: 'undo', points: lostTotal });
  }
  const unlocked = new Set(next.achievements.filter((a) => !a.deleted).map((a) => a.id));
  const ctx = buildCtx(next);
  const fresh = ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.check(ctx));
  let data = next;
  if (fresh.length) {
    data = {
      ...data,
      achievements: [
        ...data.achievements.filter((a) => !fresh.some((f) => f.id === a.id)),
        ...fresh.map((f) => ({ id: f.id, at: now(), updatedAt: now() })),
      ],
      points: [
        ...data.points,
        ...fresh.map((f) => pointsEvent('achievement', ACHIEVEMENT_BONUS, `Достижение: ${f.title}`, { stepId: f.id })),
      ],
    };
    for (const f of fresh) cel.push({ type: 'achievement', achievementId: f.id });
  }
  const before = levelInfo(totalXp(prev.points)).level;
  const after = levelInfo(totalXp(data.points)).level;
  if (after > before) cel.push({ type: 'level', level: after });
  return { data, cel };
}

const touch = <T extends { updatedAt: number }>(x: T): T => ({ ...x, updatedAt: now() });

export const useStore = create<State>()(
  persist(
    (set, get) => {
      // Применить изменение данных с проверкой наград и праздников
      const commit = (fn: (d: AppData) => AppData, extra: CelebrationInput[] = [], opts: { revoke?: boolean } = {}) => {
        const prev = get().data;
        const { data, cel } = withRewards(prev, fn(prev), extra, opts.revoke);
        set((s) => ({
          data,
          celebrations: [...s.celebrations, ...cel.map((c) => ({ ...c, id: uid() }) as Celebration)],
        }));
      };

      const mapTask = (d: AppData, id: string, fn: (t: Task) => Task): AppData => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === id ? touch(fn(t)) : t)),
      });

      return {
        data: emptyData(),
        timer: null,
        sync: { owner: '', repo: '', path: 'focus-quest-data.json', token: '', auto: true },
        syncStatus: { state: 'idle' },
        ai: { apiKey: '', model: 'claude-opus-5-5' },
        lastReview: null,
        currentMood: null,
        celebrations: [],

        addInbox: (title) =>
          commit((d) => ({
            ...d,
            tasks: [
              ...d.tasks,
              {
                id: uid(), updatedAt: now(), createdAt: now(), title: title.trim(), notes: '', inbox: true,
                moods: [], difficulty: 2, creativity: 2, important: false, color: 'purple', steps: [],
              },
            ],
          })),

        saveTask: (t) =>
          commit((d) => {
            const exists = d.tasks.some((x) => x.id === t.id);
            let task = touch(t);
            // если все шаги отмечены в редакторе — задача завершена; если сняты — снова открыта
            if (!task.completedAt && isComplete(task)) task = { ...task, completedAt: now() };
            if (task.completedAt && task.steps.length && !isComplete(task)) task = { ...task, completedAt: undefined };
            return { ...d, tasks: exists ? d.tasks.map((x) => (x.id === t.id ? task : x)) : [...d.tasks, task] };
          }),

        deleteTask: (id) => commit((d) => mapTask(d, id, (t) => ({ ...t, deleted: true }))),

        toggleStep: (taskId, stepId) => {
          const d0 = get().data;
          const task = d0.tasks.find((t) => t.id === taskId);
          const step = task?.steps.find((s) => s.id === stepId);
          if (!task || !step) return;
          const cel: CelebrationInput[] = [];
          commit((d) => {
            if (!step.done) {
              const pts = stepPoints(task, now());
              const steps: Step[] = task.steps.map((s) => (s.id === stepId ? { ...s, done: true, doneAt: now() } : s));
              let updated: Task = { ...task, steps };
              const events = [pointsEvent('step', pts.amount, `Шаг: ${step.title}`, { taskId, stepId })];
              if (!task.completedAt && isComplete(updated)) {
                updated = { ...updated, completedAt: now() };
                events.push(pointsEvent('task', TASK_BONUS, `Задача завершена: ${task.title}`, { taskId }));
                cel.push({ type: 'task', title: task.title, points: pts.amount + TASK_BONUS, taskId });
              } else {
                cel.push({ type: 'step', points: pts.amount, postponed: pts.postponed });
              }
              return { ...mapTask(d, taskId, () => updated), points: [...d.points, ...events] };
            }
            // отмена шага: очки за него (и бонус за задачу) аннулируются
            const steps = task.steps.map((s) => (s.id === stepId ? { ...s, done: false, doneAt: undefined } : s));
            const reopen = !!task.completedAt;
            return {
              ...mapTask(d, taskId, (t) => ({ ...t, steps, completedAt: reopen ? undefined : t.completedAt })),
              points: d.points.map((p) =>
                !p.deleted && p.taskId === taskId && (p.stepId === stepId || (reopen && p.kind === 'task'))
                  ? { ...p, deleted: true, updatedAt: now() }
                  : p,
              ),
            };
          }, cel, { revoke: step.done });
        },

        // Завершить задачу целиком (для задач без шагов или «закрыть досрочно»)
        completeTask: (taskId) => {
          const task = get().data.tasks.find((t) => t.id === taskId);
          if (!task || task.completedAt) return;
          const pts = stepPoints(task, now()).amount;
          commit(
            (d) => ({
              ...mapTask(d, taskId, (t) => ({
                ...t,
                completedAt: now(),
                steps: t.targetCount ? t.steps : t.steps.map((s) => (s.done ? s : { ...s, done: true, doneAt: now() })),
              })),
              points: [
                ...d.points,
                pointsEvent('step', pts, `Задача: ${task.title}`, { taskId }),
                pointsEvent('task', TASK_BONUS, `Задача завершена: ${task.title}`, { taskId }),
              ],
            }),
            [{ type: 'task', title: task.title, points: pts + TASK_BONUS, taskId }],
          );
        },

        // Вернуть завершённую задачу в работу: откатываются шаги, закрытые в момент завершения,
        // и снимаются очки за них и за саму задачу
        reopenTask: (taskId) => {
          const task = get().data.tasks.find((t) => t.id === taskId);
          if (!task?.completedAt) return;
          const plan = planReopen(task, get().data.points);
          const undo = new Set(plan.stepIds);
          const drop = new Set(plan.pointIds);
          set((s) => ({ celebrations: s.celebrations.filter((c) => !(c.type === 'task' && c.taskId === taskId)) }));
          commit((d) => ({
            ...mapTask(d, taskId, (t) => ({
              ...t,
              completedAt: undefined,
              steps: t.steps.map((s) => (undo.has(s.id) ? { ...s, done: false, doneAt: undefined } : s)),
            })),
            points: d.points.map((p) => (drop.has(p.id) ? { ...p, deleted: true, updatedAt: now() } : p)),
          }), [], { revoke: true });
        },

        // Объединить несколько задач в одну большую: маленькие становятся её шагами
        mergeTasks: (ids, mode, keepSubsteps) => {
          const sources = get().data.tasks.filter((t) => ids.includes(t.id) && !t.deleted);
          if (sources.length < 2) return null;
          const merged = buildMerged(sources, mode, keepSubsteps);
          commit((d) => {
            const removed = new Set(sources.filter((t) => t.id !== merged.id).map((t) => t.id));
            const tasks = d.tasks.map((t) => (removed.has(t.id) ? { ...t, deleted: true, updatedAt: now() } : t));
            const exists = tasks.some((t) => t.id === merged.id);
            return { ...d, tasks: exists ? tasks.map((t) => (t.id === merged.id ? merged : t)) : [...tasks, merged] };
          });
          return merged.id;
        },

        scheduleStep: (taskId, stepId, date) =>
          commit((d) => mapTask(d, taskId, (t) => ({ ...t, steps: t.steps.map((s) => (s.id === stepId ? { ...s, date } : s)) }))),

        // Отметить простое дело за сегодня (повторное нажатие снимает отметку и очки)
        // day — отметить за прошедший день (например, за вчера, если забыли); по умолчанию сегодня
        toggleHabit: (habitId, day) => {
          const d0 = get().data;
          const habit = d0.habits.find((x) => x.id === habitId);
          if (!habit) return;
          const today = day ?? dayKey();
          const isPast = today !== dayKey();
          const bonusId = `all-${today}`; // stepId бонуса «все закреплённые привычки за день»
          const existing = d0.habitLogs.find((l) => !l.deleted && l.habitId === habitId && l.day === today);
          if (existing) {
            // отмена: снимаем очки за это дело и, если был, бонус за весь день
            commit(
              (d) => ({
                ...d,
                habitLogs: d.habitLogs.map((l) => (l.id === existing.id ? { ...l, deleted: true, updatedAt: now() } : l)),
                points: d.points.map((p) =>
                  !p.deleted && p.kind === 'habit' && (p.stepId === existing.id || (habit.mine && p.stepId === bonusId))
                    ? { ...p, deleted: true, updatedAt: now() }
                    : p,
                ),
              }),
              [],
              { revoke: true },
            );
            return;
          }
          // отметка за прошедший день ставится на его вечер — так она попадает в статистику того дня
          const at = isPast ? dayStartTs(parseDay(today)) + 16 * 3600000 : now();
          const log = { id: uid(), updatedAt: now(), habitId, day: today, at };
          const pts = habitPoints(habit);
          const label = (habit.tier ?? 'easy') === 'hard' ? 'Дело' : 'Простое дело';
          // все ли закреплённые на сегодня привычки будут сделаны после этой отметки
          const pinned = pinnedFor(d0.habits, d0.habitLogs, parseDay(today));
          const allDone =
            pinned.length > 1 && pinned.some((x) => x.id === habitId) &&
            pinned.every((x) => x.id === habitId || d0.habitLogs.some((l) => !l.deleted && l.habitId === x.id && l.day === today)) &&
            !d0.points.some((p) => !p.deleted && p.stepId === bonusId);
          const events = [pointsEvent('habit', pts, `${label}: ${habit.title}`, { stepId: log.id })];
          if (allDone) events.push(pointsEvent('habit', ALL_HABITS_BONUS, 'Все закреплённые привычки за день', { stepId: bonusId }));
          commit(
            // stepId хранит id отметки — чтобы при отмене снять именно эти очки
            (d) => ({ ...d, habitLogs: [...d.habitLogs, log], points: [...d.points, ...events] }),
            allDone
              ? [{ type: 'allHabits', points: pts + ALL_HABITS_BONUS, count: pinned.length }]
              : [{ type: 'habit', points: pts, title: habit.title }],
          );
        },

        saveHabit: (hb) =>
          commit((d) => {
            const hh = touch(hb);
            const exists = d.habits.some((x) => x.id === hb.id);
            return { ...d, habits: exists ? d.habits.map((x) => (x.id === hb.id ? hh : x)) : [...d.habits, hh] };
          }),

        deleteHabit: (id) =>
          commit((d) => ({ ...d, habits: d.habits.map((x) => (x.id === id ? { ...x, deleted: true, updatedAt: now() } : x)) })),

        setMood: (id) => set({ currentMood: id }),

        saveMood: (m) =>
          commit((d) => {
            const mm = touch(m);
            const exists = d.moods.some((x) => x.id === m.id);
            return { ...d, moods: exists ? d.moods.map((x) => (x.id === m.id ? mm : x)) : [...d.moods, mm] };
          }),

        deleteMood: (id) =>
          commit((d) => ({ ...d, moods: d.moods.map((m) => (m.id === id ? { ...m, deleted: true, updatedAt: now() } : m)) })),

        saveReward: (r) =>
          commit((d) => {
            const rr = touch(r);
            const exists = d.rewards.some((x) => x.id === r.id);
            return { ...d, rewards: exists ? d.rewards.map((x) => (x.id === r.id ? rr : x)) : [...d.rewards, rr] };
          }),

        deleteReward: (id) =>
          commit((d) => ({ ...d, rewards: d.rewards.map((r) => (r.id === id ? { ...r, deleted: true, updatedAt: now() } : r)) })),

        buyReward: (id) => {
          const d = get().data;
          const r = d.rewards.find((x) => x.id === id);
          const bal = d.points.filter((p) => !p.deleted).reduce((a, p) => a + p.amount, 0);
          if (!r || bal < r.cost) return false;
          commit((dd) => ({ ...dd, points: [...dd.points, pointsEvent('purchase', -r.cost, `Награда: ${r.title}`)] }));
          return true;
        },

        updateSettings: (patch) => commit((d) => ({ ...d, settings: { ...d.settings, ...patch, updatedAt: now() } })),

        startTimer: (t) => set({ timer: { ...t, start: now(), pausedTotalMs: 0 } }),

        pauseTimer: () => {
          const t = get().timer;
          if (t && !t.pausedAt) set({ timer: { ...t, pausedAt: now() } });
        },

        resumeTimer: () => {
          const t = get().timer;
          if (t?.pausedAt) set({ timer: { ...t, pausedAt: undefined, pausedTotalMs: t.pausedTotalMs + (now() - t.pausedAt) } });
        },

        markMidNotified: () => {
          const t = get().timer;
          if (t) set({ timer: { ...t, midNotified: true } });
        },

        finishTimer: (completed, reason) => {
          const t = get().timer;
          if (!t) return null;
          const end = t.pausedAt ?? now();
          const elapsedMin = Math.max(0, (end - t.start - t.pausedTotalMs) / 60000);
          const actualMin = Math.round(Math.min(elapsedMin, completed ? t.plannedMin : elapsedMin) * 10) / 10;
          const session: Session = {
            id: uid(), updatedAt: now(), kind: t.kind, taskId: t.taskId, stepId: t.stepId, moodId: t.moodId,
            start: t.start, plannedMin: t.plannedMin, actualMin, completed, interruptReason: reason,
          };
          const pts = t.kind === 'focus' ? focusPoints(actualMin, completed) : 0;
          const cel: CelebrationInput[] = t.kind === 'focus' && completed ? [{ type: 'focus', points: pts, minutes: Math.round(actualMin) }] : [];
          set({ timer: null });
          if (actualMin < 0.5) return session; // случайный старт — не засоряем статистику
          commit(
            (d) => ({
              ...d,
              sessions: [...d.sessions, session],
              points: pts > 0 ? [...d.points, pointsEvent('focus', pts, `Фокус ${Math.round(actualMin)} мин`, { taskId: t.taskId })] : d.points,
            }),
            cel,
          );
          return session;
        },

        cancelTimer: () => set({ timer: null }),

        setSyncConfig: (c) => set((s) => ({ sync: { ...s.sync, ...c } })),
        setSyncStatus: (syncStatus) => set({ syncStatus }),
        setAi: (c) => set((s) => ({ ai: { ...s.ai, ...c } })),
        setLastReview: (review) => set({ lastReview: { at: now(), review } }),
        replaceData: (data) => set({ data }),
        importData: (data) => set({ data: upgradeBuiltinHabits({ ...emptyData(), ...data }) }),
        resetAll: () => set({ data: emptyData(), timer: null, celebrations: [] }),

        dismissCelebration: (id) => set((s) => ({ celebrations: s.celebrations.filter((c) => c.id !== id) })),
      };
    },
    {
      name: 'focus-quest',
      version: 5,
      // v2: пул простых дел и привычек; v3: дела посерьёзнее, расписание, обновлённый встроенный пул;
      // v4: «срочно» заменено сроками — старые срочные задачи получают срок «2–3 дня»;
      // существующий пользователь уже знаком с приложением — приветствие ему не показываем
      migrate: (persisted, version) => {
        const s = persisted as { data?: AppData };
        // v5: универсальный пул (новые категории, личные дела вместо узких встроенных)
        if (version < 5 && s.data) s.data = upgradeBuiltinHabits(s.data);
        if (version < 5 && s.data) s.data = { ...s.data, settings: { ...s.data.settings, onboarded: true } };
        if (version < 4 && s.data) {
          s.data = {
            ...s.data,
            tasks: s.data.tasks.map((t) =>
              t.urgent && !t.due ? { ...t, urgent: undefined, due: dueFromKind('days3'), dueKind: 'days3' as const, updatedAt: Date.now() } : t,
            ),
          };
        }
        return s as State;
      },
      // ключ Claude и токен GitHub остаются только в этом браузере: в файл синхронизации они не попадают
      partialize: (s) => ({ data: s.data, timer: s.timer, sync: s.sync, ai: s.ai, lastReview: s.lastReview, currentMood: s.currentMood }),
    },
  ),
);

// Начало дня из настроек: применяем сразу после загрузки сохранённых данных и при каждом изменении.
// По умолчанию день начинается в 04:00 — сделанное после полуночи засчитывается за вчера.
const applyDayStart = (s: State) => setDayStartHour(s.data.settings.dayStartHour ?? 4);
applyDayStart(useStore.getState());
useStore.subscribe(applyDayStart);

// Удобные выборки
export const useData = () => useStore((s) => s.data);
export const liveTasks = (d: AppData) => d.tasks.filter((t) => !t.deleted);
export const liveMoods = (d: AppData) => d.moods.filter((m) => !m.deleted).sort((a, b) => a.order - b.order);
export const liveRewards = (d: AppData) => d.rewards.filter((r) => !r.deleted);
export const liveHabits = (d: AppData) => d.habits.filter((h) => !h.deleted);
