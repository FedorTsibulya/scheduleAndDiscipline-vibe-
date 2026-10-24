import { useState } from 'react';
import { IconPlus, IconListCheck, IconSearch, IconRotate, IconArrowMerge, IconX, IconRepeat } from '@tabler/icons-react';
import type { Task } from '../types';
import { liveMoods, liveTasks, useStore } from '../store';
import { goTo, useUI } from '../uiStore';
import { newTask } from '../components/TaskEditor';
import { HabitsFold } from '../components/Habits';
import { MergeDialog, ReopenDialog } from '../components/TaskDialogs';
import { Bar, Check, Dots, DueTag, Empty, Seg, Switch, TaskIcon } from '../components/ui';
import { allStepsDone, taskProgress, nextStep, remainingMinutes, repeatCountOn, repeatStreak } from '../lib/progress';
import { isUrgent } from '../lib/deadline';
import { PALETTE } from '../lib/colors';
import { DynIcon } from '../lib/icons';
import { dayLabel, formatMin } from '../lib/util';

// Срочность берётся из срока: до него 2 дня или меньше
const QUADRANTS: { key: string; title: string; hint: string; test: (t: Task) => boolean; color: string }[] = [
  { key: 'iu', title: 'Важно и срочно', hint: 'Сделать первым', test: (t) => t.important && isUrgent(t), color: 'var(--danger)' },
  { key: 'in', title: 'Важно, не срочно', hint: 'Запланировать — здесь главный рост', test: (t) => t.important && !isUrgent(t), color: 'var(--primary)' },
  { key: 'nu', title: 'Срочно, не важно', hint: 'Сделать быстро или упростить', test: (t) => !t.important && isUrgent(t), color: 'var(--warning)' },
  { key: 'nn', title: 'Не важно и не срочно', hint: 'Когда есть настроение', test: (t) => !t.important && !isUrgent(t), color: 'var(--text-3)' },
];

function TaskRow({ t, selecting, selected, onSelect }: { t: Task; selecting: boolean; selected: boolean; onSelect: () => void }) {
  const moods = liveMoods(useStore((s) => s.data));
  const edit = useUI((s) => s.edit);
  const [reopening, setReopening] = useState(false);
  const pct = taskProgress(t);
  const step = nextStep(t);
  const left = remainingMinutes(t);
  return (
    <div className={`card clickable ${selected ? 'picked' : ''}`} style={{ padding: '10px 14px' }} onClick={() => (selecting ? onSelect() : edit(t))}>
      <div className="row" style={{ gap: 12 }}>
        {/* выбор делает клик по всей карточке — у галочки свой обработчик не нужен, иначе сработает дважды */}
        {selecting && <Check on={selected} label="Выбрать задачу" onClick={() => {}} />}
        <TaskIcon color={t.color}>{t.repeat ? <IconRepeat size={20} /> : Math.round(pct * 100)}</TaskIcon>
        <div className="grow">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p className="task-title" style={{ textDecoration: t.completedAt ? 'line-through' : undefined }}>{t.title}</p>
            <div className="row" style={{ gap: 4, color: 'var(--text-3)', flexShrink: 0 }}>
              {moods.filter((m) => t.moods.includes(m.id)).map((m) => <span key={m.id} title={m.name} style={{ color: PALETTE[m.color][400] }}><DynIcon name={m.icon} size={16} /></span>)}
              <Dots n={t.difficulty} title={`Сложность ${t.difficulty} из 3`} />
            </div>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            <p className="small faint">
              {t.repeat
                ? `Постоянная · сегодня ${repeatCountOn(t)} · всего ${t.doneLog?.length ?? 0}${repeatStreak(t) > 1 ? ` · ${repeatStreak(t)} дн. подряд` : ''}`
                : t.completedAt
                ? `Завершена ${dayLabel(new Date(t.completedAt))}`
                : allStepsDone(t)
                ? 'Все шаги сделаны — можно завершить'
                : step
                  ? `Дальше: ${step.title}${left ? ` · осталось ${formatMin(left)}` : ''}`
                  : t.steps.length ? 'Все шаги сделаны' : 'Нет шагов'}
            </p>
            {!t.completedAt && <DueTag due={t.due} />}
          </div>
          <div style={{ marginTop: 6 }}><Bar value={pct} color={PALETTE[t.color][400]} thin /></div>
        </div>
        {t.completedAt && !selecting && (
          <button className="btn sm" onClick={(e) => { e.stopPropagation(); setReopening(true); }} title="Вернуть в работу">
            <IconRotate size={15} /> Вернуть
          </button>
        )}
      </div>
      {reopening && <div onClick={(e) => e.stopPropagation()}><ReopenDialog task={t} onClose={() => setReopening(false)} /></div>}
    </div>
  );
}

