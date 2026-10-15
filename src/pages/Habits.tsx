import { useState } from 'react';
import { IconPlus, IconPin, IconBulb, IconBatteryOff, IconFlame, IconLeaf } from '@tabler/icons-react';
import type { HabitCategory } from '../types';
import { liveHabits, useStore } from '../store';
import { ALL_HABITS_BONUS, CATEGORIES, HABIT_ADVICE, doneOn, pinnedFor } from '../lib/habits';
import { dayKey } from '../lib/util';
import { HabitCard, HabitEditor, HabitPicker, newHabit } from '../components/Habits';
import { Bar, Seg } from '../components/ui';

export function HabitsPage() {
  const data = useStore((s) => s.data);
  const [cat, setCat] = useState<HabitCategory | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const habits = liveHabits(data);
  const pinned = habits.filter((h) => h.mine);
  const todayList = pinnedFor(data.habits);
  const today = dayKey();
  const todayDone = todayList.filter((h) => doneOn(data.habitLogs, h.id, today)).length;
  const inCat = habits.filter((h) => cat === 'all' || h.category === cat).sort((a, b) => a.minutes - b.minutes);
  const easy = inCat.filter((h) => (h.tier ?? 'easy') === 'easy');
  const hard = inCat.filter((h) => h.tier === 'hard');

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Привычки и простые дела</h1>
          <p className="sub">Закрепляйте привычки, чтобы выполнять их регулярно, а в дни без сил выбирайте дела на 1–10 минут.</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><IconPlus size={18} /> Своё дело</button>
      </div>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="section-head">
          <h2 className="row" style={{ gap: 8 }}><IconPin size={20} color="var(--accent)" /> Закреплённые</h2>
          {todayList.length > 0 && <span className="small muted">сегодня {todayDone} из {todayList.length}{todayList.length > 1 ? ` · за все бонус +${ALL_HABITS_BONUS}` : ''}</span>}
        </div>
        {pinned.length > 0 ? (
          <>
            {todayList.length > 0 && <div style={{ marginBottom: 12 }}><Bar value={todayDone / todayList.length} color="var(--success)" /></div>}
            <div className="grid-cards">{pinned.map((h) => <HabitCard key={h.id} habit={h} />)}</div>
            {pinned.length > 4 && (
              <p className="small faint" style={{ marginTop: 8 }}>Совет: лучше 2–3 привычки, которые держатся, чем семь, которые бросаются. Если тяжело — открепите лишние.</p>
            )}
          </>
        ) : (
          <p className="small muted">Нажмите на значок булавки у любого дела ниже и выберите дни — привычка появится на экране «Сейчас» в списке на сегодня.</p>
        )}
      </div>

      <div className="card hero section">
        <h2 className="row" style={{ gap: 8, marginBottom: 10 }}><IconBatteryOff size={22} color="var(--accent)" /> Нет сил ни на что?</h2>
        <HabitPicker />
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Все дела</h2>
          <Seg<HabitCategory | 'all'> value={cat} onChange={setCat}
            options={[{ v: 'all', label: 'Все' }, ...(Object.keys(CATEGORIES) as HabitCategory[]).map((k) => ({ v: k, label: CATEGORIES[k].label }))]} />
        </div>

        {easy.length > 0 && (
          <>
            <h3 className="row" style={{ gap: 6, margin: '6px 0 10px' }}><IconLeaf size={18} color="var(--success)" /> Простые · 1–10 минут · +5</h3>
            <div className="grid-cards">{easy.map((h) => <HabitCard key={h.id} habit={h} />)}</div>
          </>
        )}
        {hard.length > 0 && (
          <>
            <h3 className="row" style={{ gap: 6, margin: '22px 0 10px' }}><IconFlame size={18} color="var(--warning)" /> Посерьёзнее · больше награда · +15–20</h3>
            <div className="grid-cards">{hard.map((h) => <HabitCard key={h.id} habit={h} />)}</div>
          </>
        )}
      </div>

      <div className="section">
        <h2 className="row" style={{ gap: 8, marginBottom: 10 }}><IconBulb size={22} color="var(--warning)" /> Как выработать привычку</h2>
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))' }}>
          {HABIT_ADVICE.map((a, i) => (
            <div key={a.title} className="card soft">
              <p style={{ fontWeight: 800, marginBottom: 4 }}><span style={{ color: 'var(--accent)' }}>{i + 1}.</span> {a.title}</p>
              <p className="small muted">{a.text}</p>
            </div>
          ))}
        </div>
      </div>

      {adding && <HabitEditor habit={newHabit()} onClose={() => setAdding(false)} />}
    </div>
  );
}
