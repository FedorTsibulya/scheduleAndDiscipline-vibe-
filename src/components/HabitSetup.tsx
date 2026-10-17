import { useState } from 'react';
import { IconCheck, IconSparkles } from '@tabler/icons-react';
import type { HabitCategory } from '../types';
import { useStore } from '../store';
import { CATEGORIES, CATEGORY_ORDER, DEFAULT_CATEGORIES } from '../lib/habits';
import { DynIcon } from '../lib/icons';
import { Modal } from './Modal';
import { colorVars } from './ui';

// Выбор категорий простых дел: плитки с описанием
export function CategoryPicker({ value, onChange }: { value: HabitCategory[]; onChange: (v: HabitCategory[]) => void }) {
  const toggle = (c: HabitCategory) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: 8 }}>
      {CATEGORY_ORDER.map((c) => {
        const cat = CATEGORIES[c];
        const on = value.includes(c);
        return (
          <button key={c} type="button" onClick={() => toggle(c)} aria-pressed={on}
            className={`card ${on ? 'tint' : ''}`}
            style={{ ...colorVars(cat.color), textAlign: 'left', cursor: 'pointer', padding: '10px 12px', borderColor: on ? 'var(--c-400)' : undefined, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span className="tint-sub" style={{ display: 'inline-flex', marginTop: 2 }}><DynIcon name={cat.icon} size={20} /></span>
            <span className="grow">
              <span style={{ fontWeight: 800, display: 'block' }}>{cat.label}</span>
              <span className="small" style={{ opacity: 0.85 }}>{cat.hint}</span>
            </span>
            {on && <IconCheck size={18} style={{ flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );
}

// Модальное окно «Настроить пул простых дел»
export function CategoryDialog({ onClose }: { onClose: () => void }) {
  const cats = useStore((s) => s.data.settings.habitCategories);
  const update = useStore((s) => s.updateSettings);
  const [value, setValue] = useState<HabitCategory[]>(cats ?? CATEGORY_ORDER);
  return (
    <Modal
      title="Какие дела вам интересны"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={() => setValue(CATEGORY_ORDER)}>Выбрать все</button>
          <button className="btn primary" disabled={!value.length} onClick={() => { update({ habitCategories: value }); onClose(); }}>Сохранить</button>
        </>
      }
    >
      <p className="small muted" style={{ marginBottom: 12 }}>
        В пуле и в подборке «Нет настроения» будут только дела из выбранных категорий. Ваши собственные дела видны всегда.
      </p>
      <CategoryPicker value={value} onChange={setValue} />
    </Modal>
  );
}

// Первое знакомство: что умеет приложение и какие категории простых дел показывать
export function Onboarding() {
  const onboarded = useStore((s) => s.data.settings.onboarded);
  const update = useStore((s) => s.updateSettings);
  const [value, setValue] = useState<HabitCategory[]>(DEFAULT_CATEGORIES);
  if (onboarded) return null;
  const finish = () => update({ habitCategories: value.length ? value : CATEGORY_ORDER, onboarded: true });
  return (
    <Modal title="Добро пожаловать в Focus Quest" onClose={finish}
      footer={
        <>
          <span />
          <button className="btn primary lg" onClick={finish}><IconSparkles size={18} /> Начать</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <ul className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li><b>Входящие</b> — записывайте всё, что крутится в голове, разберёте потом.</li>
          <li><b>Сейчас</b> — выберите настроение и получите подходящие задачи или случайную.</li>
          <li><b>Таймер фокуса</b> — пообещайте себе N минут и отдыхайте после с чистой совестью.</li>
          <li><b>Привычки</b> — простые дела на 1–10 минут для дней без сил и полезные привычки по расписанию.</li>
          <li>За всё начисляются <b>очки</b>, которые можно потратить на свои награды.</li>
        </ul>
        <div>
          <p style={{ fontWeight: 800, marginBottom: 4 }}>Какие простые дела и привычки вам интересны?</p>
          <p className="small muted" style={{ marginBottom: 10 }}>Выберите несколько — потом можно поменять в разделе «Привычки».</p>
          <CategoryPicker value={value} onChange={setValue} />
        </div>
      </div>
    </Modal>
  );
}
