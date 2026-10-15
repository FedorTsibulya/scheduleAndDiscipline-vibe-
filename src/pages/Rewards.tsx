import { useState } from 'react';
import { IconCoin, IconFlame, IconSnowflake, IconPlus, IconTrash, IconLock, IconShoppingCart, IconPencil } from '@tabler/icons-react';
import type { Reward } from '../types';
import { liveRewards, useStore } from '../store';
import { activeDays, balance, bestStreak, computeStreak, levelInfo, totalXp } from '../lib/game';
import { ACHIEVEMENTS } from '../lib/achievements';
import { DynIcon, ICON_KEYS } from '../lib/icons';
import { dayLabel, parseDay, plural, uid } from '../lib/util';
import { Bar } from '../components/ui';
import { Modal } from '../components/Modal';

function RewardEditor({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const save = useStore((s) => s.saveReward);
  const del = useStore((s) => s.deleteReward);
  const [r, setR] = useState(reward);
  const [err, setErr] = useState('');
  const exists = useStore.getState().data.rewards.some((x) => x.id === reward.id);
  return (
    <Modal
      title={exists ? 'Награда' : 'Новая награда'}
      onClose={onClose}
      footer={
        <>
          {exists ? <button className="btn danger" onClick={() => { del(r.id); onClose(); }}><IconTrash size={16} /> Удалить</button> : <span />}
          <button className="btn primary" onClick={() => {
            if (!r.title.trim()) return setErr('Назовите награду');
            if (!(r.cost > 0)) return setErr('Цена должна быть больше нуля');
            save({ ...r, title: r.title.trim() });
            onClose();
          }}>Сохранить</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="r-title">Чем себя порадуете</label>
          <input id="r-title" className="input" autoFocus value={r.title} placeholder="Серия любимого сериала" onChange={(e) => { setR({ ...r, title: e.target.value }); setErr(''); }} />
        </div>
        <div className="field">
          <label htmlFor="r-cost">Цена в очках</label>
          <input id="r-cost" className="input" type="number" min={1} value={r.cost} onChange={(e) => { setR({ ...r, cost: Math.round(+e.target.value) }); setErr(''); }} />
          <span className="small faint">Ориентир: шаг приносит 10–30 очков, завершённая задача — ещё +50.</span>
        </div>
        <div className="field">
          <span className="label-text">Значок</span>
          <div className="row wrap">
            {ICON_KEYS.map((k) => (
              <button key={k} type="button" className="btn icon" onClick={() => setR({ ...r, icon: k })}
                style={{ borderColor: r.icon === k ? 'var(--accent)' : undefined, background: r.icon === k ? 'var(--accent-soft)' : undefined }} aria-label={k}>
                <DynIcon name={k} size={20} />
              </button>
            ))}
          </div>
        </div>
        {err && <p className="small" style={{ color: 'var(--danger)' }}>{err}</p>}
      </div>
    </Modal>
  );
}

export function RewardsPage() {
  const data = useStore((s) => s.data);
  const buy = useStore((s) => s.buyReward);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [bought, setBought] = useState<string | null>(null);
  const [denied, setDenied] = useState<string | null>(null);

  const bal = balance(data.points);
  const lvl = levelInfo(totalXp(data.points));
  const days = activeDays(data);
  const streak = computeStreak(days);
  const best = bestStreak(days);
  const rewards = liveRewards(data).sort((a, b) => a.cost - b.cost);
  const unlocked = new Map(data.achievements.filter((a) => !a.deleted).map((a) => [a.id, a.at]));
  const history = data.points.filter((p) => !p.deleted).sort((a, b) => b.at - a.at).slice(0, 15);

  const onBuy = (r: Reward) => {
    if (buy(r.id)) {
      setBought(r.id);
      setTimeout(() => setBought(null), 2500);
    } else {
      setDenied(r.id);
      setTimeout(() => setDenied(null), 600);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Награды</h1>
          <p className="sub">Зарабатывайте очки за шаги и фокус и тратьте их на то, что вас радует.</p>
        </div>
      </div>

      <div className="stats-row">
        <div className="card hero">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label-text">Уровень</span>
            <span className="pill violet">{lvl.level}</span>
          </div>
          <div style={{ marginTop: 10 }}><Bar value={lvl.into / lvl.need} color="var(--primary)" /></div>
          <p className="small muted" style={{ marginTop: 6 }}>{lvl.into} / {lvl.need} опыта до уровня {lvl.level + 1}</p>
        </div>
        <div className="card hero">
          <span className="label-text">Баланс</span>
          <p key={bal} className="bounce" style={{ fontSize: 30, fontWeight: 800, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCoin size={28} color="#EF9F27" /> {bal}
          </p>
          <p className="small muted">{plural(bal, 'очко', 'очка', 'очков')} можно потратить</p>
        </div>
        <div className="card hero">
          <span className="label-text">Серия</span>
          <p style={{ fontSize: 30, fontWeight: 800, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconFlame size={28} color="#D4537E" /> {streak.current}
          </p>
          <p className="small muted row" style={{ gap: 4 }}>
            <IconSnowflake size={14} />
            {streak.freezeReady ? 'Заморозка готова: один пропуск не обнулит серию' : `Заморозка использована ${streak.freezeUsedOn ? dayLabel(parseDay(streak.freezeUsedOn)) : ''}, снова через ${streak.readyIn} дн.`}
          </p>
          <p className="small faint">Рекорд: {best} {plural(best, 'день', 'дня', 'дней')}{!streak.todayDone && streak.current > 0 ? ' · сегодня ещё не отмечено' : ''}</p>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Магазин наград</h2>
          <button className="btn sm violet" onClick={() => setEditing({ id: uid(), title: '', cost: 100, icon: 'gift', updatedAt: Date.now() })}><IconPlus size={15} /> Добавить</button>
        </div>
        <div className="grid-cards">
          {rewards.map((r) => {
            const can = bal >= r.cost;
            return (
              <div key={r.id} className={`card ${denied === r.id ? 'shake' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: bought === r.id ? 'var(--success)' : undefined }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="task-icon" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent)' }}><DynIcon name={r.icon} size={22} /></div>
                  <button className="btn icon ghost" onClick={() => setEditing(r)} aria-label="Изменить"><IconPencil size={16} /></button>
                </div>
                <p style={{ fontWeight: 800 }}>{r.title}</p>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span className="pill gold" style={{ fontSize: 13 }}><IconCoin size={14} /> {r.cost}</span>
                  {bought === r.id ? (
                    <span className="small" style={{ color: 'var(--success)', fontWeight: 800 }}>Наслаждайтесь!</span>
                  ) : (
                    <button className={`btn sm ${can ? 'primary' : ''}`} onClick={() => onBuy(r)}>
                      {can ? <><IconShoppingCart size={15} /> Взять</> : `ещё ${r.cost - bal}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Достижения</h2>
          <span className="small muted">{unlocked.size} из {ACHIEVEMENTS.length}</span>
        </div>
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
          {ACHIEVEMENTS.map((a) => {
            const at = unlocked.get(a.id);
            return (
              <div key={a.id} className="card" style={{ padding: 14, opacity: at ? 1 : 0.6, background: at ? 'var(--warning-soft)' : undefined, borderColor: at ? 'var(--gold)' : undefined }}>
                <div className="row">
                  <div className="task-icon" style={{ width: 38, height: 38, background: at ? 'var(--surface)' : 'var(--surface-2)', borderColor: at ? 'var(--warning)' : 'var(--border)', color: at ? 'var(--warning)' : 'var(--text-3)' }}>
                    {at ? <DynIcon name={a.icon} size={20} /> : <IconLock size={18} />}
                  </div>
                  <div className="grow">
                    <p style={{ fontWeight: 800, fontSize: 14, color: at ? 'var(--warning-text)' : undefined }}>{a.title}</p>
                    <p className="small" style={{ color: at ? 'var(--warning-text)' : 'var(--text-2)' }}>{a.description}</p>
                  </div>
                </div>
                {at && <p className="small" style={{ marginTop: 6, color: 'var(--warning-text)' }}>Получено {dayLabel(new Date(at))}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {history.length > 0 && (
        <div className="section">
          <h2 style={{ marginBottom: 10 }}>История очков</h2>
          <div className="card">
            {history.map((p) => (
              <div key={p.id} className="step-row">
                <span className="grow small">{p.reason}</span>
                <span className="small faint">{dayLabel(new Date(p.at))}</span>
                <span style={{ fontWeight: 800, minWidth: 48, textAlign: 'right', color: p.amount < 0 ? 'var(--accent)' : 'var(--success)' }}>{p.amount > 0 ? '+' : ''}{p.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && <RewardEditor key={editing.id} reward={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
