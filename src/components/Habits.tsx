import { useMemo, useState } from 'react';
import {
  IconCheck, IconPin, IconPinnedOff, IconChevronDown, IconChevronUp, IconPencil, IconDice5, IconAnchor, IconBulb, IconHeart,
  IconTrash, IconFlame, IconCoin, IconCalendarRepeat, IconEye, IconEyeOff, IconMinus, IconBell,
} from '@tabler/icons-react';
import type { Habit, HabitCategory, HabitTier } from '../types';
import { liveHabits, useStore } from '../store';
import {
  ALL_HABITS_BONUS, CATEGORIES, TIERS, WEEKDAYS, countOn, doneOn, everyOf, perDayOf, reminderFor, freqOf, habitPoints, habitStreak, periodInfo, pinnedFor,
  scheduleLabel, scheduledOn, streakLabel, timesOf, visibleInPool, type Freq,
} from '../lib/habits';
import { DynIcon, ICON_KEYS } from '../lib/icons';
import { addDays, appNow, dayKey, uid, weekdayShort } from '../lib/util';
import { Modal } from './Modal';
import { Bar, Check, Seg, Switch, colorVars } from './ui';

const tierOf = (h: Habit): HabitTier => h.tier ?? 'easy';

// Последние 7 дней: зелёный — сделано, серый — не сделано, бледный — не запланировано
function WeekDots({ habit }: { habit: Habit }) {
  const logs = useStore((s) => s.data.habitLogs);
  const today = appNow();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <div className="row" style={{ gap: 4 }} aria-label="Последние 7 дней">
      {days.map((d) => {
        const on = doneOn(logs, habit, dayKey(d));
        const planned = freqOf(habit) !== 'days' || scheduledOn(habit, d);
        return (
          <span key={dayKey(d)} title={`${weekdayShort(d)}: ${on ? 'сделано' : planned ? 'не сделано' : 'не запланировано'}`}
            style={{ width: 12, height: 12, borderRadius: 4, display: 'inline-block', background: on ? 'var(--success)' : 'var(--surface-3)', opacity: on || planned ? 1 : 0.35 }} />
        );
      })}
    </div>
  );
}

