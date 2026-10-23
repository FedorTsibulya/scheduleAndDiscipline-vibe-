import { useEffect, useState } from 'react';
import {
  IconPlayerPause, IconPlayerPlay, IconMinimize, IconCheck, IconCoffee, IconFlag, IconTarget, IconArrowBackUp,
} from '@tabler/icons-react';
import { useStore } from '../store';
import { elapsedMs, useUI } from '../uiStore';
import { formatClock, formatMin, plural } from '../lib/util';
import { notify, requestNotifications } from '../lib/notify';
import { playChime, playSoft, unlockAudio } from '../lib/sound';
import { INTERRUPT_REASONS } from '../lib/defaults';
import { nextStep } from '../lib/progress';
import { focusPoints } from '../lib/game';
import { realMood } from '../lib/habits';
import { Modal } from './Modal';

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// Следит за таймером: сигнал на середине, завершение по времени.
// Время считается от момента старта, поэтому таймер переживает перезагрузку страницы.
export function TimerEngine() {
  const timer = useStore((s) => s.timer);
  const settings = useStore((s) => s.data.settings);
  const now = useNow(1000);

  useEffect(() => {
    if (!timer || timer.pausedAt) return;
    const st = useStore.getState();
    const el = elapsedMs(timer, now);
    const planned = timer.plannedMin * 60000;
    if (timer.kind === 'focus' && settings.midReminder && !timer.midNotified && timer.plannedMin >= 10 && el >= planned / 2 && el < planned) {
      st.markMidNotified();
      if (settings.sound) playSoft();
    }
    if (el >= planned) {
      const session = st.finishTimer(true);
      if (settings.sound) playChime();
      if (settings.notifications) {
        if (timer.kind === 'focus') void notify('Фокус окончен!', `Вы держали фокус ${timer.plannedMin} мин. Пора отдохнуть с чистой совестью.`);
        else void notify('Отдых окончен', 'Готовы к следующему заходу?');
      }
      useUI.getState().setAfter(session);
      useUI.getState().setFocusOpen(true);
    }
  }, [now, timer, settings]);

  // заголовок вкладки показывает остаток времени
  useEffect(() => {
    if (!timer) {
      document.title = 'Focus Quest';
      return;
    }
    const left = timer.plannedMin * 60000 - elapsedMs(timer, now);
    document.title = `${formatClock(left)} · ${timer.kind === 'focus' ? 'Фокус' : 'Отдых'}`;
  }, [now, timer]);

  return null;
}

const PRESETS = [
  { min: 5, label: '5 мин', hint: 'просто начать' },
  { min: 15, label: '15 мин', hint: '' },
  { min: 25, label: '25 мин', hint: 'классика' },
  { min: 45, label: '45 мин', hint: '' },
  { min: 60, label: '60 мин', hint: 'глубокая работа' },
];

