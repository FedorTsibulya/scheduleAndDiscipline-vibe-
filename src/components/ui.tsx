import type { CSSProperties, ReactNode } from 'react';
import { IconCheck, IconClock, IconAlertTriangle } from '@tabler/icons-react';
import { DUE_COLORS, dueStatus } from '../lib/deadline';
import type { ColorKey, Level3, Mood } from '../types';
import { PALETTE } from '../lib/colors';
import { DynIcon } from '../lib/icons';

// CSS-переменные цвета для чипов и меток
// (в тёмной теме CSS-класс .tint меняет светлый фон на тёмный — см. styles.css)
export const colorVars = (c: ColorKey): CSSProperties =>
  ({
    '--c-50': PALETTE[c][50], '--c-200': PALETTE[c][200], '--c-400': PALETTE[c][400], '--c-600': PALETTE[c][600], '--c-800': PALETTE[c][800],
  }) as CSSProperties;

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span>{label}</span>
    </label>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={o.v === value} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`check ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on} aria-label={label}>
      {on && <IconCheck size={16} stroke={3} />}
    </button>
  );
}

export function Dots({ n, title }: { n: Level3; title: string }) {
  return (
    <span className="dots" title={title} aria-label={title}>
      <span style={{ color: 'var(--accent)' }}>{'●'.repeat(n)}</span>
      <span style={{ color: 'var(--surface-3)' }}>{'●'.repeat(3 - n)}</span>
    </span>
  );
}

export function Bar({ value, color, thin }: { value: number; color?: string; thin?: boolean }) {
  return (
    <div className={`bar ${thin ? 'thin' : ''}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

export function MoodTag({ mood }: { mood: Mood }) {
  return (
    <span className="tag tint" style={colorVars(mood.color)}>
      <DynIcon name={mood.icon} size={13} /> {mood.name}
    </span>
  );
}

export function TaskIcon({ color, children }: { color: ColorKey; children: ReactNode }) {
  return (
    <div className="task-icon tint strong" style={colorVars(color)}>
      {children}
    </div>
  );
}

// Метка срока: «Срок сегодня», «Через 2 дня», «Просрочено на 3 дня» — пересчитывается каждый день
export function DueTag({ due }: { due?: string }) {
  if (!due) return null;
  const st = dueStatus(due);
  const c = DUE_COLORS[st.level];
  const Icon = st.level === 'overdue' ? IconAlertTriangle : IconClock;
  return (
    <span className="tag" style={{ background: c.bg, color: c.fg }} title={`Срок: ${due}`}>
      <Icon size={13} /> {st.label}
    </span>
  );
}

export const CREATIVITY = ['', 'Рутина', 'Смешанная', 'Творческая'];
export const DIFFICULTY = ['', 'Лёгкая', 'Средняя', 'Сложная'];

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="em-icon">{icon}</div>
      <h3>{title}</h3>
      <p className="small" style={{ margin: '6px auto 14px', maxWidth: 360 }}>{text}</p>
      {action}
    </div>
  );
}
