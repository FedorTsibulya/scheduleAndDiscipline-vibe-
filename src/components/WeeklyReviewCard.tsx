import { useState } from 'react';
import { IconSparkles, IconLoader2, IconAlertTriangle, IconTrophy, IconBulb, IconAnchor, IconRefresh } from '@tabler/icons-react';
import { useStore } from '../store';
import { AiError, aiConfigured, weeklyReview } from '../lib/ai';
import { dayLabel } from '../lib/util';

export function WeeklyReviewCard() {
  const ai = useStore((s) => s.ai);
  const last = useStore((s) => s.lastReview);
  const setLast = useStore((s) => s.setLastReview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!aiConfigured(ai)) return null;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      setLast(await weeklyReview(ai, useStore.getState().data));
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Не получилось. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const r = last?.review;
  return (
    <div className="card hero section">
      <div className="section-head">
        <h2 className="row" style={{ gap: 8 }}><IconSparkles size={20} color="var(--primary)" /> Итоги недели от Claude</h2>
        <button className="btn sm violet" onClick={() => void run()} disabled={busy}>
          {busy ? <IconLoader2 size={15} className="spin" /> : r ? <IconRefresh size={15} /> : <IconSparkles size={15} />}
          {busy ? 'Claude анализирует…' : r ? 'Обновить' : 'Подвести итоги'}
        </button>
      </div>
      {error && <p className="small row" style={{ color: 'var(--danger)', alignItems: 'flex-start' }}><IconAlertTriangle size={16} style={{ flexShrink: 0 }} /> {error}</p>}
      {!r && !error && <p className="small muted">Claude посмотрит на неделю: что получилось, что застряло и что попробовать дальше.</p>}
      {r && (
        <div className="stack" style={{ gap: 14 }}>
          <p>{r.summary}</p>
          {r.wins.length > 0 && (
            <div>
              <p className="row" style={{ fontWeight: 800, gap: 6, marginBottom: 4, color: 'var(--success)' }}><IconTrophy size={18} /> Победы</p>
              <ul style={{ margin: 0, paddingLeft: 22 }}>{r.wins.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {r.stuck.length > 0 && (
            <div>
              <p className="row" style={{ fontWeight: 800, gap: 6, marginBottom: 4, color: 'var(--warning)' }}><IconAnchor size={18} /> Застряло</p>
              <ul style={{ margin: 0, paddingLeft: 22 }}>{r.stuck.map((s, i) => <li key={i}><b>{s.task}</b> — {s.advice}</li>)}</ul>
            </div>
          )}
          {r.tips.length > 0 && (
            <div>
              <p className="row" style={{ fontWeight: 800, gap: 6, marginBottom: 4, color: 'var(--primary)' }}><IconBulb size={18} /> На следующую неделю</p>
              <ul style={{ margin: 0, paddingLeft: 22 }}>{r.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          {last && <p className="small faint">Разбор от {dayLabel(new Date(last.at))}</p>}
        </div>
      )}
    </div>
  );
}
