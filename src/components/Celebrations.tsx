import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { IconTrophy, IconArrowBigUpLines, IconMedal, IconSun } from '@tabler/icons-react';
import { useStore, type Celebration } from '../store';
import { CONFETTI } from '../lib/colors';
import { CHEERS } from '../lib/defaults';
import { achievementById } from '../lib/achievements';
import { DynIcon } from '../lib/icons';
import { pick, plural } from '../lib/util';
import { playChime, playPop } from '../lib/sound';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function burst(big: boolean) {
  if (reduced()) return;
  confetti({ particleCount: big ? 160 : 60, spread: big ? 110 : 70, startVelocity: big ? 45 : 32, origin: { y: big ? 0.45 : 0.3 }, colors: CONFETTI, zIndex: 100 });
  if (big) {
    setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors: CONFETTI, zIndex: 100 }), 200);
    setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors: CONFETTI, zIndex: 100 }), 350);
  }
}

// Маленький праздник: конфетти + ободряющая фраза (на каждый шаг и полный фокус)
function Cheer({ c }: { c: Extract<Celebration, { type: 'step' | 'focus' | 'habit' }> }) {
  const dismiss = useStore((s) => s.dismissCelebration);
  const sound = useStore((s) => s.data.settings.sound);
  const text = useRef(
    c.type === 'step'
      ? `${pick(CHEERS)} +${c.points}${c.postponed ? ' (бонус за отложенное)' : ''}`
      : c.type === 'habit'
        ? `${pick(CHEERS)} Маленький шаг считается. +${c.points}`
        : `Фокус ${c.minutes} мин выполнен! +${c.points}`,
  );
  useEffect(() => {
    burst(false);
    if (sound) playPop();
    const id = setTimeout(() => dismiss(c.id), 1900);
    return () => clearTimeout(id);
  }, [c.id, dismiss, sound]);
  return <div className="cheer" role="status">{text.current}</div>;
}

// Большая плашка: задача завершена, новое достижение, новый уровень
function Trophy({ c }: { c: Extract<Celebration, { type: 'task' | 'achievement' | 'level' | 'allHabits' }> }) {
  const dismiss = useStore((s) => s.dismissCelebration);
  const reopen = useStore((s) => s.reopenTask);
  const sound = useStore((s) => s.data.settings.sound);
  useEffect(() => {
    burst(true);
    if (sound) playChime();
    // у завершённой задачи плашка висит дольше — чтобы успеть нажать «вернуть»
    const id = setTimeout(() => dismiss(c.id), c.type === 'task' ? 9000 : 5000);
    return () => clearTimeout(id);
  }, [c.id, c.type, dismiss, sound]);

  let cls = '';
  let undo: (() => void) | null = null;
  let icon = <IconTrophy size={34} />;
  let title = '';
  let sub = '';
  if (c.type === 'task') {
    title = `Задача завершена · +${c.points} ${plural(c.points, 'очко', 'очка', 'очков')}`;
    sub = c.title;
    undo = () => reopen(c.taskId);
  } else if (c.type === 'allHabits') {
    icon = <IconSun size={34} />;
    title = `Все привычки дня выполнены! +${c.points}`;
    sub = `${c.count} из ${c.count} — включая бонус за полный день.`;
  } else if (c.type === 'level') {
    cls = 'level';
    icon = <IconArrowBigUpLines size={34} />;
    title = `Новый уровень: ${c.level}!`;
    sub = 'Вы растёте. Так держать!';
  } else {
    const a = achievementById(c.achievementId);
    cls = 'achievement';
    icon = a ? <DynIcon name={a.icon} size={34} /> : <IconMedal size={34} />;
    title = `Достижение: «${a?.title ?? ''}»`;
    sub = `${a?.description ?? ''} · +25 очков`;
  }

  return (
    <div className="trophy-wrap" onClick={() => dismiss(c.id)}>
      <div className={`trophy ${cls}`} role="alertdialog" aria-label={title}>
        <div className="big-icon">{icon}</div>
        <div>
          <h3>{title}</h3>
          <p style={{ marginTop: 4, fontWeight: 600 }}>{sub}</p>
          <div className="row wrap" style={{ marginTop: 6, gap: 10 }}>
            <p className="small" style={{ opacity: 0.8 }}>Нажмите, чтобы продолжить</p>
            {undo && (
              <button className="btn sm ghost" style={{ color: 'inherit', textDecoration: 'underline', padding: '2px 4px' }}
                onClick={(e) => { e.stopPropagation(); undo?.(); dismiss(c.id); }}>
                Это случайно — вернуть
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Показываем по одному празднику за раз, большие — в приоритете
export function Celebrations() {
  const list = useStore((s) => s.celebrations);
  const big = list.find((c) => c.type === 'task' || c.type === 'achievement' || c.type === 'level' || c.type === 'allHabits');
  const small = list.find((c) => c.type === 'step' || c.type === 'focus' || c.type === 'habit');
  if (big) return <Trophy key={big.id} c={big as Extract<Celebration, { type: 'task' | 'achievement' | 'level' | 'allHabits' }>} />;
  if (small) return <Cheer key={small.id} c={small as Extract<Celebration, { type: 'step' | 'focus' | 'habit' }>} />;
  return null;
}
