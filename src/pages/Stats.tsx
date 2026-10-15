import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart, ChartConfiguration } from 'chart.js';
import { IconAlertTriangle, IconChartLine } from '@tabler/icons-react';
import { liveMoods, liveTasks, useStore } from '../store';
import { ChartCanvas, chartTheme, crosshair, isDark } from '../components/Chart';
import { Empty, Seg } from '../components/ui';
import { WeeklyReviewCard } from '../components/WeeklyReviewCard';
import { DASHES, PALETTE, SERIES, SERIES_DARK } from '../lib/colors';
import { taskProgress } from '../lib/progress';
import { activeDays, bestStreak, computeStreak } from '../lib/game';
import { DynIcon } from '../lib/icons';
import { addDays, dayKey, dayLabel, formatMin, weekdayShort } from '../lib/util';

const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

export function StatsPage() {
  const data = useStore((s) => s.data);
  const [range, setRange] = useState(14);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, setThemeTick] = useState(0);
  const chartRef = useRef<Chart | null>(null);

  // перерисовать графики при смене светлой/тёмной темы
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setThemeTick((x) => x + 1);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const today = new Date();
  const days = useMemo(() => Array.from({ length: range }, (_, i) => addDays(today, i - range + 1)), [range, today.toDateString()]);
  const fromTs = new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate()).getTime();
  const tasks = liveTasks(data).filter((t) => !t.inbox);
  const focus = data.sessions.filter((s) => !s.deleted && s.kind === 'focus');
  const focusInRange = focus.filter((s) => s.start >= fromTs);
  const theme = data.settings.theme;
  const dark = isDark();

  // ---- задачи на графике: с прогрессом в периоде, не завершённые до его начала ----
  const series = useMemo(() => {
    const relevant = tasks
      .filter((t) => (!t.completedAt || t.completedAt >= fromTs) && taskProgress(t) > 0)
      .map((t) => ({ t, last: Math.max(t.updatedAt, ...t.steps.map((s) => s.doneAt ?? 0)) }))
      .sort((a, b) => b.last - a.last);
    return { shown: relevant.slice(0, 8).map((x) => x.t), extra: Math.max(0, relevant.length - 8) };
  }, [tasks, fromTs]);

  // цвет закрепляется за задачей (по порядку создания), а не за позицией в списке
  const colorOf = useMemo(() => {
    const order = [...series.shown].sort((a, b) => a.createdAt - b.createdAt);
    return new Map(order.map((t, i) => [t.id, i]));
  }, [series.shown]);

  const lineConfig = useMemo<ChartConfiguration>(() => {
    const th = chartTheme();
    const pal = dark ? SERIES_DARK : SERIES;
    return {
      type: 'line',
      data: {
        labels: days.map((d) => dayLabel(d)),
        datasets: series.shown.map((t) => {
          const i = colorOf.get(t.id) ?? 0;
          const values = days.map((d) => Math.round(taskProgress(t, endOfDay(d)) * 100));
          return {
            label: t.title,
            data: values,
            hidden: hidden.has(t.id),
            borderColor: pal[i],
            backgroundColor: pal[i],
            borderWidth: 2.5,
            borderDash: DASHES[i],
            tension: 0,
            borderJoinStyle: 'round' as const,
            borderCapStyle: 'round' as const,
            pointRadius: values.map((_, j) => (j === values.length - 1 ? 5 : 0)),
            pointBorderColor: th.surface,
            pointBorderWidth: 2,
            pointHoverRadius: 5,
            pointHoverBorderColor: th.surface,
            pointHoverBorderWidth: 2,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: th.surface, titleColor: th.text, bodyColor: th.text, borderColor: th.border, borderWidth: 1, padding: 10,
            boxWidth: 10, boxHeight: 10, itemSort: (a, b) => (b.parsed.y ?? 0) - (a.parsed.y ?? 0),
            callbacks: { label: (c) => ` ${c.dataset.label}: ${Math.round(c.parsed.y ?? 0)}%` },
          },
        },
        scales: {
          y: { min: 0, max: 100, ticks: { stepSize: 25, color: th.tick, callback: (v) => `${v}%` }, grid: { color: th.grid }, border: { display: false } },
          x: { ticks: { color: th.tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false }, border: { color: th.border } },
        },
      },
      plugins: [crosshair],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, days, hidden, dark, theme, colorOf]);

  // ---- фокус по дням ----
  const focusByDay = days.map((d) => focus.filter((s) => dayKey(s.start) === dayKey(d)).reduce((a, s) => a + s.actualMin, 0));
  const barConfig = useMemo<ChartConfiguration>(() => {
    const th = chartTheme();
    return {
      type: 'bar',
      data: {
        labels: days.map((d) => (range > 14 ? dayLabel(d) : `${weekdayShort(d)} ${d.getDate()}`)),
        datasets: [{
          label: 'Минуты фокуса', data: focusByDay.map(Math.round), backgroundColor: days.map((d) => (dayKey(d) === dayKey() ? '#D4537E' : '#AFA9EC')),
          borderRadius: { topLeft: 6, topRight: 6 }, borderSkipped: 'bottom', maxBarThickness: 24,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: th.surface, titleColor: th.text, bodyColor: th.text, borderColor: th.border, borderWidth: 1, callbacks: { label: (c) => ` ${formatMin(c.parsed.y ?? 0)}` } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: th.tick, precision: 0 }, grid: { color: th.grid }, border: { display: false } },
          x: { ticks: { color: th.tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false }, border: { color: th.border } },
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(focusByDay), days, dark, theme]);

  // ---- показатели ----
  const stepsInRange = tasks.reduce((a, t) => a + t.steps.filter((s) => s.done && (s.doneAt ?? 0) >= fromTs).length, 0);
  const tasksDone = tasks.filter((t) => t.completedAt && t.completedAt >= fromTs).length;
  const focusToday = focus.filter((s) => dayKey(s.start) === dayKey()).reduce((a, s) => a + s.actualMin, 0);
  const focusTotal = focusInRange.reduce((a, s) => a + s.actualMin, 0);
  const kept = focusInRange.length ? Math.round((focusInRange.filter((s) => s.completed).length / focusInRange.length) * 100) : 0;
  const daysSet = activeDays(data);
  const streak = computeStreak(daysSet);
  const best = bestStreak(daysSet);

  // застрявшие: не завершены, есть прогресс, но 3+ дня без изменений
  const stuck = tasks.filter((t) => {
    if (t.completedAt) return false;
    const last = Math.max(t.createdAt, ...t.steps.map((s) => s.doneAt ?? 0));
    return Date.now() - last > 3 * 86400000;
  });

  // тепловая карта: день недели × час начала фокуса
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const s of focusInRange) {
    const d = new Date(s.start);
    heat[(d.getDay() + 6) % 7][d.getHours()] += s.actualMin;
  }
  const heatMax = Math.max(1, ...heat.flat());

  const moods = liveMoods(data);
  const moodMin = moods.map((m) => ({ m, min: focusInRange.filter((s) => s.moodId === m.id).reduce((a, s) => a + s.actualMin, 0) })).filter((x) => x.min > 0).sort((a, b) => b.min - a.min);
  const moodMax = Math.max(1, ...moodMin.map((x) => x.min));
  const reasons = Object.entries(
    focusInRange.filter((s) => s.interruptReason).reduce<Record<string, number>>((a, s) => ({ ...a, [s.interruptReason!]: (a[s.interruptReason!] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);

  const toggle = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHidden(next);
  };

  const pal = dark ? SERIES_DARK : SERIES;
  const hasAny = tasks.length > 0 || focus.length > 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Статистика</h1>
          <p className="sub">Ваш прогресс в графиках и числах.</p>
        </div>
        <Seg value={range} onChange={setRange} options={[{ v: 7, label: '7 дней' }, { v: 14, label: '14 дней' }, { v: 30, label: '30 дней' }]} />
      </div>

      {!hasAny ? (
        <Empty icon={<IconChartLine size={32} />} title="Здесь появятся графики" text="Выполните первый шаг или запустите таймер фокуса, и статистика начнёт расти." />
      ) : (
        <>
          <div className="stats-row">
            <div className="stat"><div className="label">Фокус сегодня</div><div className="value">{formatMin(focusToday)}</div></div>
            <div className="stat"><div className="label">Фокус за {range} дн.</div><div className="value">{formatMin(focusTotal)}</div></div>
            <div className="stat"><div className="label">Шагов за {range} дн.</div><div className="value">{stepsInRange}</div></div>
            <div className="stat"><div className="label">Задач завершено</div><div className="value">{tasksDone}</div></div>
            <div className="stat"><div className="label">Обещаний сдержано</div><div className="value">{kept}%</div></div>
            <div className="stat"><div className="label">Простых дел за {range} дн.</div><div className="value">{data.habitLogs.filter((l) => !l.deleted && l.at >= fromTs).length}</div></div>
            <div className="stat"><div className="label">Серия · рекорд</div><div className="value">{streak.current} · {best}</div></div>
          </div>

          <WeeklyReviewCard />

          <div className="card section">
            <div className="section-head">
              <h2>Прогресс по задачам</h2>
              <span className="small muted">процент выполнения по дням</span>
            </div>
            {series.shown.length ? (
              <>
                <div className="legend" style={{ marginBottom: 12 }}>
                  {series.shown.map((t) => {
                    const i = colorOf.get(t.id) ?? 0;
                    return (
                      <button key={t.id} className={hidden.has(t.id) ? 'off' : ''} onClick={() => toggle(t.id)} aria-pressed={!hidden.has(t.id)}>
                        <svg width="22" height="10" aria-hidden="true">
                          <line x1="1" y1="5" x2="21" y2="5" stroke={pal[i]} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={DASHES[i].length ? DASHES[i].join(' ') : undefined} />
                        </svg>
                        {t.title}
                      </button>
                    );
                  })}
                </div>
                <ChartCanvas config={lineConfig} label="Ломаный график процента выполнения задач по дням" onReady={(c) => (chartRef.current = c)} />
                {series.extra > 0 && <p className="small faint" style={{ marginTop: 6 }}>Ещё {series.extra} задач не показаны — на графике 8 самых свежих.</p>}
                <p className="small faint" style={{ marginTop: 6 }}>Горизонтальный участок — задача стоит. Крутой подъём — вы были в потоке. Нажмите на задачу в легенде, чтобы скрыть линию.</p>
              </>
            ) : (
              <p className="muted small">Линии появятся, когда у задач будут выполненные шаги.</p>
            )}
          </div>

          {stuck.length > 0 && (
            <div className="card section" style={{ background: 'var(--warning-soft)', borderColor: 'transparent', color: 'var(--warning-text)' }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <IconAlertTriangle size={22} style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ fontWeight: 800 }}>Застряли больше 3 дней: {stuck.map((t) => t.title).join(', ')}</p>
                  <p className="small" style={{ marginTop: 4 }}>Попробуйте разбить следующий шаг на кусочек в 5–10 минут или запустите фокус «просто начать» на 5 минут.</p>
                </div>
              </div>
            </div>
          )}

          <div className="card section">
            <div className="section-head"><h2>Минуты фокуса по дням</h2></div>
            <ChartCanvas config={barConfig} label="Столбчатая диаграмма минут фокуса по дням" height={220} />
          </div>

          <div className="card section">
            <div className="section-head">
              <h2>Когда вам лучше работается</h2>
              <span className="small muted">минуты фокуса по часам</span>
            </div>
            <div className="heat">
              <span />
              {Array.from({ length: 24 }, (_, h) => <span key={h} style={{ textAlign: 'center' }}>{h % 3 === 0 ? h : ''}</span>)}
              {heat.map((row, wd) => (
                <div key={wd} style={{ display: 'contents' }}>
                  <span>{['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'][wd]}</span>
                  {row.map((v, h) => (
                    <div key={h} className="cell" title={`${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'][wd]}, ${h}:00 — ${formatMin(v)}`}
                      style={v ? { background: `color-mix(in srgb, #D4537E ${Math.round(20 + (v / heatMax) * 80)}%, transparent)` } : undefined} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="row wrap section" style={{ alignItems: 'stretch', gap: 12 }}>
            <div className="card grow" style={{ minWidth: 280 }}>
              <h2 style={{ marginBottom: 12 }}>Фокус по настроениям</h2>
              {moodMin.length ? (
                <div className="stack" style={{ gap: 8 }}>
                  {moodMin.map(({ m, min }) => (
                    <div key={m.id} className="hbar">
                      <span className="row" style={{ gap: 6, fontWeight: 700 }}><span style={{ color: PALETTE[m.color][400], display: 'inline-flex' }}><DynIcon name={m.icon} size={16} /></span> {m.name}</span>
                      <div className="bar"><div style={{ width: `${(min / moodMax) * 100}%`, background: PALETTE[m.color][400] }} /></div>
                      <span className="small muted" style={{ textAlign: 'right' }}>{formatMin(min)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="small muted">Выбирайте настроение на экране «Сейчас» перед фокусом — здесь будет видно, в каком состоянии вы работаете больше.</p>}
            </div>
            <div className="card grow" style={{ minWidth: 280 }}>
              <h2 style={{ marginBottom: 12 }}>Что сбивает с фокуса</h2>
              {reasons.length ? (
                <div className="stack" style={{ gap: 6 }}>
                  {reasons.map(([r, n]) => (
                    <div key={r} className="row" style={{ justifyContent: 'space-between' }}>
                      <span>{r}</span><span className="pill pink" style={{ fontSize: 12.5, padding: '2px 10px' }}>{n}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="small muted">Пока ни одного прерванного фокуса. Отлично!</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
