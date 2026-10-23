import { useState } from 'react';
import { IconPlus, IconTrash, IconBulb, IconArrowUp, IconArrowDown, IconSparkles, IconLoader2, IconAlertTriangle, IconRotate } from '@tabler/icons-react';
import { AiError, aiConfigured, assessTask, breakdownTask } from '../lib/ai';
import { DEADLINE_OPTIONS, DUE_COLORS, dueFromKind, dueStatus } from '../lib/deadline';
import { ReopenDialog } from './TaskDialogs';
import type { Level3, Step, Task } from '../types';
import { liveMoods, useStore } from '../store';
import { Modal } from './Modal';
import { Check, CREATIVITY, DIFFICULTY, Seg, Switch, colorVars } from './ui';
import { COLOR_KEYS, PALETTE } from '../lib/colors';
import { DynIcon } from '../lib/icons';
import { uid } from '../lib/util';

export const newTask = (): Task => ({
  id: uid(), updatedAt: Date.now(), createdAt: Date.now(), title: '', notes: '', inbox: false, moods: [],
  difficulty: 2, creativity: 2, important: false, color: 'purple', steps: [],
});

const MINUTES = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120];

export function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const moods = liveMoods(useStore((s) => s.data));
  const saveTask = useStore((s) => s.saveTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const [t, setT] = useState<Task>(() => ({ ...task, steps: task.steps.map((s) => ({ ...s })) }));
  const [stepTitle, setStepTitle] = useState('');
  const [stepMin, setStepMin] = useState(25);
  const [regular, setRegular] = useState(!!task.targetCount);
  const [error, setError] = useState('');
  const isNew = !useStore.getState().data.tasks.some((x) => x.id === task.id);
  const ai = useStore((s) => s.ai);
  const [reopening, setReopening] = useState(false);
  const [aiBusy, setAiBusy] = useState<'steps' | 'assess' | null>(null);
  const [aiMsg, setAiMsg] = useState<{ kind: 'steps' | 'assess'; text: string; error?: boolean } | null>(null);

  const patch = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }));

  // Claude: предложить шаги (добавляются в конец списка — их можно поправить или удалить)
  const aiSteps = async () => {
    if (!t.title.trim()) return setError('Сначала назовите задачу');
    setAiBusy('steps');
    setAiMsg(null);
    try {
      const steps = await breakdownTask(ai, t.title, t.notes, t.steps.map((s) => s.title));
      setT((x) => ({ ...x, steps: [...x.steps, ...steps.map((s) => ({ id: uid(), title: s.title, minutes: s.minutes, done: false }))] }));
      setAiMsg({ kind: 'steps', text: `Claude предложил шагов: ${steps.length}. Поправьте их, если что-то не так.` });
    } catch (e) {
      setAiMsg({ kind: 'steps', text: e instanceof AiError ? e.message : 'Не получилось. Попробуйте ещё раз.', error: true });
    } finally {
      setAiBusy(null);
    }
  };

  // Claude: заполнить настроения, сложность, креативность, важность и срочность
  const aiAssess = async () => {
    if (!t.title.trim()) return setError('Сначала назовите задачу');
    setAiBusy('assess');
    setAiMsg(null);
    try {
      const a = await assessTask(ai, t.title, t.notes, t.steps.map((s) => s.title), moods);
      patch({
        moods: a.moodIds, difficulty: a.difficulty, creativity: a.creativity, important: a.important,
        // срок от Claude ставим, только если пользователь его ещё не задал
        ...(!t.due && a.deadline !== 'none' ? { due: dueFromKind(a.deadline), dueKind: a.deadline } : {}),
      });
      setAiMsg({ kind: 'assess', text: a.reason });
    } catch (e) {
      setAiMsg({ kind: 'assess', text: e instanceof AiError ? e.message : 'Не получилось. Попробуйте ещё раз.', error: true });
    } finally {
      setAiBusy(null);
    }
  };

  const aiNote = (kind: 'steps' | 'assess') =>
    aiMsg?.kind === kind && (
      <p className="small row" style={{ alignItems: 'flex-start', color: aiMsg.error ? 'var(--danger)' : 'var(--primary)' }}>
        {aiMsg.error ? <IconAlertTriangle size={16} style={{ flexShrink: 0 }} /> : <IconSparkles size={16} style={{ flexShrink: 0 }} />} {aiMsg.text}
      </p>
    );

  const aiButton = (kind: 'steps' | 'assess', label: string, onClick: () => void) =>
    aiConfigured(ai) && (
      <button type="button" className="btn sm" onClick={onClick} disabled={aiBusy !== null}>
        {aiBusy === kind ? <IconLoader2 size={15} className="spin" /> : <IconSparkles size={15} color="var(--primary)" />}
        {aiBusy === kind ? 'Claude думает…' : label}
      </button>
    );
  const patchStep = (id: string, p: Partial<Step>) => patch({ steps: t.steps.map((s) => (s.id === id ? { ...s, ...p } : s)) });

  const addStep = () => {
    const title = stepTitle.trim();
    if (!title) return;
    patch({ steps: [...t.steps, { id: uid(), title, minutes: stepMin, done: false }] });
    setStepTitle('');
  };

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= t.steps.length) return;
    const steps = [...t.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    patch({ steps });
  };

  const save = () => {
    if (!t.title.trim()) {
      setError('Назовите задачу');
      return;
    }
    // недописанный шаг в поле ввода тоже сохраняем
    const pending = stepTitle.trim() ? [{ id: uid(), title: stepTitle.trim(), minutes: stepMin, done: false }] : [];
    saveTask({
      ...t,
      title: t.title.trim(),
      inbox: false,
      steps: t.repeat ? t.steps : [...t.steps, ...pending],
      targetCount: regular && !t.repeat ? Math.max(1, t.targetCount || 1) : undefined,
    });
    onClose();
  };

  return (
    <Modal
      title={isNew ? 'Новая задача' : task.inbox ? 'Разобрать запись' : 'Задача'}
      onClose={onClose}
      footer={
        <>
          {!isNew ? (
            <div className="row wrap">
              <button className="btn danger" onClick={() => { deleteTask(t.id); onClose(); }}>
                <IconTrash size={16} /> Удалить
              </button>
              {task.completedAt && (
                <button className="btn" onClick={() => setReopening(true)}><IconRotate size={16} /> Вернуть в работу</button>
              )}
            </div>
          ) : <span />}
          <div className="row">
            <button className="btn ghost" onClick={onClose}>Отмена</button>
            <button className="btn primary" onClick={save}>Сохранить</button>
          </div>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <div className="field">
          <label htmlFor="t-title">Название</label>
          <input
            id="t-title" className="input" autoFocus value={t.title} placeholder="Разобрать налоговые документы"
            onChange={(e) => { patch({ title: e.target.value }); setError(''); }}
          />
          {error && <span className="small" style={{ color: 'var(--danger)' }}>{error}</span>}
        </div>

        <div className="field">
          <Switch checked={!!t.repeat} onChange={(v) => patch({ repeat: v, completedAt: v ? undefined : t.completedAt })}
            label={<span><b>Постоянная задача</b> <span className="small muted">— выполняется сколько угодно раз и никогда не закрывается</span></span>} />
          {t.repeat && (
            <p className="small faint" style={{ marginTop: 4 }}>
              Например, «Написать 1 страницу диплома». Каждое выполнение приносит очки и считается в серию, а у задачи видно, сколько раз она сделана сегодня и сколько дней подряд.
              {(t.doneLog?.length ?? 0) > 0 && ` Всего выполнений: ${t.doneLog!.length}.`}
            </p>
          )}
        </div>

        {!t.repeat && <div className="field">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label-text">Шаги</span>
            {aiButton('steps', t.steps.length ? 'Предложить ещё шаги' : 'Разбить на шаги', () => void aiSteps())}
          </div>
          {aiNote('steps')}
          <p className="small faint row" style={{ alignItems: 'flex-start' }}>
            <IconBulb size={16} style={{ flexShrink: 0 }} /> Хороший шаг занимает 15–45 минут, и по нему сразу понятно первое действие. «Открыть файл и выписать список» лучше, чем «сделать отчёт».
          </p>
          <div>
            {t.steps.map((s, i) => (
              <div key={s.id} className={`step-row edit ${s.done ? 'done' : ''}`}>
                <Check on={s.done} label="Шаг выполнен" onClick={() => patchStep(s.id, { done: !s.done, doneAt: s.done ? undefined : Date.now() })} />
                <input className="input step-title" style={{ padding: '6px 10px' }} value={s.title} onChange={(e) => patchStep(s.id, { title: e.target.value })} />
                <select className="select" style={{ width: 92, padding: '6px 8px' }} value={s.minutes} onChange={(e) => patchStep(s.id, { minutes: +e.target.value })} aria-label="Минут на шаг">
                  {[...new Set([...MINUTES, s.minutes])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m} мин</option>)}
                </select>
                <input type="date" className="input" style={{ width: 140, padding: '6px 8px' }} value={s.date ?? ''} onChange={(e) => patchStep(s.id, { date: e.target.value || undefined })} aria-label="День" />
                <button className="btn icon ghost" onClick={() => move(i, -1)} aria-label="Выше"><IconArrowUp size={16} /></button>
                <button className="btn icon ghost" onClick={() => move(i, 1)} aria-label="Ниже"><IconArrowDown size={16} /></button>
                <button className="btn icon ghost" onClick={() => patch({ steps: t.steps.filter((x) => x.id !== s.id) })} aria-label="Удалить шаг"><IconTrash size={16} /></button>
              </div>
            ))}
          </div>
          <div className="row">
            <input
              className="input grow" value={stepTitle} placeholder="Новый шаг и Enter"
              onChange={(e) => setStepTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addStep()}
            />
            <select className="select" style={{ width: 96 }} value={stepMin} onChange={(e) => setStepMin(+e.target.value)} aria-label="Минут на новый шаг">
              {MINUTES.map((m) => <option key={m} value={m}>{m} мин</option>)}
            </select>
            <button className="btn violet icon" onClick={addStep} aria-label="Добавить шаг"><IconPlus size={18} /></button>
          </div>
          <div className="row wrap" style={{ marginTop: 4 }}>
            <Switch checked={regular} onChange={setRegular} label={<span className="small">Регулярная цель</span>} />
            {regular && (
              <span className="row small muted">
                выполнить
                <input type="number" min={1} className="input" style={{ width: 70, padding: '4px 8px' }} value={t.targetCount ?? 1} onChange={(e) => patch({ targetCount: Math.max(1, +e.target.value || 1) })} />
                раз (например, 12 тренировок за месяц)
              </span>
            )}
          </div>
          {t.steps.length > 0 && !regular && (
            <p className="small faint">Задача не закрывается сама, когда все шаги отмечены: шаги можно добавлять по ходу работы. Когда всё готово — нажмите «Завершить задачу» на карточке.</p>
          )}
        </div>}

        {aiConfigured(ai) && (
          <div className="stack" style={{ gap: 6 }}>
            <div>{aiButton('assess', 'Заполнить оценки с Claude', () => void aiAssess())}</div>
            {aiNote('assess')}
          </div>
        )}

        <div className="field">
          <span className="label-text">Под какое настроение подходит</span>
          <div className="row wrap">
            {moods.map((m) => {
              const on = t.moods.includes(m.id);
              return (
                <button key={m.id} type="button" className={`chip ${on ? 'on' : ''}`} style={colorVars(m.color)}
                  onClick={() => patch({ moods: on ? t.moods.filter((x) => x !== m.id) : [...t.moods, m.id] })}>
                  <DynIcon name={m.icon} size={16} /> {m.name}
                </button>
              );
            })}
          </div>
          <span className="small faint">Если ничего не выбрано, задача подходит под любое настроение.</span>
        </div>

        <div className="row wrap" style={{ gap: 18 }}>
          <div className="field">
            <span className="label-text">Сложность</span>
            <Seg<Level3> value={t.difficulty} onChange={(v) => patch({ difficulty: v })} options={[1, 2, 3].map((v) => ({ v: v as Level3, label: DIFFICULTY[v] }))} />
          </div>
          <div className="field">
            <span className="label-text">Креативность</span>
            <Seg<Level3> value={t.creativity} onChange={(v) => patch({ creativity: v })} options={[1, 2, 3].map((v) => ({ v: v as Level3, label: CREATIVITY[v] }))} />
          </div>
        </div>

        <Switch checked={t.important} onChange={(v) => patch({ important: v })} label="Важная" />

        <div className="field">
          <span className="label-text">Срок</span>
          <div className="row wrap" style={{ gap: 6 }}>
            <button type="button" className={`chip ${!t.due ? 'on' : ''}`} style={colorVars('gray')} onClick={() => patch({ due: undefined, dueKind: undefined })}>Без срока</button>
            {DEADLINE_OPTIONS.map((o) => (
              <button key={o.kind} type="button" className={`chip ${t.dueKind === o.kind && t.due ? 'on' : ''}`} style={colorVars('coral')}
                onClick={() => patch({ dueKind: o.kind, due: o.kind === 'date' ? t.due ?? dueFromKind('week') : dueFromKind(o.kind) })}>
                {o.label}
              </button>
            ))}
          </div>
          {t.due && (
            <div className="row wrap" style={{ gap: 10, marginTop: 4 }}>
              <input type="date" className="input" style={{ width: 170 }} value={t.due} aria-label="Дата срока"
                onChange={(e) => e.target.value && patch({ due: e.target.value, dueKind: 'date' })} />
              <span className="tag" style={{ background: DUE_COLORS[dueStatus(t.due).level].bg, color: DUE_COLORS[dueStatus(t.due).level].fg }}>
                {dueStatus(t.due).label}
              </span>
            </div>
          )}
          <span className="small faint">Срок отсчитывается от сегодняшнего дня. Чем ближе он, тем выше задача в подборке; за 3 дня до срока она считается срочной.</span>
        </div>

        <div className="field">
          <span className="label-text">Цвет</span>
          <div className="row wrap">
            {COLOR_KEYS.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => patch({ color: c })}
                style={{ width: 30, height: 30, borderRadius: 10, cursor: 'pointer', background: PALETTE[c][400], border: t.color === c ? '3px solid var(--text)' : '3px solid transparent' }} />
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="t-notes">Заметки</label>
          <textarea id="t-notes" className="textarea" value={t.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Ссылки, детали, с чего начать" />
        </div>
      </div>
      {reopening && <ReopenDialog task={task} onClose={() => { setReopening(false); onClose(); }} />}
    </Modal>
  );
}
