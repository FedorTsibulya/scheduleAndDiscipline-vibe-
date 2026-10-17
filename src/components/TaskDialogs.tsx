import { useState } from 'react';
import { IconRotate, IconArrowMerge } from '@tabler/icons-react';
import type { Task } from '../types';
import { useStore } from '../store';
import { planReopen, type MergeMode } from '../lib/taskOps';
import { plural } from '../lib/util';
import { Modal } from './Modal';
import { Switch } from './ui';

// Подтверждение «вернуть задачу в работу» с суммой очков, которые будут сняты
export function ReopenDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const points = useStore((s) => s.data.points);
  const reopen = useStore((s) => s.reopenTask);
  const plan = planReopen(task, points);
  const steps = task.steps.filter((s) => plan.stepIds.includes(s.id));
  return (
    <Modal
      title="Вернуть задачу в работу?"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={() => { reopen(task.id); onClose(); }}><IconRotate size={16} /> Вернуть в работу</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 10 }}>
        <p style={{ fontWeight: 800 }}>{task.title}</p>
        {steps.length > 0 && (
          <p className="small muted">
            Снова станут невыполненными: {steps.map((s) => `«${s.title}»`).join(', ')}.
          </p>
        )}
        <p className="small">
          {plan.total > 0
            ? <>Будет снято <b>{plan.total} {plural(plan.total, 'очко', 'очка', 'очков')}</b>, начисленных за завершение. Когда закончите задачу снова, они вернутся.</>
            : 'Очки за эту задачу не начислялись.'}
        </p>
        <p className="small faint">Если завершение задачи открыло достижение, которое без неё больше не выполняется, оно тоже снимется вместе с его +25.</p>
      </div>
    </Modal>
  );
}

// Объединение нескольких задач в одну большую
export function MergeDialog({ tasks, onClose, onDone }: { tasks: Task[]; onClose: () => void; onDone: () => void }) {
  const merge = useStore((s) => s.mergeTasks);
  const [kind, setKind] = useState<'new' | 'into'>('new');
  const [title, setTitle] = useState('');
  const [targetId, setTargetId] = useState(tasks[0]?.id ?? '');
  const [keep, setKeep] = useState(false);
  const [err, setErr] = useState('');
  const withSteps = tasks.some((t) => t.steps.length > 0);

  const go = () => {
    if (kind === 'new' && !title.trim()) return setErr('Назовите большую задачу');
    const mode: MergeMode = kind === 'new' ? { kind: 'new', title } : { kind: 'into', targetId };
    if (merge(tasks.map((t) => t.id), mode, keep)) {
      onDone();
      onClose();
    }
  };

  const parts = kind === 'into' ? tasks.filter((t) => t.id !== targetId) : tasks;

  return (
    <Modal
      title="Объединить задачи"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={go}><IconArrowMerge size={16} /> Объединить</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="stack" style={{ gap: 8 }}>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input type="radio" checked={kind === 'new'} onChange={() => setKind('new')} />
            <span style={{ fontWeight: 700 }}>Создать новую большую задачу</span>
          </label>
          {kind === 'new' && (
            <div className="field" style={{ paddingLeft: 26 }}>
              <input className="input" autoFocus value={title} placeholder="Подготовиться к переезду" onChange={(e) => { setTitle(e.target.value); setErr(''); }} />
              {err && <span className="small" style={{ color: 'var(--danger)' }}>{err}</span>}
            </div>
          )}
          <label className="row" style={{ cursor: 'pointer' }}>
            <input type="radio" checked={kind === 'into'} onChange={() => setKind('into')} />
            <span style={{ fontWeight: 700 }}>Добавить в одну из выбранных</span>
          </label>
          {kind === 'into' && (
            <div style={{ paddingLeft: 26 }}>
              <select className="select" value={targetId} onChange={(e) => setTargetId(e.target.value)} aria-label="Большая задача">
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          )}
        </div>

        {withSteps && (
          <Switch checked={keep} onChange={setKeep} label={<span className="small">Перенести их шаги целиком (иначе каждая задача станет одним шагом)</span>} />
        )}

        <div className="card soft" style={{ padding: '10px 14px' }}>
          <p className="small" style={{ fontWeight: 800, marginBottom: 4 }}>Станут шагами:</p>
          <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>
            {parts.flatMap((t) =>
              keep && t.steps.length ? t.steps.map((s) => <li key={s.id}>{t.title}: {s.title}</li>) : [<li key={t.id}>{t.title}</li>],
            )}
          </ul>
        </div>
        <p className="small faint">Настроения объединятся, сложность и креативность возьмутся максимальные, срок — самый ранний. Уже выполненное останется выполненным, начисленные очки сохранятся.</p>
      </div>
    </Modal>
  );
}