// Диалог запуска фокуса: сколько минут вы обещаете себе работать
export function StartFocusDialog() {
  const startFor = useUI((s) => s.startFor);
  const askStart = useUI((s) => s.askStart);
  const setFocusOpen = useUI((s) => s.setFocusOpen);
  const data = useStore((s) => s.data);
  const startTimer = useStore((s) => s.startTimer);
  const mood = useStore((s) => s.currentMood);
  const [min, setMin] = useState(data.settings.focusMin);
  const [custom, setCustom] = useState('');
  if (!startFor) return null;

  const task = data.tasks.find((t) => t.id === startFor.taskId);
  const step = task?.steps.find((s) => s.id === startFor.stepId) ?? (task ? nextStep(task) : undefined);
  const value = custom ? Math.max(1, Math.min(240, +custom || 0)) : min;

  const go = () => {
    unlockAudio();
    if (data.settings.notifications) void requestNotifications();
    startTimer({ kind: 'focus', taskId: task?.id, stepId: step?.id, moodId: realMood(mood), plannedMin: value });
    askStart(null);
    setFocusOpen(true);
  };

  return (
    <Modal
      title="Начать фокус"
      onClose={() => askStart(null)}
      footer={
        <>
          <span />
          <button className="btn primary lg" onClick={go} disabled={!value}>
            <IconPlayerPlay size={18} /> Обещаю {value} мин
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        {task ? (
          <div className="card soft">
            <p className="task-title">{task.title}</p>
            {step && <p className="small muted" style={{ marginTop: 2 }}>Шаг: {step.title} · {step.minutes} мин</p>}
          </div>
        ) : (
          <p className="muted">Фокус без привязки к задаче.</p>
        )}
        <p className="small muted">Сколько минут вы обещаете себе заниматься только этим? Если остановитесь раньше, приложение спросит, что помешало.</p>
        <div className="row wrap">
          {PRESETS.map((p) => (
            <button key={p.min} className={`chip ${!custom && min === p.min ? 'on' : ''}`} style={{ '--c-50': 'var(--accent-soft)', '--c-400': 'var(--accent)', '--c-800': 'var(--accent-soft-text)' } as React.CSSProperties}
              onClick={() => { setMin(p.min); setCustom(''); }}>
              {p.label}{p.hint && <span className="small" style={{ fontWeight: 600, opacity: 0.8 }}> · {p.hint}</span>}
            </button>
          ))}
          <input className="input" type="number" min={1} max={240} placeholder="своё" style={{ width: 90, borderRadius: 999 }} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Своё время в минутах" />
        </div>
      </div>
    </Modal>
  );
}

// Плавающая плашка таймера, когда полноэкранный режим свёрнут
export function TimerBar() {
  const timer = useStore((s) => s.timer);
  const focusOpen = useUI((s) => s.focusOpen);
  const setFocusOpen = useUI((s) => s.setFocusOpen);
  const pause = useStore((s) => s.pauseTimer);
  const resume = useStore((s) => s.resumeTimer);
  const now = useNow(1000);
  if (!timer || focusOpen) return null;
  const left = timer.plannedMin * 60000 - elapsedMs(timer, now);
  return (
    <div className={`timer-bar ${timer.kind}`} onClick={() => setFocusOpen(true)} role="button" aria-label="Открыть таймер">
      <span className="row" style={{ gap: 8 }}>
        {timer.kind === 'focus' ? <IconTarget size={20} /> : <IconCoffee size={20} />}
        <span className="time">{formatClock(left)}</span>
        {timer.pausedAt && <span className="small">пауза</span>}
      </span>
      <button className="btn icon" style={{ background: 'color-mix(in srgb, currentColor 18%, transparent)', border: 'none', color: 'inherit' }}
        onClick={(e) => { e.stopPropagation(); if (timer.pausedAt) resume(); else pause(); }}
        aria-label={timer.pausedAt ? 'Продолжить' : 'Пауза'}>
        {timer.pausedAt ? <IconPlayerPlay size={18} /> : <IconPlayerPause size={18} />}
      </button>
    </div>
  );
}

// Полноэкранный режим фокуса/отдыха и экран «время вышло»
export function FocusScreen() {
  const open = useUI((s) => s.focusOpen);
  const setOpen = useUI((s) => s.setFocusOpen);
  const after = useUI((s) => s.after);
  const setAfter = useUI((s) => s.setAfter);
  const timer = useStore((s) => s.timer);
  const data = useStore((s) => s.data);
  const st = useStore.getState;
  const now = useNow(250);
  const [asking, setAsking] = useState(false);
  // постоянную задачу после фокуса отмечаем один раз на сессию
  const [markedFor, setMarkedFor] = useState<string | null>(null);
  const repeatMarked = !!after && markedFor === after.id;
  const setRepeatMarked = (v: boolean) => setMarkedFor(v && after ? after.id : null);

  if (!open) return null;

  const startRest = (min: number) => {
    unlockAudio();
    st().startTimer({ kind: 'rest', plannedMin: min, taskId: after?.taskId });
    setAfter(null);
  };
  const close = () => { setAfter(null); setOpen(false); };

  // ---- экран после окончания ----
  if (!timer && after) {
    const task = data.tasks.find((t) => t.id === after.taskId);
    const step = task?.steps.find((s) => s.id === after.stepId);
    const restCount = data.sessions.filter((s) => s.kind === 'focus' && s.completed && s.start > Date.now() - 4 * 3600000).length;
    const longRest = restCount > 0 && restCount % 4 === 0;
    return (
      <div className="focus-screen">
        {after.kind === 'focus' ? (
          <>
            {focusPoints(after.actualMin, true) > 0 && (
              <div className="pill gold bounce" style={{ fontSize: 18 }}>
                +{focusPoints(after.actualMin, true)} {plural(focusPoints(after.actualMin, true), 'очко', 'очка', 'очков')}
              </div>
            )}
            <h1>Фокус {formatMin(after.actualMin)} выполнен!</h1>
            <p className="muted" style={{ maxWidth: 420 }}>
              {longRest ? 'Это уже четвёртый заход — вы заслужили длинный перерыв.' : 'Теперь можно отдохнуть с чистой совестью.'}
            </p>
            {task && step && !step.done && (
              <button className="btn violet lg" onClick={() => st().toggleStep(task.id, step.id)}>
                <IconCheck size={18} /> Шаг «{step.title}» выполнен
              </button>
            )}
            {task?.repeat && !repeatMarked && (
              <button className="btn violet lg" onClick={() => { st().doRepeat(task.id); setRepeatMarked(true); }}>
                <IconCheck size={18} /> «{task.title}» — сделано
              </button>
            )}
            <div className="row wrap" style={{ justifyContent: 'center' }}>
              <button className="btn primary lg" onClick={() => startRest(longRest ? data.settings.longRestMin : data.settings.restMin)}>
                <IconCoffee size={18} /> Отдых {longRest ? data.settings.longRestMin : data.settings.restMin} мин
              </button>
              <button className="btn lg" onClick={() => { setAfter(null); setOpen(false); useUI.getState().askStart({ taskId: after.taskId }); }}>
                <IconTarget size={18} /> Ещё фокус
              </button>
            </div>
            <button className="btn ghost" onClick={close}>Закрыть</button>
          </>
        ) : (
          <>
            <h1>Отдых окончен</h1>
            <p className="muted">Отдохнули? Возвращаемся к делу.</p>
            <div className="row wrap" style={{ justifyContent: 'center' }}>
              <button className="btn primary lg" onClick={() => { setAfter(null); setOpen(false); useUI.getState().askStart({ taskId: after.taskId }); }}>
                <IconTarget size={18} /> Начать фокус
              </button>
              <button className="btn lg" onClick={close}>Позже</button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (!timer) return null;

  const planned = timer.plannedMin * 60000;
  const el = elapsedMs(timer, now);
  const frac = Math.min(1, el / planned);
  const task = data.tasks.find((t) => t.id === timer.taskId);
  const step = task?.steps.find((s) => s.id === timer.stepId);
  const R = 140;
  const C = 2 * Math.PI * R;
  const color = timer.kind === 'focus' ? 'var(--accent)' : 'var(--success)';

  const stopEarly = (reason: string) => {
    const s = st().finishTimer(false, reason);
    setAsking(false);
    setOpen(false);
    if (s && timer.kind === 'focus') setAfter(null);
  };

  return (
    <div className="focus-screen">
      <div className="row" style={{ position: 'absolute', top: 16, right: 16 }}>
        <button className="btn icon ghost" onClick={() => setOpen(false)} aria-label="Свернуть"><IconMinimize size={22} /></button>
      </div>
      <span className={`pill ${timer.kind === 'focus' ? 'pink' : 'violet'}`}>
        {timer.kind === 'focus' ? <><IconTarget size={16} /> Фокус · обещано {timer.plannedMin} мин</> : <><IconCoffee size={16} /> Отдых с чистой совестью</>}
      </span>
      <div className="ring-wrap">
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="14" />
          <circle cx="150" cy="150" r={R} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset .3s linear' }} />
        </svg>
        <div className="ring-center">
          <div className="ring-time">{formatClock(planned - el)}</div>
          {timer.pausedAt && <div className="muted" style={{ marginTop: 6, fontWeight: 700 }}>пауза</div>}
        </div>
      </div>
      {task && (
        <div style={{ maxWidth: 480 }}>
          <h2>{task.title}</h2>
          {step && <p className="muted" style={{ marginTop: 4 }}>{step.title}</p>}
        </div>
      )}
      <div className="row wrap" style={{ justifyContent: 'center' }}>
        {timer.pausedAt ? (
          <button className="btn primary lg" onClick={() => st().resumeTimer()}><IconPlayerPlay size={18} /> Продолжить</button>
        ) : (
          <button className="btn lg" onClick={() => st().pauseTimer()}><IconPlayerPause size={18} /> Пауза</button>
        )}
        {timer.kind === 'focus' ? (
          <button className="btn lg" onClick={() => setAsking(true)}><IconFlag size={18} /> Остановить</button>
        ) : (
          <button className="btn lg" onClick={() => { st().finishTimer(false, 'Закончил отдых раньше'); setOpen(false); }}>Хватит отдыхать</button>
        )}
      </div>

      {asking && (
        <Modal title="Остановиться раньше?" onClose={() => setAsking(false)}>
          <p className="muted" style={{ marginBottom: 14 }}>
            Вы обещали себе {timer.plannedMin} мин, прошло {formatMin(el / 60000)}. Что помешало? Ответ попадёт в статистику — так будет видно, что чаще всего сбивает.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {INTERRUPT_REASONS.map((r) => (
              <button key={r} className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => stopEarly(r)}>{r}</button>
            ))}
            <button className="btn primary" onClick={() => setAsking(false)}><IconArrowBackUp size={18} /> Вернуться к работе</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
