import { useRef, useState } from 'react';
import {
  IconBrandGithub, IconDownload, IconUpload, IconPlus, IconTrash, IconVolume, IconBell, IconRefresh, IconAlertTriangle, IconEye, IconEyeOff, IconSparkles,
} from '@tabler/icons-react';
import type { AppData, ColorKey, Mood } from '../types';
import { liveMoods, useStore } from '../store';
import { runSync } from '../syncRunner';
import { Seg, Switch, colorVars } from '../components/ui';
import { COLOR_KEYS, PALETTE } from '../lib/colors';
import { DynIcon, ICON_KEYS } from '../lib/icons';
import { playChime } from '../lib/sound';
import { notificationsSupported, notify, requestNotifications } from '../lib/notify';
import { syncConfigured } from '../lib/sync';
import { uid } from '../lib/util';
import { AI_MODELS, AiError, aiConfigured, testKey } from '../lib/ai';
import { BUILD_TIME, checkForUpdate } from '../lib/appUpdate';

function NumField({ label, value, onChange, min = 1, max = 600 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="field" style={{ width: 150 }}>
      <label>{label}</label>
      <input className="input" type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Math.round(+e.target.value) || min)))} />
    </div>
  );
}

function MoodRow({ m }: { m: Mood }) {
  const save = useStore((s) => s.saveMood);
  const del = useStore((s) => s.deleteMood);
  const [name, setName] = useState(m.name);
  return (
    <div className="step-row edit" style={{ flexWrap: 'wrap' }}>
      <span className="chip on" style={{ ...colorVars(m.color), cursor: 'default' }}><DynIcon name={m.icon} size={17} /></span>
      <input className="input grow step-title" style={{ padding: '6px 10px', minWidth: 140 }} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== m.name && save({ ...m, name: name.trim() })} />
      <select className="select" style={{ width: 120, padding: '6px 8px' }} value={m.icon} onChange={(e) => save({ ...m, icon: e.target.value })} aria-label="Значок">
        {ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <div className="row" style={{ gap: 4 }}>
        {COLOR_KEYS.map((c) => (
          <button key={c} aria-label={c} onClick={() => save({ ...m, color: c })}
            style={{ width: 20, height: 20, borderRadius: 6, border: m.color === c ? '2px solid var(--text)' : '2px solid transparent', background: PALETTE[c][400], cursor: 'pointer' }} />
        ))}
      </div>
      <button className="btn icon ghost" onClick={() => del(m.id)} aria-label="Удалить настроение"><IconTrash size={16} /></button>
    </div>
  );
}