// Выбор дней недели для закреплённой привычки
function DaysPicker({ days, onChange }: { days: number[] | undefined; onChange: (d: number[] | undefined) => void }) {
  const set = new Set(days && days.length ? days : [0, 1, 2, 3, 4, 5, 6]);
  const preset = (d: number[] | undefined) => onChange(d);
  const toggle = (i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    if (next.size === 0) return; // хотя бы один день
    onChange(next.size === 7 ? undefined : [...next].sort());
  };
  const label = scheduleLabel({ days } as Habit);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row wrap" style={{ gap: 6 }}>
        <button type="button" className={`chip ${label === 'каждый день' ? 'on' : ''}`} style={colorVars('pink')} onClick={() => preset(undefined)}>Каждый день</button>
        <button type="button" className={`chip ${label === 'по будням' ? 'on' : ''}`} style={colorVars('pink')} onClick={() => preset([0, 1, 2, 3, 4])}>По будням</button>
        <button type="button" className={`chip ${label === 'по выходным' ? 'on' : ''}`} style={colorVars('pink')} onClick={() => preset([5, 6])}>По выходным</button>
      </div>
      <div className="row" style={{ gap: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <button key={w} type="button" onClick={() => toggle(i)} aria-pressed={set.has(i)}
            style={{
              width: 38, height: 34, borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13,
              border: `2px solid ${set.has(i) ? 'var(--accent)' : 'var(--border)'}`,
              background: set.has(i) ? 'var(--accent-soft)' : 'var(--surface)', color: set.has(i) ? 'var(--accent-soft-text)' : 'var(--text-3)',
            }}>
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

type Sched = Pick<Habit, 'freq' | 'days' | 'everyDays' | 'timesPerWeek'>;

const FREQ_HINT: Record<Freq, string> = {
  days: 'Привычка появляется в выбранные дни. Пропуск в другие дни серию не прерывает.',
  every: 'Привычка появляется, когда с прошлого раза прошло нужное число дней. Сделали раньше — тоже засчитается.',
  weekly: 'Привычка показывается каждый день, пока недельная норма не выполнена. Неделя — с понедельника по воскресенье.',
};

// Выбор регулярности: по дням недели, раз в N дней или N раз в неделю
function SchedulePicker({ value, onChange }: { value: Sched; onChange: (s: Sched) => void }) {
  const f = freqOf(value);
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" className={`chip ${on ? 'on' : ''}`} style={colorVars('pink')} onClick={onClick}>{label}</button>
  );
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Seg<Freq> value={f} onChange={(v) => onChange({ ...value, freq: v })}
        options={[{ v: 'days', label: 'По дням недели' }, { v: 'every', label: 'Раз в N дней' }, { v: 'weekly', label: 'N раз в неделю' }]} />
      {f === 'days' && <DaysPicker days={value.days} onChange={(days) => onChange({ ...value, days })} />}
      {f === 'every' && (
        <div className="row wrap" style={{ gap: 6 }}>
          {[2, 3, 4, 7, 14].map((n) => chip(everyOf(value) === n, n === 2 ? 'Через день' : n === 7 ? 'Раз в неделю (7 дн.)' : n === 14 ? 'Раз в 2 недели' : `Раз в ${n} дня`, () => onChange({ ...value, everyDays: n })))}
          <span className="row small muted" style={{ gap: 6 }}>
            или раз в
            <input type="number" min={2} max={60} className="input" style={{ width: 70, padding: '4px 8px' }} value={everyOf(value)}
              onChange={(e) => onChange({ ...value, everyDays: Math.max(2, Math.min(60, Math.round(+e.target.value) || 2)) })} aria-label="Раз в сколько дней" />
            дн.
          </span>
        </div>
      )}
      {f === 'weekly' && (
        <div className="row wrap" style={{ gap: 6 }}>
          {[1, 2, 3, 4, 5, 6].map((n) => chip(timesOf(value) === n, n === 1 ? 'Раз в неделю' : `${n} раза`, () => onChange({ ...value, timesPerWeek: n })))}
        </div>
      )}
      <p className="small faint">{FREQ_HINT[f]}</p>
    </div>
  );
}

// Диалог «Закрепить»: регулярность выполнения
function PinDialog({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const save = useStore((s) => s.saveHabit);
  const [sched, setSched] = useState<Sched>({ freq: habit.freq, days: habit.days, everyDays: habit.everyDays, timesPerWeek: habit.timesPerWeek });
  const [inCalendar, setInCalendar] = useState(!!habit.inCalendar);
  return (
    <Modal
      title="Закрепить привычку"
      onClose={onClose}
      footer={
        <>
          {habit.mine ? (
            <button className="btn danger" onClick={() => { save({ ...habit, mine: false }); onClose(); }}><IconPinnedOff size={16} /> Открепить</button>
          ) : <span />}
          <button className="btn primary" onClick={() => { save({ ...habit, mine: true, ...sched, inCalendar }); onClose(); }}><IconPin size={16} /> {habit.mine ? 'Сохранить' : 'Закрепить'}</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <p style={{ fontWeight: 800 }}>{habit.title}</p>
        <p className="small muted">
          Закреплённая привычка появляется на экране «Сейчас» в списке «Привычки на сегодня» в те дни, когда её пора делать.
          У неё считается своя серия. Если выполнить все привычки дня — бонус +{ALL_HABITS_BONUS}.
        </p>
        <div className="field">
          <span className="label-text">Как часто выполнять</span>
          <SchedulePicker value={sched} onChange={setSched} />
          <div style={{ marginTop: 8 }}><Switch checked={inCalendar} onChange={setInCalendar} label="Показывать в календаре «Неделя»" /></div>
        </div>
        {habit.anchor && (
          <p className="small row" style={{ alignItems: 'flex-start', gap: 6 }}>
            <IconAnchor size={16} style={{ flexShrink: 0, color: 'var(--primary)' }} />
            <span>Якорь: {habit.anchor.charAt(0).toLowerCase() + habit.anchor.slice(1)}. Привязка к ежедневному действию — лучшее напоминание.</span>
          </p>
        )}
      </div>
    </Modal>
  );
}

export function HabitCard({ habit, compact }: { habit: Habit; compact?: boolean }) {
  const logs = useStore((s) => s.data.habitLogs);
  const toggle = useStore((s) => s.toggleHabit);
  const save = useStore((s) => s.saveHabit);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pinning, setPinning] = useState(false);
  const unmark = useStore((s) => s.unmarkHabit);
  const done = doneOn(logs, habit, dayKey());
  const need = perDayOf(habit);
  const count = countOn(logs, habit.id, dayKey());
  const streak = habitStreak(logs, habit);
  const cat = CATEGORIES[habit.category] ?? CATEGORIES.care;
  const tier = tierOf(habit);
  const pts = habitPoints(habit);

  return (
    <div className="card" style={{ padding: '12px 14px', borderColor: done ? 'var(--success)' : tier === 'hard' ? 'var(--border-strong)' : undefined, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="task-icon tint strong" style={{ ...colorVars(cat.color), width: 40, height: 40 }}><DynIcon name={habit.icon} size={20} /></div>
        <div className="grow">
          <p style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{habit.title}</p>
          <div className="row wrap" style={{ gap: 6, marginTop: 2 }}>
            <span className="small faint">{habit.minutes} мин</span>
            <span className="tag tint" style={colorVars(cat.color)}>{cat.label}</span>
            {tier === 'hard' && <span className="tag" style={{ background: 'var(--gold)', color: 'var(--gold-text)' }}><IconFlame size={12} /> Посерьёзнее</span>}
          </div>
        </div>
        <button
          className={`btn icon ${habit.mine ? '' : 'ghost'}`} onClick={() => setPinning(true)}
          aria-pressed={habit.mine} aria-label={habit.mine ? 'Настроить закрепление' : 'Закрепить привычку'}
          title={habit.mine ? `Закреплена: ${scheduleLabel(habit)}` : 'Закрепить, чтобы выполнять регулярно'}
          style={{ color: habit.mine ? 'var(--accent)' : 'var(--text-3)', borderColor: habit.mine ? 'var(--accent)' : undefined }}
        >
          <IconPin size={18} />
        </button>
      </div>

      {habit.mine && !compact && (
        <div className="row wrap" style={{ justifyContent: 'space-between', gap: 6 }}>
          <span className="small row" style={{ gap: 4, color: 'var(--accent)', fontWeight: 700 }}><IconCalendarRepeat size={14} /> {scheduleLabel(habit)}{habit.inCalendar ? " · в календаре" : ""}</span>
          <WeekDots habit={habit} />
        </div>
      )}
      {(streak > 1 || (streak === 1 && habit.mine && freqOf(habit) === 'weekly')) && (
        <span className="small" style={{ color: 'var(--accent)', fontWeight: 800 }}><IconFlame size={13} /> {streakLabel(habit, streak)}</span>
      )}

      {open && (
        <div className="stack small" style={{ gap: 6, background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>
          {habit.why && <p className="row" style={{ alignItems: 'flex-start', gap: 6 }}><IconHeart size={16} style={{ flexShrink: 0, color: 'var(--accent)' }} /><span><b>Зачем:</b> {habit.why}</span></p>}
          {habit.tip && <p className="row" style={{ alignItems: 'flex-start', gap: 6 }}><IconBulb size={16} style={{ flexShrink: 0, color: 'var(--warning)' }} /><span><b>Как закрепить:</b> {habit.tip}</span></p>}
          {habit.anchor && <p className="row" style={{ alignItems: 'flex-start', gap: 6 }}><IconAnchor size={16} style={{ flexShrink: 0, color: 'var(--primary)' }} /><span><b>Якорь:</b> {habit.anchor.charAt(0).toLowerCase() + habit.anchor.slice(1)} → {habit.title.charAt(0).toLowerCase() + habit.title.slice(1)}</span></p>}
          <div className="row wrap" style={{ gap: 4 }}>
            <button className="btn sm ghost" onClick={() => setEditing(true)}><IconPencil size={14} /> Изменить</button>
            {!habit.mine && (
              <button className="btn sm ghost" onClick={() => save({ ...habit, hidden: !habit.hidden })}>
                {habit.hidden ? <><IconEye size={14} /> Вернуть в пул</> : <><IconEyeOff size={14} /> Скрыть из пула</>}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="row wrap" style={{ justifyContent: 'space-between', marginTop: 'auto', gap: 6 }}>
        <button className="btn sm ghost" style={{ paddingLeft: 6, paddingRight: 6 }} onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? <IconChevronUp size={15} /> : <IconChevronDown size={15} />} {open ? 'Свернуть' : 'Зачем и как'}
        </button>
        <div className="row" style={{ gap: 4 }}>
          {need > 1 && count > 0 && !done && (
            <button className="btn sm ghost" onClick={() => unmark(habit.id)} aria-label="Снять одну отметку"><IconMinus size={15} /></button>
          )}
          <button className={`btn sm ${done ? '' : 'primary'}`} onClick={() => toggle(habit.id)} aria-pressed={done}
            style={done ? { color: 'var(--success)', borderColor: 'var(--success)' } : undefined}>
            <IconCheck size={15} />
            {need > 1
              ? done ? `Сделано ${count}/${need}` : `+1 · ${count}/${need}`
              : done ? 'Сделано' : `Сделал +${pts}`}
          </button>
        </div>
      </div>
      {editing && <HabitEditor habit={habit} onClose={() => setEditing(false)} />}
      {pinning && <PinDialog habit={habit} onClose={() => setPinning(false)} />}
    </div>
  );
}

export const newHabit = (): Habit => ({
  id: uid(), updatedAt: Date.now(), title: '', minutes: 5, category: 'care', tier: 'easy', icon: 'star', why: '', tip: '', anchor: '', mine: false,
});

export function HabitEditor({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const save = useStore((s) => s.saveHabit);
  const del = useStore((s) => s.deleteHabit);
  const [h, setH] = useState<Habit>({ ...habit, tier: tierOf(habit) });
  const [err, setErr] = useState('');
  const exists = useStore.getState().data.habits.some((x) => x.id === habit.id);
  const p = (patch: Partial<Habit>) => setH((x) => ({ ...x, ...patch }));

  return (
    <Modal
      title={exists ? 'Дело' : 'Новое дело'}
      onClose={onClose}
      footer={
        <>
          {exists ? <button className="btn danger" onClick={() => { del(h.id); onClose(); }}><IconTrash size={16} /> Удалить</button> : <span />}
          <button className="btn primary" onClick={() => {
            if (!h.title.trim()) return setErr('Назовите дело');
            save({ ...h, title: h.title.trim(), anchor: h.anchor.trim(), tip: h.tip.trim(), why: h.why.trim() });
            onClose();
          }}>Сохранить</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="h-title">Что сделать</label>
          <input id="h-title" className="input" autoFocus value={h.title} placeholder="Покрасить одну миниатюру" onChange={(e) => { p({ title: e.target.value }); setErr(''); }} />
          {err && <span className="small" style={{ color: 'var(--danger)' }}>{err}</span>}
        </div>
        <div className="row wrap" style={{ gap: 14, alignItems: 'flex-end' }}>
          <div className="field" style={{ width: 110 }}>
            <label htmlFor="h-min">Минут</label>
            <input id="h-min" className="input" type="number" min={1} max={120} value={h.minutes} onChange={(e) => p({ minutes: Math.max(1, Math.min(120, Math.round(+e.target.value) || 1)) })} />
          </div>
          <div className="field" style={{ width: 110 }}>
            <label htmlFor="h-perday">Раз в день</label>
            <input id="h-perday" className="input" type="number" min={1} max={20} value={perDayOf(h)} onChange={(e) => p({ perDay: Math.max(1, Math.min(20, Math.round(+e.target.value) || 1)) })} />
          </div>
          <div className="field">
            <span className="label-text">Сложность</span>
            <Seg<HabitTier> value={tierOf(h)} onChange={(v) => p({ tier: v })} options={(['easy', 'hard'] as HabitTier[]).map((k) => ({ v: k, label: TIERS[k].label }))} />
          </div>
          <span className="pill gold" style={{ fontSize: 13 }}><IconCoin size={14} /> +{habitPoints(h)} за выполнение</span>
        </div>
        <div className="field">
          <span className="label-text">Категория</span>
          <Seg<HabitCategory> value={h.category} onChange={(v) => p({ category: v })} options={(Object.keys(CATEGORIES) as HabitCategory[]).map((k) => ({ v: k, label: CATEGORIES[k].label }))} />
        </div>
        <div className="field">
          <span className="label-text">Регулярность</span>
          <label className="switch">
            <input type="checkbox" checked={h.mine} onChange={(e) => p({ mine: e.target.checked })} />
            <span className="track" />
            <span>Закрепить — выполнять регулярно</span>
          </label>
          {h.mine && (
            <div className="stack" style={{ marginTop: 6, gap: 8 }}>
              <SchedulePicker value={h} onChange={(s) => p(s)} />
              <Switch checked={!!h.inCalendar} onChange={(v) => p({ inCalendar: v })} label="Показывать в календаре «Неделя»" />
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="h-anchor">Якорь: после чего вы будете это делать</label>
          <input id="h-anchor" className="input" value={h.anchor} placeholder="После того как налью утренний чай" onChange={(e) => p({ anchor: e.target.value })} />
          <span className="small faint">Привяжите к тому, что вы и так делаете каждый день, — это лучшее напоминание.</span>
        </div>
        <div className="field">
          <label htmlFor="h-why">Зачем</label>
          <input id="h-why" className="input" value={h.why} onChange={(e) => p({ why: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="h-tip">Как закрепить</label>
          <textarea id="h-tip" className="textarea" value={h.tip} onChange={(e) => p({ tip: e.target.value })} />
        </div>
        <div className="field">
          <span className="label-text">Значок</span>
          <div className="row wrap">
            {ICON_KEYS.map((k) => (
              <button key={k} type="button" className="btn icon" onClick={() => p({ icon: k })} aria-label={k}
                style={{ borderColor: h.icon === k ? 'var(--accent)' : undefined, background: h.icon === k ? 'var(--accent-soft)' : undefined }}>
                <DynIcon name={k} size={18} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// «Нет сил ни на что?» — несколько случайных простых дел; закреплённые и самые короткие — вероятнее
export function HabitPicker({ count = 3 }: { count?: number }) {
  const data = useStore((s) => s.data);
  const [seed, setSeed] = useState(0);
  const today = dayKey();
  const habits = liveHabits(data).filter((x) => tierOf(x) === 'easy' && visibleInPool(x, data.settings.habitCategories));
  const picks = useMemo(() => {
    const pool = habits.filter((x) => !doneOn(data.habitLogs, x, today));
    const weighted = pool.map((x) => ({ x, w: Math.random() * (x.mine ? 2 : 1) * (x.minutes <= 3 ? 1.5 : 1) }));
    return weighted.sort((a, b) => b.w - a.w).slice(0, count).map((a) => a.x.id);
    // пересчитываем только по кнопке «Другие» и при смене дня, а не после каждой отметки
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, today, habits.length]);
  const doneToday = liveHabits(data).filter((x) => doneOn(data.habitLogs, x, today)).length;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <p className="small muted" style={{ maxWidth: 520 }}>
          Ничего не хочется — это нормально. Выберите одно дело на 1–10 минут: оно сохранит серию и часто помогает «завестись».
          {doneToday > 0 && <b style={{ color: 'var(--success)' }}> Сегодня уже сделано: {doneToday}.</b>}
        </p>
        <button className="btn sm violet" onClick={() => setSeed(seed + 1)}><IconDice5 size={15} /> Другие</button>
      </div>
      <div className="grid-cards">
        {picks.map((id) => {
          const hb = habits.find((x) => x.id === id);
          return hb ? <HabitCard key={id} habit={hb} compact /> : null;
        })}
      </div>
      {picks.length === 0 && <p className="small muted">Все простые дела на сегодня сделаны. Вы молодец — можно отдыхать с чистой совестью.</p>}
    </div>
  );
}

// Сворачиваемая строка закреплённых привычек на сегодня: в заголовке «сделано из запланированных»,
// раскрытая — чек-лист с отметками (для вкладки «Задачи»)
export function HabitsFold({ onOpenAll }: { onOpenAll?: () => void }) {
  const data = useStore((s) => s.data);
  const toggle = useStore((s) => s.toggleHabit);
  const [open, setOpen] = useState(false);
  const today = dayKey();
  const list = pinnedFor(data.habits, data.habitLogs);
  if (!list.length) return null;
  const done = list.filter((x) => doneOn(data.habitLogs, x, today)).length;
  const all = done === list.length;
  const sorted = [...list].sort((a, b) => Number(doneOn(data.habitLogs, a, today)) - Number(doneOn(data.habitLogs, b, today)));

  return (
    <div className={`card habits-fold ${open ? 'open' : ''}`}>
      <button type="button" className="habits-fold-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <IconPin size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: 800 }}>Привычки на сегодня</span>
            <span className="small" style={{ fontWeight: 800, color: all ? 'var(--success)' : 'var(--text-2)' }}>
              {all ? <IconCheck size={14} style={{ verticalAlign: -2 }} /> : null} {done} / {list.length}
            </span>
          </span>
          <span style={{ display: 'block', marginTop: 6 }}><Bar value={done / list.length} color="var(--success)" thin /></span>
        </span>
        {open ? <IconChevronUp size={18} style={{ flexShrink: 0, color: 'var(--text-3)' }} /> : <IconChevronDown size={18} style={{ flexShrink: 0, color: 'var(--text-3)' }} />}
      </button>
      {open && (
        <div className="habits-fold-body">
          <p className="small faint" style={{ margin: '0 0 2px' }}>
            {all ? 'Все привычки на сегодня сделаны!' : list.length > 1 ? `За все привычки дня — бонус +${ALL_HABITS_BONUS}` : ''}
          </p>
          {sorted.map((x) => {
            const on = doneOn(data.habitLogs, x, today);
            const need = perDayOf(x);
            const count = countOn(data.habitLogs, x.id, today);
            const streak = habitStreak(data.habitLogs, x);
            const cat = CATEGORIES[x.category] ?? CATEGORIES.care;
            return (
              <div key={x.id} className={`step-row ${on ? 'done' : ''}`}>
                {need > 1 ? (
                  // несколько раз в день: кнопка-счётчик, каждое нажатие +1
                  <button className={`check ${on ? 'on' : ''}`} onClick={() => toggle(x.id)} aria-label={`Отметить: ${count} из ${need}`}
                    style={{ width: 'auto', minWidth: 40, padding: '0 6px', fontSize: 12, fontWeight: 800, color: on ? '#fff' : 'var(--text-2)' }}>
                    {count}/{need}
                  </button>
                ) : (
                  <Check on={on} label="Привычка выполнена" onClick={() => toggle(x.id)} />
                )}
                <span className="tint-sub" style={{ ...colorVars(cat.color), display: 'inline-flex' }}><DynIcon name={x.icon} size={18} /></span>
                <div className="grow">
                  <p className="step-title" style={{ fontWeight: 700 }}>{x.title}</p>
                  <p className="small faint">
                    {x.minutes} мин · {scheduleLabel(x)}
                    {periodInfo(x, data.habitLogs) ? ` (${periodInfo(x, data.habitLogs)})` : ''}
                    {streak > 1 ? ` · ${streakLabel(x, streak)}` : ''}
                  </p>
                </div>
                <span className="pill gold" style={{ fontSize: 12, padding: '2px 9px' }}>+{habitPoints(x)}</span>
              </div>
            );
          })}
          {onOpenAll && <button className="btn sm ghost" style={{ marginTop: 4 }} onClick={onOpenAll}>Все привычки</button>}
        </div>
      )}
    </div>
  );
}

// Строка-напоминание на главном экране: закреплённые привычки, не выполненные в своём периоде
// (сегодня / раз в N дней / на этой неделе). Нажатие — отметить (для «N раз в день» — +1).
export function HabitReminderStrip({ onOpenAll }: { onOpenAll?: () => void }) {
  const data = useStore((s) => s.data);
  const toggle = useStore((s) => s.toggleHabit);
  const items = liveHabits(data)
    .map((h) => ({ h, r: reminderFor(h, data.habitLogs) }))
    .filter((x): x is { h: Habit; r: { label: string; late: boolean } } => !!x.r)
    .sort((a, b) => Number(b.r.late) - Number(a.r.late));
  if (!items.length) return null;
  return (
    <div className="reminder-strip" role="region" aria-label="Не забудьте о привычках">
      <span className="small" style={{ fontWeight: 800, color: 'var(--text-2)', flexShrink: 0 }}>
        <IconBell size={14} style={{ verticalAlign: -2 }} /> Не забудьте:
      </span>
      {items.map(({ h, r }) => (
        <button key={h.id} type="button" className={`reminder-chip ${r.late ? 'late' : ''}`} onClick={() => toggle(h.id)} title="Отметить выполнение">
          <DynIcon name={h.icon} size={14} /> {h.title} <span className="faint">· {r.label}</span>
        </button>
      ))}
      {onOpenAll && <button type="button" className="btn sm ghost" style={{ flexShrink: 0 }} onClick={onOpenAll}>Все</button>}
    </div>
  );
}
