import { useState } from 'react';
import { IconPlus, IconPin, IconBulb, IconBatteryOff, IconFlame, IconLeaf, IconAdjustments, IconEye, IconEyeOff } from '@tabler/icons-react';
import type { HabitCategory } from '../types';
import { liveHabits, useStore } from '../store';
import {
  ALL_HABITS_BONUS, CATEGORIES, CATEGORY_ORDER, DEFAULT_CATEGORIES, HABIT_ADVICE, doneOn, pinnedFor, visibleInPool,
} from '../lib/habits';
import { CategoryDialog, CategoryPicker } from '../components/HabitSetup';
import { dayKey } from '../lib/util';
import { HabitCard, HabitEditor, HabitPicker, newHabit } from '../components/Habits';
import { Bar, Seg } from '../components/ui';

export function HabitsPage() {
  const data = useStore((s) => s.data);
  const update = useStore((s) => s.updateSettings);
  const [cat, setCat] = useState<HabitCategory | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const [setup, setSetup] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [firstPick, setFirstPick] = useState<HabitCategory[]>(DEFAULT_CATEGORIES);
  const cats = data.settings.habitCategories;
  const habits = liveHabits(data);
  const pinned = habits.filter((h) => h.mine);
  const todayList = pinnedFor(data.habits, data.habitLogs);
  const today = dayKey();
  const todayDone = todayList.filter((h) => doneOn(data.habitLogs, h, today)).length;
  const visible = habits.filter((h) => visibleInPool(h, cats));
  const hiddenOnes = habits.filter((h) => !visibleInPool(h, cats));
  const shownCats = CATEGORY_ORDER.filter((c) => visible.some((h) => h.category === c));
  const inCat = (showHidden ? habits : visible).filter((h) => cat === 'all' || h.category === cat).sort((a, b) => a.minutes - b.minutes);
  const easy = inCat.filter((h) => (h.tier ?? 'easy') === 'easy');
  const hard = inCat.filter((h) => h.tier === 'hard');

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Привычки и простые дела</h1>
          <p className="sub">Закрепляйте привычки, чтобы выполнять их регулярно, а в дни без сил выбирайте дела на 1–10 минут.</p>
        </div>
        <div className="row wrap">
          <button className="btn" onClick={() => setSetup(true)}><IconAdjustments size={18} /> Настроить пул</button>
          <button className="btn primary" onClick={() => setAdding(true)}><IconPlus size={18} /> Своё дело</button>
        </div>
      </div>

      {!cats && (
        <div className="card hero section" style={{ marginTop: 0, marginBottom: 20 }}>
          <h2 style={{ marginBottom: 4 }}>Настройте пул под себя</h2>
          <p className="small muted" style={{ marginBottom: 12 }}>Отметьте, какие дела вам интересны. Остальные категории уйдут из пула и из подборки «Нет настроения» — вернуть их можно в любой момент.</p>
          <CategoryPicker value={firstPick} onChange={setFirstPick} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn primary" disabled={!firstPick.length} onClick={() => update({ habitCategories: firstPick })}>Готово</button>
          </div>
        </div>
      )}

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
            options={[{ v: 'all', label: 'Все' }, ...(showHidden ? CATEGORY_ORDER : shownCats).map((k) => ({ v: k, label: CATEGORIES[k].label }))]} />
        </div>
        {hiddenOnes.length > 0 && (
          <button className="btn sm ghost" style={{ marginBottom: 8 }} onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? <IconEyeOff size={15} /> : <IconEye size={15} />} {showHidden ? 'Показывать только мой пул' : `Показать скрытые и выключенные (${hiddenOnes.length})`}
          </button>
        )}

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
      {setup && <CategoryDialog onClose={() => setSetup(false)} />}
    </div>
  );
}
