import { create } from 'zustand';
import type { ActiveTimer, Session, Task } from './types';

export type Page = 'now' | 'inbox' | 'tasks' | 'week' | 'habits' | 'stats' | 'rewards' | 'settings';

interface UI {
  focusOpen: boolean;
  after: Session | null; // экран «фокус/отдых окончен»
  editing: Task | null;
  startFor: { taskId?: string; stepId?: string } | null; // диалог запуска фокуса
  setFocusOpen: (v: boolean) => void;
  setAfter: (s: Session | null) => void;
  edit: (t: Task | null) => void;
  askStart: (v: { taskId?: string; stepId?: string } | null) => void;
}

export const useUI = create<UI>()((set) => ({
  focusOpen: false,
  after: null,
  editing: null,
  startFor: null,
  setFocusOpen: (focusOpen) => set({ focusOpen }),
  setAfter: (after) => set({ after }),
  edit: (editing) => set({ editing }),
  askStart: (startFor) => set({ startFor }),
}));

export const goTo = (p: Page) => {
  location.hash = p;
  window.scrollTo({ top: 0 });
};

export const elapsedMs =(t: ActiveTimer, now = Date.now()) => Math.max(0, (t.pausedAt ?? now) - t.start - t.pausedTotalMs);