function ClaudeSettings() {
  const ai = useStore((s) => s.ai);
  const setAi = useStore((s) => s.setAi);
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'error'; msg?: string }>({ state: 'idle' });

  const runTest = async () => {
    setTest({ state: 'busy' });
    try {
      await testKey(ai);
      setTest({ state: 'ok' });
    } catch (e) {
      setTest({ state: 'error', msg: e instanceof AiError ? e.message : String(e) });
    }
  };

  return (
    <div className="card">
      <h2 className="row" style={{ marginBottom: 6 }}><IconSparkles size={22} color="var(--primary)" /> Claude</h2>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Подбор задач по самочувствию, разбивка на шаги, автозаполнение оценок и итоги недели. Нужен ключ API с сайта console.anthropic.com — это отдельная оплата по факту использования, не подписка claude.ai.
        Названия задач и шагов отправляются в Anthropic для обработки. Ключ хранится только на этом устройстве.
      </p>
      <div className="field">
        <label htmlFor="ai-key">Ключ API</label>
        <div className="row">
          <input id="ai-key" className="input grow" type={show ? 'text' : 'password'} autoComplete="off" placeholder="sk-ant-…" value={ai.apiKey}
            onChange={(e) => { setAi({ apiKey: e.target.value }); setTest({ state: 'idle' }); }} />
          <button className="btn icon" onClick={() => setShow(!show)} aria-label={show ? 'Скрыть ключ' : 'Показать ключ'}>{show ? <IconEyeOff size={18} /> : <IconEye size={18} />}</button>
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <span className="label-text">Модель</span>
        <div className="stack" style={{ gap: 6 }}>
          {AI_MODELS.map((m) => (
            <label key={m.id} className="row" style={{ cursor: 'pointer' }}>
              <input type="radio" name="ai-model" checked={ai.model === m.id} onChange={() => setAi({ model: m.id })} />
              <span style={{ fontWeight: 700 }}>{m.label}</span>
              <span className="small faint">{m.hint}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="row wrap" style={{ marginTop: 14, justifyContent: 'space-between' }}>
        <span className="small faint">Совет: поставьте месячный лимит расходов в консоли Anthropic (Settings → Limits).</span>
        <button className="btn" disabled={!aiConfigured(ai) || test.state === 'busy'} onClick={() => void runTest()}>
          {test.state === 'busy' ? <IconRefresh size={16} className="spin" /> : <IconSparkles size={16} />} Проверить ключ
        </button>
      </div>
      {test.state === 'ok' && <p className="small" style={{ marginTop: 10, color: 'var(--success)' }}>Ключ работает, Claude на связи.</p>}
      {test.state === 'error' && <p className="small row" style={{ marginTop: 10, color: 'var(--danger)', alignItems: 'flex-start' }}><IconAlertTriangle size={16} style={{ flexShrink: 0 }} /> {test.msg}</p>}
    </div>
  );
}

function AppVersion() {
  const [state, setState] = useState<'idle' | 'busy' | 'latest' | 'found' | 'offline'>('idle');
  const built = new Date(BUILD_TIME);
  const check = async () => {
    if (!navigator.onLine) return setState('offline');
    setState('busy');
    try {
      setState((await checkForUpdate()) ? 'found' : 'latest');
    } catch {
      setState('offline');
    }
  };
  return (
    <div className="card">
      <h2 style={{ marginBottom: 6 }}>О приложении</h2>
      <p className="small muted" style={{ marginBottom: 10 }}>
        Версия от {built.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.
        Приложение само проверяет обновления при запуске и когда вы в него возвращаетесь.
      </p>
      <div className="row wrap">
        <button className="btn" onClick={() => void check()} disabled={state === 'busy'}>
          <IconRefresh size={16} className={state === 'busy' ? 'spin' : ''} /> Проверить обновления
        </button>
        {state === 'latest' && <span className="small" style={{ color: 'var(--success)' }}>У вас последняя версия.</span>}
        {state === 'found' && <span className="small" style={{ color: 'var(--accent)' }}>Нашлась новая версия — сейчас приложение перезагрузится.</span>}
        {state === 'offline' && <span className="small muted">Нет связи — проверить не удалось.</span>}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const data = useStore((s) => s.data);
  const settings = data.settings;
  const update = useStore((s) => s.updateSettings);
  const saveMood = useStore((s) => s.saveMood);
  const sync = useStore((s) => s.sync);
  const setSync = useStore((s) => s.setSyncConfig);
  const status = useStore((s) => s.syncStatus);
  const importData = useStore((s) => s.importData);
  const resetAll = useStore((s) => s.resetAll);
  const [showToken, setShowToken] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const moods = liveMoods(data);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `focus-quest-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as AppData;
      if (!Array.isArray(d.tasks) || !d.settings) throw new Error();
      importData(d);
      setMsg('Данные загружены из файла.');
    } catch {
      setMsg('Не получилось прочитать файл. Нужен JSON, сохранённый кнопкой «Скачать копию».');
    }
  };

  const addMood = () => {
    const color: ColorKey = COLOR_KEYS[moods.length % COLOR_KEYS.length];
    saveMood({ id: uid(), name: 'Новое настроение', icon: 'smile', color, order: moods.length, updatedAt: Date.now() });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <p className="sub">Таймер, настроения, тема и синхронизация через GitHub.</p>
        </div>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Внешний вид</h2>
          <Seg value={settings.theme} onChange={(v) => update({ theme: v })} options={[{ v: 'auto', label: 'Как в системе' }, { v: 'light', label: 'Светлая' }, { v: 'dark', label: 'Тёмная' }]} />
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Таймер и день</h2>
          <div className="row wrap" style={{ gap: 14, alignItems: 'flex-end' }}>
            <NumField label="Фокус, мин" value={settings.focusMin} onChange={(v) => update({ focusMin: v })} max={240} />
            <NumField label="Отдых, мин" value={settings.restMin} onChange={(v) => update({ restMin: v })} max={60} />
            <NumField label="Длинный отдых, мин" value={settings.longRestMin} onChange={(v) => update({ longRestMin: v })} max={90} />
            <NumField label="Работы в день, мин" value={settings.dailyCapacityMin} onChange={(v) => update({ dailyCapacityMin: v })} max={960} />
            <div className="field" style={{ width: 190 }}>
              <label htmlFor="s-daystart">Новый день начинается в</label>
              <select id="s-daystart" className="select" value={settings.dayStartHour ?? 4} onChange={(e) => update({ dayStartHour: +e.target.value })}>
                {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00{h === 0 ? ' (в полночь)' : ''}</option>)}
              </select>
            </div>
          </div>
          <p className="small faint" style={{ marginTop: 8 }}>
            Всё, что сделано после полуночи и до начала нового дня, засчитывается за предыдущий день: шаги, привычки, фокус и серия.
            Удобно, если вы часто доделываете дела после 00:00.
          </p>
          <p className="small faint" style={{ marginTop: 8 }}>«Работы в день» используется для полоски загрузки на экране «Неделя». Длинный отдых предлагается после каждого 4-го фокуса.</p>
          <div className="stack" style={{ marginTop: 14 }}>
            <div className="row wrap" style={{ justifyContent: 'space-between' }}>
              <Switch checked={settings.sound} onChange={(v) => update({ sound: v })} label="Звук по окончании" />
              <button className="btn sm ghost" onClick={playChime}><IconVolume size={15} /> Проверить</button>
            </div>
            <Switch checked={settings.midReminder} onChange={(v) => update({ midReminder: v })} label="Тихий сигнал на середине фокуса" />
            <div className="row wrap" style={{ justifyContent: 'space-between' }}>
              <Switch checked={settings.notifications} onChange={async (v) => { update({ notifications: v }); if (v) await requestNotifications(); }} label="Системные уведомления" />
              {notificationsSupported() && (
                <button className="btn sm ghost" onClick={async () => { if (await requestNotifications()) void notify('Focus Quest', 'Уведомления работают!'); else setMsg('Браузер запретил уведомления. Разрешите их в настройках сайта.'); }}>
                  <IconBell size={15} /> Проверить
                </button>
              )}
            </div>
            <p className="small faint">На телефоне уведомление о конце таймера надёжно приходит, только пока приложение открыто или свёрнуто недавно — так устроены мобильные браузеры.</p>
          </div>
        </div>

        <div className="card">
          <div className="section-head">
            <h2>Настроения</h2>
            <button className="btn sm violet" onClick={addMood}><IconPlus size={15} /> Добавить</button>
          </div>
          {moods.map((m) => <MoodRow key={m.id} m={m} />)}
        </div>

        <ClaudeSettings />

        <div className="card">
          <h2 className="row" style={{ marginBottom: 6 }}><IconBrandGithub size={22} /> Синхронизация через GitHub</h2>
          <p className="small muted" style={{ marginBottom: 14 }}>
            Данные хранятся в файле в вашем приватном репозитории. Токен хранится только на этом устройстве и никуда, кроме GitHub, не отправляется. Пошаговая инструкция — в файле README проекта.
          </p>
          <div className="row wrap" style={{ gap: 12 }}>
            <div className="field grow" style={{ minWidth: 160 }}>
              <label htmlFor="s-owner">Владелец (ваш логин)</label>
              <input id="s-owner" className="input" value={sync.owner} placeholder="my-login" onChange={(e) => setSync({ owner: e.target.value })} />
            </div>
            <div className="field grow" style={{ minWidth: 160 }}>
              <label htmlFor="s-repo">Репозиторий с данными</label>
              <input id="s-repo" className="input" value={sync.repo} placeholder="my-tasks-data" onChange={(e) => setSync({ repo: e.target.value })} />
            </div>
            <div className="field grow" style={{ minWidth: 160 }}>
              <label htmlFor="s-path">Файл</label>
              <input id="s-path" className="input" value={sync.path} onChange={(e) => setSync({ path: e.target.value })} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="s-token">Токен (fine-grained, доступ Contents: Read and write только к этому репозиторию)</label>
            <div className="row">
              <input id="s-token" className="input grow" type={showToken ? 'text' : 'password'} autoComplete="off" value={sync.token} placeholder="github_pat_…" onChange={(e) => setSync({ token: e.target.value })} />
              <button className="btn icon" onClick={() => setShowToken(!showToken)} aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}>{showToken ? <IconEyeOff size={18} /> : <IconEye size={18} />}</button>
            </div>
          </div>
          <div className="row wrap" style={{ marginTop: 14, justifyContent: 'space-between' }}>
            <Switch checked={sync.auto} onChange={(v) => setSync({ auto: v })} label="Синхронизировать автоматически" />
            <button className="btn primary" disabled={!syncConfigured(sync) || status.state === 'syncing'} onClick={() => void runSync()}>
              <IconRefresh size={16} className={status.state === 'syncing' ? 'spin' : ''} /> Синхронизировать сейчас
            </button>
          </div>
          {status.state === 'ok' && status.at && <p className="small" style={{ marginTop: 10, color: 'var(--success)' }}>Синхронизировано в {new Date(status.at).toLocaleTimeString('ru-RU')}</p>}
          {status.state === 'error' && <p className="small row" style={{ marginTop: 10, color: 'var(--danger)', alignItems: 'flex-start' }}><IconAlertTriangle size={16} style={{ flexShrink: 0 }} /> {status.message}</p>}
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Резервная копия</h2>
          <div className="row wrap">
            <button className="btn" onClick={exportJson}><IconDownload size={16} /> Скачать копию</button>
            <button className="btn" onClick={() => file.current?.click()}><IconUpload size={16} /> Загрузить из файла</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ''; }} />
          </div>
          {msg && <p className="small muted" style={{ marginTop: 10 }}>{msg}</p>}
        </div>

        <AppVersion />

        <div className="card" style={{ borderColor: 'var(--danger-soft)' }}>
          <h2 style={{ marginBottom: 6 }}>Сбросить всё</h2>
          <p className="small muted" style={{ marginBottom: 10 }}>Удалит задачи, статистику и очки на этом устройстве. Копия на GitHub не удаляется, но при следующей синхронизации данные с GitHub вернутся. Чтобы подтвердить, напишите «сбросить».</p>
          <div className="row wrap">
            <input className="input" style={{ maxWidth: 200 }} value={confirmReset} onChange={(e) => setConfirmReset(e.target.value)} placeholder="сбросить" />
            <button className="btn danger" disabled={confirmReset.trim().toLowerCase() !== 'сбросить'} onClick={() => { resetAll(); setConfirmReset(''); setMsg('Данные сброшены.'); }}>Сбросить</button>
          </div>
        </div>
      </div>
    </div>
  );
}
