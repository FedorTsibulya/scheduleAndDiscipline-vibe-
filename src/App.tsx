import { useEffect, useRef, useState } from 'react';
import {
  IconSparkles, IconInbox, IconListCheck, IconCalendarWeek, IconChartLine, IconGift, IconSettings,
  IconCloudCheck, IconCloudX, IconRefresh, IconPlant2,
} from '@tabler/icons-react';
import { HabitsPage } from './pages/Habits';
import { Onboarding } from './components/HabitSetup';
import { useStore } from './store';
import { useUI, type Page } from './uiStore';
import { syncConfigured, canonical } from './lib/sync';
import { runSync } from './syncRunner';
import { TaskEditor } from './components/TaskEditor';
import { Celebrations } from './components/Celebrations';
import { FocusScreen, StartFocusDialog, TimerBar, TimerEngine } from './components/Timer';
import { NowPage } from './pages/Now';
import { InboxPage } from './pages/Inbox';
import { TasksPage } from './pages/Tasks';
import { WeekPage } from './pages/Week';
import { StatsPage } from './pages/Stats';
import { RewardsPage } from './pages/Rewards';
import { SettingsPage } from './pages/Settings';

// short — подпись в нижнем меню телефона, где 7 пунктов и мало места
const NAV: { id: Page; label: string; short?: string; icon: typeof IconSparkles }[] = [
  { id: 'now', label: 'Сейчас', icon: IconSparkles },
  { id: 'inbox', label: 'Входящие', icon: IconInbox },
  { id: 'tasks', label: 'Задачи', icon: IconListCheck },
  { id: 'week', label: 'Неделя', icon: IconCalendarWeek },
  { id: 'habits', label: 'Привычки', icon: IconPlant2 },
  { id: 'stats', label: 'Статистика', short: 'Графики', icon: IconChartLine },
  { id: 'rewards', label: 'Награды', icon: IconGift },
];

const PAGES: Record<Page, () => JSX.Element> = {
  now: NowPage, inbox: InboxPage, tasks: TasksPage, week: WeekPage, habits: HabitsPage, stats: StatsPage, rewards: RewardsPage, settings: SettingsPage,
};

const readHash = (): Page => {
  const h = location.hash.replace('#', '') as Page;
  return h in PAGES ? h : 'now';
};

function useAutoSync() {
  const data = useStore((s) => s.data);
  const sync = useStore((s) => s.sync);
  const timer = useRef<number>();
  const lastSynced = useRef('');

  useEffect(() => {
    if (!sync.auto || !syncConfigured(sync)) return;
    void runSync().then(() => (lastSynced.current = canonical(useStore.getState().data)));
    const onVis = () => document.visibilityState === 'visible' && void runSync();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onVis);
    };
  }, [sync]);

  useEffect(() => {
    if (!sync.auto || !syncConfigured(sync)) return;
    const c = canonical(data);
    if (c === lastSynced.current) return;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await runSync();
      lastSynced.current = canonical(useStore.getState().data);
    }, 4000);
    return () => clearTimeout(timer.current);
  }, [data, sync]);
}

function useTheme() {
  const theme = useStore((s) => s.data.settings.theme);
  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
}

function SyncBadge() {
  const s = useStore((x) => x.syncStatus);
  const cfg = useStore((x) => x.sync);
  if (!syncConfigured(cfg)) return null;
  const icon = s.state === 'error' ? <IconCloudX size={18} /> : s.state === 'syncing' ? <IconRefresh size={18} className="spin" /> : <IconCloudCheck size={18} />;
  const label = s.state === 'error' ? 'Ошибка синхронизации' : s.state === 'syncing' ? 'Синхронизация…' : 'Синхронизировано';
  return (
    <button className="nav-item" onClick={() => void runSync()} title={s.message ?? label} style={{ color: s.state === 'error' ? 'var(--danger)' : undefined }}>
      {icon} <span className="small">{label}</span>
    </button>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>(readHash);
  const editing = useUI((s) => s.editing);
  const edit = useUI((s) => s.edit);
  const inboxCount = useStore((s) => s.data.tasks.filter((t) => !t.deleted && t.inbox).length);
  useTheme();
  useAutoSync();

  useEffect(() => {
    const onHash = () => setPage(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (p: Page) => {
    location.hash = p;
    setPage(p);
    window.scrollTo({ top: 0 });
  };

  const Current = PAGES[page];
  const navButtons = (withSettings: boolean) => (
    <>
      {NAV.map(({ id, label, short, icon: I }) => (
        <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => go(id)} aria-current={page === id ? 'page' : undefined} aria-label={label}>
          <I size={22} /> <span>{withSettings ? label : short ?? label}</span>
          {id === 'inbox' && inboxCount > 0 && <span className="nav-badge">{inboxCount}</span>}
        </button>
      ))}
      {withSettings && (
        <button className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}>
          <IconSettings size={22} /> <span>Настройки</span>
        </button>
      )}
    </>
  );

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Разделы">
        <div className="brand"><img src="./icon-192.png" alt="" /> Focus Quest</div>
        {navButtons(true)}
        <div style={{ marginTop: 'auto' }}><SyncBadge /></div>
      </nav>
      <main className="main">
        <Current key={page} />
      </main>
      <nav className="bottom-nav" aria-label="Разделы">{navButtons(false)}</nav>
      <button className="btn icon mobile-only mobile-settings" onClick={() => go('settings')} aria-label="Настройки">
        <IconSettings size={20} />
      </button>

      {editing && <TaskEditor key={editing.id} task={editing} onClose={() => edit(null)} />}
      <StartFocusDialog />
      <TimerEngine />
      <TimerBar />
      <FocusScreen />
      <Celebrations />
      <Onboarding />
    </div>
  );
}
