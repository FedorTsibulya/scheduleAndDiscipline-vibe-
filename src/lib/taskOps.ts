import type { Level3, PointsEvent, Step, Task } from '../types';
import { uid } from './util';

// ---------- возврат завершённой задачи в работу ----------

// Что откатить при возврате задачи: шаги, отмеченные в момент завершения, и очки за них и за саму задачу.
// Если задача закрылась обычной отметкой последнего шага — откатываем этот последний шаг.
export function planReopen(task: Task, points: PointsEvent[]) {
  const at = task.completedAt ?? 0;
  const near = (t?: number) => !!t && t >= at - 2000;
  let stepIds = task.steps.filter((s) => s.done && near(s.doneAt)).map((s) => s.id);
  if (!stepIds.length && task.steps.some((s) => s.done)) {
    const last = [...task.steps].filter((s) => s.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))[0];
    stepIds = [last.id];
  }
  const ids = new Set(stepIds);
  const pointIds = points
    .filter((p) => !p.deleted && p.taskId === task.id && (
      p.kind === 'task' ||
      (p.kind === 'step' && (p.stepId ? ids.has(p.stepId) : near(p.at)))
    ))
    .map((p) => p.id);
  const total = points.filter((p) => pointIds.includes(p.id)).reduce((a, p) => a + p.amount, 0);
  return { stepIds, pointIds, total };
}

// ---------- объединение задач ----------

export type MergeMode = { kind: 'new'; title: string } | { kind: 'into'; targetId: string };

// Каждая маленькая задача становится шагом большой (или её шаги переносятся в большую целиком)
export function tasksToSteps(tasks: Task[], keepSubsteps: boolean): Step[] {
  const steps: Step[] = [];
  for (const t of tasks) {
    if (keepSubsteps && t.steps.length) {
      for (const s of t.steps) steps.push({ ...s, id: uid(), title: `${t.title}: ${s.title}` });
      continue;
    }
    const minutes = t.steps.filter((s) => !s.done).reduce((a, s) => a + (s.minutes || 0), 0) || t.steps.reduce((a, s) => a + (s.minutes || 0), 0) || 25;
    const done = !!t.completedAt;
    const nextDate = t.steps.find((s) => !s.done && s.date)?.date;
    steps.push({ id: uid(), title: t.title, minutes, done, doneAt: done ? t.completedAt : undefined, date: nextDate });
  }
  return steps;
}

const maxLevel = (xs: Level3[]) => Math.max(...xs) as Level3;
const earliest = (xs: (string | undefined)[]) => xs.filter(Boolean).sort()[0];

// Собрать большую задачу: настроения объединяются, сложность и креативность — максимальные,
// срок — самый ранний, дата создания — самая ранняя (чтобы не потерять бонус за давно отложенное)
export function buildMerged(sources: Task[], mode: MergeMode, keepSubsteps: boolean, now = Date.now()): Task {
  const target = mode.kind === 'into' ? sources.find((t) => t.id === mode.targetId) : undefined;
  const parts = sources.filter((t) => t.id !== target?.id);
  const all = target ? [target, ...parts] : parts;
  const due = earliest(all.map((t) => t.due));
  const base: Task = target ?? {
    id: uid(), updatedAt: now, createdAt: now, title: '', notes: '', inbox: false, moods: [], difficulty: 2, creativity: 2,
    important: false, color: parts[0]?.color ?? 'purple', steps: [],
  };
  return {
    ...base,
    title: mode.kind === 'new' ? mode.title.trim() : base.title,
    createdAt: Math.min(...all.map((t) => t.createdAt)),
    notes: all.map((t) => t.notes.trim()).filter(Boolean).join('\n\n'),
    moods: [...new Set(all.flatMap((t) => t.moods))],
    difficulty: maxLevel(all.map((t) => t.difficulty)),
    creativity: maxLevel(all.map((t) => t.creativity)),
    important: all.some((t) => t.important),
    due,
    dueKind: due ? all.find((t) => t.due === due)?.dueKind : undefined,
    steps: [...(target?.steps ?? []), ...tasksToSteps(parts, keepSubsteps)],
    completedAt: undefined,
    targetCount: target?.targetCount,
    updatedAt: now,
  };
}
