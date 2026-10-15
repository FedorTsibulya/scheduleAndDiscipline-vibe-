import { useState } from 'react';
import { IconSparkles, IconPlayerPlay, IconSettings, IconLoader2, IconAlertTriangle, IconX } from '@tabler/icons-react';
import { useStore } from '../store';
import { goTo, useUI } from '../uiStore';
import { AiError, aiConfigured, suggestByFeeling, type SuggestResult } from '../lib/ai';
import { PALETTE } from '../lib/colors';
import { nextStep } from '../lib/progress';
import { unlockAudio } from '../lib/sound';
import { realMood } from '../lib/habits';
import { TaskIcon } from './ui';

const EXAMPLES = [
  'Голова тяжёлая, но хочется что-то закончить. Есть минут 40',
  'Бодро, полно сил, впереди свободный вечер',
  'Тревожно и ничего не хочется',
];

// «Спросить Claude»: подбор задач по самочувствию, описанному своими словами
export function AskClaude() {
  const ai = useStore((s) => s.ai);
  const data = useStore((s) => s.data);
  const startTimer = useStore((s) => s.startTimer);
  const askStart = useUI((s) => s.askStart);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SuggestResult | null>(null);

  if (!aiConfigured(ai)) {
    return (
      <div className="card soft row wrap" style={{ justifyContent: 'space-between' }}>
        <span className="row small muted" style={{ gap: 8 }}><IconSparkles size={18} color="var(--primary)" /> Claude может подбирать задачи по самочувствию, описанному своими словами.</span>
        <button className="btn sm" onClick={() => goTo('settings')}><IconSettings size={15} /> Подключить</button>
      </div>
    );
  }

  const run = async () => {
    if (!text.trim()) {
      setError('Опишите, как вы себя чувствуете');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setResult(await suggestByFeeling(ai, useStore.getState().data, text));
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card hero">
      <div className="row" style={{ marginBottom: 10, gap: 8 }}>
        <IconSparkles size={20} color="var(--primary)" />
        <h3>Спросить Claude</h3>
      </div>
      <form className="row" style={{ alignItems: 'stretch' }} onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <textarea
          className="textarea grow" rows={2} style={{ minHeight: 48 }} value={text}
          placeholder="Как вы себя чувствуете и сколько есть времени?"
          onChange={(e) => { setText(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void run(); } }}
        />
        <button className="btn violet" disabled={busy} style={{ alignSelf: 'stretch' }}>
          {busy ? <IconLoader2 size={18} className="spin" /> : <IconSparkles size={18} />} {busy ? 'Думаю…' : 'Подобрать'}
        </button>
      </form>
      {!result && !busy && (
        <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
          {EXAMPLES.map((ex) => <button key={ex} className="btn sm ghost" style={{ fontWeight: 600 }} onClick={() => setText(ex)}>{ex}</button>)}
        </div>
      )}
      {error && <p className="small row" style={{ marginTop: 8, color: 'var(--danger)', alignItems: 'flex-start' }}><IconAlertTriangle size={16} style={{ flexShrink: 0 }} /> {error}</p>}

      {result && (
        <div className="stack" style={{ marginTop: 14, gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            {result.note ? <p style={{ fontWeight: 700, color: 'var(--primary-soft-text)' }}>{result.note}</p> : <span />}
            <button className="btn icon ghost" onClick={() => setResult(null)} aria-label="Скрыть ответ"><IconX size={16} /></button>
          </div>
          {result.picks.length === 0 && <p className="small muted">Claude не нашёл подходящих задач. Попробуйте описать состояние иначе.</p>}
          {result.picks.map((p) => {
            const t = data.tasks.find((x) => x.id === p.taskId);
            if (!t) return null;
            const step = nextStep(t);
            return (
              <div key={p.taskId} className="card" style={{ padding: '12px 14px' }}>
                <div className="task-card">
                  <TaskIcon color={t.color}><IconSparkles size={20} /></TaskIcon>
                  <div className="grow">
                    <p className="task-title">{t.title}</p>
                    {step && <p className="small faint">Следующий шаг: {step.title}</p>}
                    <p className="small" style={{ marginTop: 6 }}>{p.why}</p>
                    <p className="small" style={{ marginTop: 6, fontWeight: 700, color: PALETTE[t.color][400] }}>Начните с: {p.firstAction}</p>
                    <div className="row wrap" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                      <button className="btn sm" onClick={() => askStart({ taskId: t.id, stepId: step?.id })}>Выбрать время</button>
                      <button className="btn sm primary" onClick={() => {
                        unlockAudio();
                        startTimer({ kind: 'focus', taskId: t.id, stepId: step?.id, moodId: realMood(useStore.getState().currentMood), plannedMin: p.minutes });
                        useUI.getState().setFocusOpen(true);
                      }}>
                        <IconPlayerPlay size={15} /> Фокус {p.minutes} мин
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
