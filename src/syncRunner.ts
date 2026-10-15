import { useStore } from './store';
import { canonical, syncConfigured, syncWithGitHub } from './lib/sync';

// Синхронизация: при запуске, при возврате во вкладку, через 4 с после изменений и по кнопке
export async function runSync() {
  const st = useStore.getState();
  if (!syncConfigured(st.sync) || st.syncStatus.state === 'syncing') return;
  st.setSyncStatus({ state: 'syncing' });
  const before = canonical(st.data);
  try {
    const merged = await syncWithGitHub(st.sync, st.data);
    // если пока шла синхронизация что-то изменилось локально — не теряем это, повторим чуть позже
    if (canonical(useStore.getState().data) === before) useStore.getState().replaceData(merged);
    else setTimeout(() => void runSync(), 1000);
    useStore.getState().setSyncStatus({ state: 'ok', at: Date.now() });
  } catch (e) {
    useStore.getState().setSyncStatus({ state: 'error', at: Date.now(), message: e instanceof Error ? e.message : String(e) });
  }
}
