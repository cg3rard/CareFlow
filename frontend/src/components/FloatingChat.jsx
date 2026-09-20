import { useEffect, useMemo, useRef, useState } from 'react';
import { useFlow } from '../context/FlowContext';

export default function FloatingChat() {
  const { authUser, psychologists, loadPsychologists, chatMessages, loadChat, sendChat } = useFlow();
  const [open, setOpen] = useState(false); const [text, setText] = useState(''); const [sending, setSending] = useState(false);
  const messageScrollRef = useRef(null);
  const consultant = useMemo(() => psychologists.find((item) => item.id === authUser?.psychologistId), [psychologists, authUser?.psychologistId]);
  useEffect(() => { if (authUser?.role === 'user') void loadPsychologists(); }, [authUser?.id]);
  useEffect(() => { if (consultant) void loadChat(consultant.id); }, [consultant?.id]);
  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const container = messageScrollRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, chatMessages.length]);
  if (authUser?.role !== 'user' || !consultant) return null;
  const submit = async (event) => { event.preventDefault(); const message = text.trim(); if (!message) return; setSending(true); try { await sendChat(consultant.id, message); setText(''); } finally { setSending(false); } };
  return <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3"><div className={`w-[min(25rem,calc(100vw-2.5rem))] overflow-hidden rounded-[1.75rem] border border-surface-container bg-surface-container-lowest shadow-[0_6px_0_#121214] transition-all ${open ? 'max-h-[34rem] opacity-100' : 'max-h-0 opacity-0'}`}><div className="flex items-center justify-between bg-tertiary p-4 text-on-tertiary"><div><span className="text-[10px] font-bold uppercase tracking-widest">Private conversation</span><h2 className="text-sm font-bold">{consultant.name}</h2></div><button onClick={() => setOpen(false)} className="rounded-full bg-surface-container-lowest/20 px-2 py-1 text-sm">×</button></div><div ref={messageScrollRef} className="h-80 space-y-1 overflow-y-auto bg-surface-container p-4">{chatMessages.length === 0 ? <p className="rounded-xl bg-surface-container-lowest p-3 text-xs text-on-surface-variant">Mulai percakapan dengan {consultant.name}.</p> : chatMessages.map((item, index) => { const mine = item.senderId === authUser.id; const sender = mine ? authUser.name : consultant.name; const recipient = mine ? consultant.name : authUser.name; const previous = chatMessages[index - 1]; const startsMessageRun = !previous || previous.senderId !== item.senderId; return <div key={item.id} className={`max-w-[88%] ${mine ? 'ml-auto' : ''} ${startsMessageRun ? 'mt-3' : 'mt-1'}`}>{startsMessageRun && <span className="mb-1 block text-[10px] font-bold text-on-surface-variant">{sender} → {recipient}</span>}<div className={`rounded-2xl px-3 py-2 text-xs ${mine ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-lowest text-on-surface'}`}>{item.content}</div></div>; })}</div><form onSubmit={submit} className="flex gap-2 border-t border-surface-container p-3"><input value={text} onChange={(event) => setText(event.target.value)} maxLength="2000" placeholder="Tulis pesan…" className="min-w-0 flex-1 rounded-full bg-surface-container px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tertiary/30"/><button disabled={sending} className="rounded-full bg-tertiary px-4 py-2 text-xs font-bold text-on-tertiary disabled:opacity-50">Kirim</button></form></div><button onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-full bg-tertiary px-5 py-3 text-sm font-bold text-on-tertiary shadow-[0_4px_0_#121214] hover:-translate-y-0.5"><span className="material-symbols-outlined">chat</span>{open ? 'Tutup chat' : `Chat ${consultant.name.split(' ')[0]}`}</button></div>;
}
