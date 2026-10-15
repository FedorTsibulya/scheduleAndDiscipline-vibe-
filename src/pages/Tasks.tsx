import { useState } from 'react';
import { IconPlus, IconListCheck, IconSearch, IconRotate } from '@tabler/icons-react';
import type { Task } from '../types';
import { liveMoods, liveTasks, useStore } from '../store';
import { useUI } from '../uiStore';
import { newTask } from '../components/TaskEditor';
import { Bar, Dots, Empty, Seg, Switch, TaskIcon } from '../components/ui';
import { taskProgress, nextStep, remainingMinutes } from '../lib/progress';
import { PALETTE } from '../lib/colors';
import { DynIcon } from '../lib/icons';
import { dayLabel, formatMin } from '../lib/util';

const QUADRANTS: { key: string; title: string; hint: string; test: (t: Task) => boolean; color: string }[] = [
  { key: 'iu', title: 'Важно и срочно', hint: 'Сделать первым', test: (t) => t.important && t.urgent, color: 'var(--danger)' },
  { key: 'in', title: 'Важно, не срочно', hint: 'Запланировать — здесь главный рост', test: (t) => t.important && !t.urgent, color: 'var(--primary)' },
  { key: 'nu', title: 'Срочно, не важно', hint: 'Сделать быстро или упростить', test: (t) => !t.important && t.urgent, color: 'var(--warning)' },
  { key: 'nn', title: 'Не важно и не срочно', hint: 'Когда есть настроение', test: (t) => !t.important && !t.urgent, color: 'var(--text-3)' },
];

function TaskRow({ t }: { t: Task }) {
  const moods = liveMoods(useStore((s) => s.data));
  const reopen = useStore((s) => s.reopenTask);
  const edit = useUI((s) => s.edit);
  const pct = taskProgress(t);
  const step = nextStep(t);
  const left = remainingMinutes(t);
  return (
    <div className="card clickable" style={{ padding: '10px 14px' }} onClick={() => edit(t)}>
      <div className="row" style={{ gap: 12 }}>
        <TaskIcon color={t.color}>{Math.round(pct * 100)}</TaskIcon>
        <div className="grow">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <p className="task-title" style={{ textDecoration: t.completedAt ? 'line-through' : undefined }}>{t.title}</p>
            <div className="row" style={{ gap: 4, color: 'var(--text-3)' }}>
              {moods.filter((m) => t.moods.includes(m.id)).map((m) => <span key={m.id} title={m.name} style={{ color: PALETTE[m.color][400] }}><DynIcon name={m.icon} size={16} /></span>)}
              <Dots n={t.difficulty} title={`Сложность ${t.difficulty} из 3`} />
            </div>
          </div>
          <p className="small faint">
            {t.completedAt
              ? `Завершена ${dayLabel(new Date(t.completedAt))}`
              : step
                ? `Дальше: ${step.title}${left ? ` · осталось ${formatMin(left)}` : ''}`
                : t.steps.length ? 'Все шаги сделаны' : 'Нет шагов'}
          </p>
          <div style={{ marginTop: 6 }}><Bar value={pct} color={PALETTE[t.color][400]} thin /></div>
        </div>
        {t.completedAt && (
          <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); reopen(t.id); }} title="Вернуть в работу"><IconRotate size={15} /></button>
        )}
      </div>
    </div>
  );
}

export function TasksPage() {
  const data = useStore((s) => s.data);
  const edit = useUI((s) => s.edit);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'matrix' | 'list'>('matrix');
  const [showDone, setShowDone] = useState(false);
  const all = liveTasks(data).filter((t) => !t.inbox);
  const filtered = all.filter((t) => (showDone || !t.completedAt) && t.title.toLowerCase().includes(q.trim().toLowerCase()));
  const sorted = [...filtered].sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt) || b.updatedAt - a.updatedAt);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Задачи</h1>
          <p className="sub">{all.filter((t) => !t.completedAt).length} в работе · {all.filter((t) => t.completedAt).length} завершено</p>
        </div>
        <button className="btn primary" onClick={() => edit(newTask())}><IconPlus size={18} /> Новая задача</button>
      </div>

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
        <div className="stack" style={{ gap: 8 }}>{sorted.map((t) => <TaskRow key={t.id} t={t} />)}</div>
      ) : (
        <div className="stack" style={{ gap: 22 }}>
          {QUADRANTS.map((qd) => {
            const items = sorted.filter(qd.test);
            if (!items.length) return null;
            return (
              <div key={qd.key}>
                <div className="row" style={{ marginBottom: 8, alignItems: 'baseline' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: qd.color, display: 'inline-block' }} />
                  <h2>{qd.title}</h2>
                  <span className="small faint">{qd.hint}</span>
                </div>
                <div className="stack" style={{ gap: 8 }}>{items.map((t) => <TaskRow key={t.id} t={t} />)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