// Сортировка: незавершённые выше; среди них — по сроку (ближайший первым), потом по свежести
const byDue = (a: Task, b: Task) =>
  Number(!!a.completedAt) - Number(!!b.completedAt) ||
  (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
  b.updatedAt - a.updatedAt;

export function TasksPage() {
  const data = useStore((s) => s.data);
  const edit = useUI((s) => s.edit);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'matrix' | 'list'>('matrix');
  const [showDone, setShowDone] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const all = liveTasks(data).filter((t) => !t.inbox);
  const filtered = all.filter((t) => (showDone || !t.completedAt) && t.title.toLowerCase().includes(q.trim().toLowerCase()));
  const sorted = [...filtered].sort(byDue);

  const toggleSel = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const stopSelecting = () => { setSelecting(false); setSelected([]); };
  const row = (t: Task) => <TaskRow key={t.id} t={t} selecting={selecting} selected={selected.includes(t.id)} onSelect={() => toggleSel(t.id)} />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Задачи</h1>
          <p className="sub">{all.filter((t) => !t.completedAt).length} в работе · {all.filter((t) => t.completedAt).length} завершено</p>
        </div>
        <div className="row wrap">
          {all.length > 1 && (
            selecting
              ? <button className="btn" onClick={stopSelecting}><IconX size={18} /> Отмена</button>
              : <button className="btn" onClick={() => setSelecting(true)}><IconArrowMerge size={18} /> Объединить</button>
          )}
          <button className="btn primary" onClick={() => edit(newTask())}><IconPlus size={18} /> Новая задача</button>
        </div>
      </div>

      {selecting && (
        <div className="card soft row wrap" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
          <span className="small" style={{ fontWeight: 700 }}>
            Отметьте 2 или больше задач — они станут шагами одной большой. Выбрано: {selected.length}
          </span>
          <button className="btn primary sm" disabled={selected.length < 2} onClick={() => setMerging(true)}><IconArrowMerge size={15} /> Объединить выбранные</button>
        </div>
      )}

      <HabitsFold onOpenAll={() => goTo('habits')} />

      <div className="row wrap" style={{ marginBottom: 16, gap: 12 }}>
        <div className="row grow" style={{ minWidth: 200, position: 'relative' }}>
          <IconSearch size={18} style={{ position: 'absolute', left: 14, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 40, borderRadius: 999 }} placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Seg value={view} onChange={setView} options={[{ v: 'matrix', label: 'Матрица' }, { v: 'list', label: 'Список' }]} />
        <Switch checked={showDone} onChange={setShowDone} label={<span className="small">Завершённые</span>} />
      </div>

      {!all.length ? (
        <Empty icon={<IconListCheck size={32} />} title="Задач пока нет" text="Создайте задачу или разберите записи во «Входящих»." action={<button className="btn primary" onClick={() => edit(newTask())}>Создать задачу</button>} />
      ) : view === 'list' ? (
        <div className="stack" style={{ gap: 8 }}>{sorted.map(row)}</div>
      ) : (
        <div className="stack" style={{ gap: 22 }}>
          {QUADRANTS.map((qd) => {
            const items = sorted.filter(qd.test);
            if (!items.length) return null;
            return (
              <div key={qd.key}>
                <div className="row wrap" style={{ marginBottom: 8, alignItems: 'baseline' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: qd.color, display: 'inline-block' }} />
                  <h2>{qd.title}</h2>
                  <span className="small faint">{qd.hint}</span>
                </div>
                <div className="stack" style={{ gap: 8 }}>{items.map(row)}</div>
              </div>
            );
          })}
        </div>
      )}

      {merging && (
        <MergeDialog tasks={all.filter((t) => selected.includes(t.id))} onClose={() => setMerging(false)} onDone={stopSelecting} />
      )}
    </div>
  );
}
