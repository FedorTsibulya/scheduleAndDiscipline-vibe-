import { useState } from 'react';
import { IconPlus, IconTrash, IconWand, IconInbox, IconBulb } from '@tabler/icons-react';
import { liveTasks, useStore } from '../store';
import { useUI } from '../uiStore';
import { Empty } from '../components/ui';

export function InboxPage() {
  const data = useStore((s) => s.data);
  const addInbox = useStore((s) => s.addInbox);
  const deleteTask = useStore((s) => s.deleteTask);
  const edit = useUI((s) => s.edit);
  const [text, setText] = useState('');
  const items = liveTasks(data).filter((t) => t.inbox).sort((a, b) => b.createdAt - a.createdAt);

  const add = () => {
    if (text.trim()) addInbox(text);
    setText('');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Входящие</h1>
          <p className="sub">Записывайте всё сразу и без оценок. Разберёте потом, когда будет время.</p>
        </div>
      </div>

      <form className="row" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input big grow" autoFocus placeholder="Что у вас в голове?" value={text} onChange={(e) => setText(e.target.value)}
          // вставка списка из нескольких строк — каждая строка станет записью
          onPaste={(e) => {
            const t = e.clipboardData.getData('text');
            if (t.includes('\n')) {
              e.preventDefault();
              t.split('\n').map((l) => l.trim()).filter(Boolean).forEach(addInbox);
            }
          }} />
        <button className="btn primary icon" style={{ borderRadius: 999, padding: 12 }} aria-label="Добавить"><IconPlus size={20} /></button>
      </form>

      <div className="section">
        {items.length ? (
          <>
            <div className="section-head">
              <h2>Ждут разбора: {items.length}</h2>
            </div>
            <p className="small muted row" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
              <IconBulb size={16} style={{ flexShrink: 0 }} /> Разбор: разбейте дело на шаги по 15–45 минут, отметьте настроение, сложность, важность и срочность. Если дело занимает меньше 2 минут, лучше сделать его сразу.
            </p>
            <div className="stack" style={{ gap: 8 }}>
              {items.map((t) => (
                <div key={t.id} className="card" style={{ padding: '10px 14px' }}>
                  <div className="row">
                    <p className="grow" style={{ fontWeight: 700 }}>{t.title}</p>
                    <button className="btn sm violet" onClick={() => edit(t)}><IconWand size={15} /> Разобрать</button>
                    <button className="btn icon ghost" onClick={() => deleteTask(t.id)} aria-label="Удалить"><IconTrash size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Empty icon={<IconInbox size={32} />} title="Входящие пусты" text="Голова свободна. Как только вспомните дело, запишите его сюда, даже одним словом." />
        )}
      </div>
    </div>
  );
}
