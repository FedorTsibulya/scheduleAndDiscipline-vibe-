import type { AppData, Settings, SyncConfig, Syncable } from '../types';
import { emptyData } from './defaults';

// ---------- слияние ----------

function mergeList<T extends Syncable>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const x of a) map.set(x.id, x);
  for (const y of b) {
    const x = map.get(y.id);
    if (!x || y.updatedAt > x.updatedAt) map.set(y.id, y);
  }
  return [...map.values()];
}

const newerSettings = (a: Settings, b: Settings) => (b.updatedAt > a.updatedAt ? b : a);

// Для каждой записи побеждает версия с более поздним updatedAt.
// Удалённые записи хранятся с флагом deleted, поэтому удаление тоже синхронизируется.
export function mergeData(local: AppData, remote: AppData): AppData {
  const r = { ...emptyData(), ...remote };
  return {
    version: 1,
    tasks: mergeList(local.tasks, r.tasks),
    moods: mergeList(local.moods, r.moods),
    sessions: mergeList(local.sessions, r.sessions),
    rewards: mergeList(local.rewards, r.rewards),
    points: mergeList(local.points, r.points),
    achievements: mergeList(local.achievements, r.achievements),
    habits: mergeList(local.habits, r.habits),
    habitLogs: mergeList(local.habitLogs, r.habitLogs),
    settings: newerSettings(local.settings, r.settings ?? local.settings),
  };
}

// Стабильная сериализация для сравнения «изменилось ли что-то»
export function canonical(d: AppData): string {
  const byId = <T extends Syncable>(xs: T[]) => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return JSON.stringify({
    ...d,
    tasks: byId(d.tasks),
    moods: byId(d.moods),
    sessions: byId(d.sessions),
    rewards: byId(d.rewards),
    points: byId(d.points),
    achievements: byId(d.achievements),
    habits: byId(d.habits),
    habitLogs: byId(d.habitLogs),
  });
}

// ---------- base64 для UTF-8 ----------

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ---------- GitHub Contents API ----------

export class SyncError extends Error {}

const api = (cfg: SyncConfig) =>
  `https://api.github.com/repos/${encodeURIComponent(cfg.owner.trim())}/${encodeURIComponent(cfg.repo.trim())}/contents/${cfg.path
    .trim()
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

const headers = (cfg: SyncConfig, accept = 'application/vnd.github+json') => ({
  Authorization: `Bearer ${cfg.token.trim()}`,
  Accept: accept,
  'X-GitHub-Api-Version': '2022-11-28',
});

function explain(status: number): string {
  if (status === 401) return 'GitHub не принял токен. Проверьте, что он скопирован целиком и не истёк.';
  if (status === 403) return 'У токена нет прав на запись. Нужен доступ Contents: Read and write к репозиторию с данными.';
  if (status === 404) return 'Репозиторий не найден. Проверьте имя владельца, имя репозитория и что токен выдан для него.';
  return `GitHub ответил ошибкой ${status}.`;
}

export async function pull(cfg: SyncConfig): Promise<{ data: AppData | null; sha?: string }> {
  const res = await fetch(`${api(cfg)}?t=${Date.now()}`, { headers: headers(cfg), cache: 'no-store' });
  if (res.status === 404) {
    // Файла ещё нет — это нормально при первой синхронизации. Но проверим, что сам репозиторий доступен.
    const repo = await fetch(`https://api.github.com/repos/${cfg.owner.trim()}/${cfg.repo.trim()}`, { headers: headers(cfg) });
    if (!repo.ok) throw new SyncError(explain(repo.status));
    return { data: null };
  }
  if (!res.ok) throw new SyncError(explain(res.status));
  const json = await res.json();
  let text: string;
  if (json.content) text = fromBase64(json.content);
  else {
    // файлы больше 1 МБ API отдаёт только «сырыми»
    const raw = await fetch(api(cfg), { headers: headers(cfg, 'application/vnd.github.raw+json'), cache: 'no-store' });
    if (!raw.ok) throw new SyncError(explain(raw.status));
    text = await raw.text();
  }
  try {
    return { data: JSON.parse(text) as AppData, sha: json.sha };
  } catch {
    throw new SyncError('Файл с данными в репозитории повреждён (не JSON).');
  }
}

export async function push(cfg: SyncConfig, data: AppData, sha?: string): Promise<'ok' | 'conflict'> {
  const res = await fetch(api(cfg), {
    method: 'PUT',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Синхронизация ${new Date().toISOString()}`,
      content: toBase64(JSON.stringify(data, null, 1)),
      ...(sha ? { sha } : {}),
    }),
  });
  if (res.status === 409 || res.status === 422) return 'conflict';
  if (!res.ok) throw new SyncError(explain(res.status));
  return 'ok';
}

// Полный цикл: скачать → слить → загрузить, если есть что загружать.
// При гонке с другим устройством (конфликт sha) повторяем ещё раз.
export async function syncWithGitHub(cfg: SyncConfig, local: AppData): Promise<AppData> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: remote, sha } = await pull(cfg);
    const merged = remote ? mergeData(local, remote) : local;
    if (remote && canonical(merged) === canonical(mergeData(emptyData(), remote))) return merged;
    const r = await push(cfg, merged, sha);
    if (r === 'ok') return merged;
    local = merged;
  }
  throw new SyncError('Не удалось синхронизироваться: данные одновременно меняются на другом устройстве. Попробуйте ещё раз.');
}

export const syncConfigured = (c: SyncConfig) => !!(c.owner.trim() && c.repo.trim() && c.path.trim() && c.token.trim());
