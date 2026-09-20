import { useEffect, useMemo, useRef, useState } from 'react';
import { useFlow } from '../../context/FlowContext';

const moodColor = {
  Happy: 'bg-primary-container',
  Angry: 'bg-error-container',
  Sleepy: 'bg-[#cde5ff]',
  Bored: 'bg-tertiary-container',
};

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function readableDate(date) {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`));
}

function ChatHistoryCalendar({ availableDates, selectedDate, onSelectDate, onShowAll }) {
  const [cursor, setCursor] = useState(() => {
    const base = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!selectedDate) return;
    const selected = new Date(`${selectedDate}T12:00:00`);
    setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selectedDate]);

  const messageDates = useMemo(() => new Set(availableDates), [availableDates]);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(cursor);
  const isoDate = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <aside className="rounded-2xl border border-surface-container bg-surface-container-lowest p-4 shadow-[0_3px_0_#121214]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-tertiary">Chat history</p>
          <h4 className="mt-1 text-sm font-bold text-on-surface">Pick a conversation date</h4>
        </div>
        <button type="button" onClick={onShowAll} className="rounded-full bg-surface-container px-3 py-1.5 text-[10px] font-bold text-on-surface hover:bg-surface-container-high">
          All
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high">
          <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_left</span>
        </button>
        <span className="text-xs font-bold text-on-surface">{label}</span>
        <button type="button" aria-label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high">
          <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_right</span>
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {weekDays.map((day) => <span key={day} className="py-1 text-[9px] font-bold text-on-surface-variant">{day}</span>)}
        {Array.from({ length: firstWeekday }).map((_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
          const date = isoDate(day);
          const hasMessages = messageDates.has(date);
          const isSelected = date === selectedDate;
          return hasMessages ? (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              aria-label={`View chat ${readableDate(date)}`}
              className={`relative aspect-square rounded-lg text-[10px] font-bold transition-colors ${isSelected ? 'bg-tertiary text-on-tertiary shadow-[0_2px_0_#121214]' : 'bg-tertiary-container text-on-tertiary-container hover:brightness-95'}`}
            >
              {day}
              <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current" aria-hidden="true" />
            </button>
          ) : <span key={date} className="aspect-square rounded-lg py-1 text-[10px] text-on-surface-variant/55">{day}</span>;
        })}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-on-surface-variant">Highlighted dates indicate there are messages. Psychologists can open the history for the selected date.</p>
    </aside>
  );
}

export default function PsychologistPanel() {
  const {
    psychologistClients,
    loadPsychologistClients,
    loadClientData,
    clientData,
    chatMessages,
    chatAvailableDates,
    loadChat,
    sendChat,
    authError,
    communityActivity,
    loadCommunityActivity,
    openCommunityFeed,
  } = useFlow();
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedChatDate, setSelectedChatDate] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => { loadPsychologistClients().finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!selectedClient) return;
    setSelectedChatDate('');
    void loadClientData(selectedClient.id);
    void loadCommunityActivity(selectedClient.id);
    void loadChat(selectedClient.id);
  }, [selectedClient?.id]);
  useEffect(() => {
    if (selectedClient && selectedChatDate) void loadChat(selectedClient.id, selectedChatDate);
  }, [selectedClient?.id, selectedChatDate]);

  const metrics = clientData?.dailyMetrics || [];
  const sessions = clientData?.sessions || [];
  const entries = clientData?.declutterEntries || [];
  const sleepValues = metrics.filter((item) => item.sleepHours != null).map((item) => item.sleepHours);
  const stressValues = metrics.filter((item) => item.stressScore != null).map((item) => item.stressScore);
  const sleep = sleepValues.length ? Math.round((sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length) * 10) / 10 : '—';
  const stress = stressValues.length ? Math.round(stressValues.reduce((sum, value) => sum + value, 0) / stressValues.length) : '—';
  const calendar = useMemo(() => {
    const result = new Map();
    sessions.forEach((session) => {
      const date = new Date(session.createdAt);
      if (date.getFullYear() === 2026 && date.getMonth() === 8) result.set(date.getDate(), session.mood);
    });
    return result;
  }, [sessions]);

  const submit = async (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || !selectedClient) return;
    setSending(true);
    try {
      await sendChat(selectedClient.id, text);
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  const showAllChat = () => {
    if (!selectedClient) return;
    setSelectedChatDate('');
    void loadChat(selectedClient.id);
  };

  return (
    <section className="min-h-[calc(100vh-4rem)] w-full px-4 py-8 sm:px-6 lg:px-10 xl:px-12">
      <header className="mb-7">
        <span className="text-xs font-bold uppercase tracking-widest text-tertiary">Psychologist workspace</span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">Client Insight &amp; Conversation Desk</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Select a user to view the data they've shared, mood patterns, calendar, and private conversations.</p>
      </header>
      {authError && <p className="mb-5 rounded-xl bg-error-container p-3 text-xs font-bold text-on-error-container">{authError}</p>}
      <div className="grid gap-6 xl:grid-cols-[18rem_1fr]">
        <aside className="rounded-[2rem] border border-surface-container bg-surface-container-lowest p-5 shadow-[0_4px_0_#121214]">
          <h2 className="text-lg font-bold text-on-surface">Select a user</h2>
          <div className="mt-4 space-y-2">
            {loading ? <p className="text-sm text-on-surface-variant">Loading users…</p> : psychologistClients.length === 0 ? <p className="rounded-xl bg-surface-container p-4 text-sm text-on-surface-variant">No users have chosen you yet.</p> : psychologistClients.map((client) => (
              <button key={client.id} type="button" onClick={() => setSelectedClient(client)} className={`w-full rounded-2xl p-4 text-left ${selectedClient?.id === client.id ? 'bg-tertiary-container text-on-tertiary-container shadow-[0_2px_0_#121214]' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}>
                <strong className="block text-sm">{client.name}</strong>
                <span className="mt-1 block text-xs opacity-80">{client.email}</span>
                <span className="mt-2 block text-[10px] font-bold uppercase">{client.shareDataWithPsychologist ? 'Data available' : 'Chat only'}</span>
              </button>
            ))}
          </div>
        </aside>
        <main>
          {!selectedClient ? <EmptyClientState /> : !clientData?.shareDataWithPsychologist ? (
            <div className="rounded-[2rem] bg-surface-container-lowest p-10 text-center shadow-[0_4px_0_#121214]">
              <h2 className="text-2xl font-bold text-on-surface">{selectedClient.name}</h2>
              <p className="mt-2 text-sm text-on-surface-variant">This user hasn't agreed to share their data. Private chat is still available below.</p>
              <div className="mt-6 grid gap-6 text-left lg:grid-cols-2">
                <CommunityActivityPanel activity={communityActivity} clientName={selectedClient.name} onViewActivity={openCommunityFeed} />
                <ChatPanel messages={chatMessages} availableDates={chatAvailableDates} selectedDate={selectedChatDate} onSelectDate={setSelectedChatDate} onShowAll={showAllChat} currentClient={selectedClient} message={message} setMessage={setMessage} submit={submit} sending={sending} />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-[2rem] bg-tertiary-container p-6 text-on-tertiary-container shadow-[0_4px_0_#121214]">
                <span className="text-xs font-bold uppercase tracking-widest">Selected client</span>
                <h2 className="mt-1 text-3xl font-bold">{selectedClient.name}</h2>
                <p className="mt-1 text-sm">Data shared · {sessions.length} sessions · {entries.length} Brain Dump notes</p>
              </div>
              <div className="grid gap-4 md:grid-cols-4"><Stat label="Sessions" value={sessions.length} /><Stat label="Notes" value={entries.length} /><Stat label="Average sleep" value={sleep === '—' ? '—' : `${sleep} hrs`} /><Stat label="Average stress" value={stress} /></div>
              <div className="grid gap-6 lg:grid-cols-2">
                <article className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_4px_0_#121214]"><h3 className="text-xl font-bold text-on-surface">30-day trend</h3><div className="mt-5 flex h-40 items-end gap-2">{metrics.slice(0, 12).reverse().map((item) => <div key={item.id} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t-lg bg-tertiary" style={{ height: `${Math.max(8, (item.stressScore || 0) * 1.2)}px` }} /><span className="text-[9px] text-on-surface-variant">{item.metricDate?.slice(-2)}</span></div>)}{metrics.length === 0 && <p className="text-sm text-on-surface-variant">No daily metrics yet.</p>}</div><p className="mt-3 text-xs text-on-surface-variant">Bar height = stress score per day.</p></article>
                <article className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_4px_0_#121214]"><h3 className="text-xl font-bold text-on-surface">Mood Calendar</h3><div className="mt-4 grid grid-cols-7 gap-2">{Array.from({ length: 30 }, (_, index) => index + 1).map((day) => { const mood = calendar.get(day); return <div key={day} className={`aspect-square rounded-xl p-1 text-center text-[10px] font-bold ${mood ? moodColor[mood] || 'bg-surface-container' : 'bg-surface-container-low text-on-surface-variant'}`}>{mood && <span className="material-symbols-outlined block text-sm">{mood === 'Happy' ? 'sentiment_very_satisfied' : mood === 'Angry' ? 'sentiment_very_dissatisfied' : mood === 'Sleepy' ? 'bedtime' : 'sentiment_neutral'}</span>}{day}</div>; })}</div></article>
              </div>
              <article className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_4px_0_#121214]"><h3 className="text-xl font-bold text-on-surface">Shared notes</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{entries.length ? entries.slice(0, 6).map((entry) => <div key={entry.id} className="rounded-2xl bg-surface-container p-4"><strong className="text-xs">{entry.tag} · Panic {entry.panicLevel}/5</strong><p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{entry.content}</p></div>) : <p className="text-sm text-on-surface-variant">No notes shared yet.</p>}</div></article>
              <div className="grid gap-6 lg:grid-cols-2">
                <CommunityActivityPanel activity={communityActivity} clientName={selectedClient.name} onViewActivity={openCommunityFeed} />
                <ChatPanel messages={chatMessages} availableDates={chatAvailableDates} selectedDate={selectedChatDate} onSelectDate={setSelectedChatDate} onShowAll={showAllChat} currentClient={selectedClient} message={message} setMessage={setMessage} submit={submit} sending={sending} />
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function EmptyClientState() {
  return <div className="rounded-[2rem] bg-surface-container-lowest p-12 text-center shadow-[0_4px_0_#121214]"><span className="material-symbols-outlined text-5xl text-tertiary">person_search</span><h2 className="mt-4 text-2xl font-bold text-on-surface">Select a user first</h2><p className="mt-2 text-sm text-on-surface-variant">The data dashboard and chat will appear here.</p></div>;
}

function Stat({ label, value }) {
  return <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-[0_3px_0_#121214]"><span className="text-[10px] font-bold uppercase text-on-surface-variant">{label}</span><strong className="mt-2 block text-2xl text-on-surface">{value}</strong></div>;
}

function CommunityActivityPanel({ activity, clientName, onViewActivity }) {
  const posts = activity?.posts || [];
  const comments = activity?.comments || [];
  return <article className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_4px_0_#121214]"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-widest text-primary">Community activity</span><h3 className="mt-1 text-xl font-bold text-on-surface">Community footprint</h3><p className="mt-1 text-xs text-on-surface-variant">Named posts and replies from {clientName}. Their anonymous posts are not shown.</p></div><span className="rounded-full bg-primary-container px-3 py-1.5 text-xs font-bold text-on-primary-container">{posts.length + comments.length} activities</span></div><div className="mt-5 grid gap-4"><div><h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Recent posts</h4><div className="mt-2 max-h-[15.5rem] space-y-2 overflow-y-auto pr-1">{posts.length ? posts.map((post) => <div key={post.id} className="rounded-2xl bg-surface-container p-3"><strong className="text-xs text-primary">{post.topicTag}</strong><p className="mt-1 line-clamp-2 text-sm leading-relaxed text-on-surface">{post.body}</p><button type="button" onClick={() => onViewActivity(post.id)} className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold text-on-primary shadow-[0_2px_0_#121214]"><span className="material-symbols-outlined text-sm">open_in_new</span>View Activity</button></div>) : <p className="rounded-2xl bg-surface-container p-3 text-xs text-on-surface-variant">No named posts recorded.</p>}</div></div><div><h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Recent replies</h4><div className="mt-2 max-h-[15.5rem] space-y-2 overflow-y-auto pr-1">{comments.length ? comments.map((comment) => <div key={comment.id} className="rounded-2xl bg-surface-container p-3"><p className="text-[11px] font-bold text-on-surface">Replying to {comment.postIsAnonymous ? 'an anonymous post' : comment.postAuthorName}</p><p className="mt-1 line-clamp-1 text-xs italic text-on-surface-variant">“{comment.postPreview}”</p><p className="mt-2 line-clamp-2 text-sm leading-relaxed text-on-surface">{comment.body}</p><button type="button" onClick={() => onViewActivity(comment.postId)} className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold text-on-primary shadow-[0_2px_0_#121214]"><span className="material-symbols-outlined text-sm">open_in_new</span>View Activity</button></div>) : <p className="rounded-2xl bg-surface-container p-3 text-xs text-on-surface-variant">No community replies yet.</p>}</div></div></div></article>;
}

function ChatPanel({ messages, availableDates, selectedDate, onSelectDate, onShowAll, currentClient, message, setMessage, submit, sending }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const messageScrollRef = useRef(null);
  const historyRef = useRef(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = messageScrollRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentClient.id, selectedDate, messages.length]);
  useEffect(() => {
    if (!historyOpen) return undefined;
    const handleClickOutside = (event) => {
      if (historyRef.current && !historyRef.current.contains(event.target)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [historyOpen]);
  const selectDate = (date) => {
    onSelectDate(date);
    setHistoryOpen(false);
  };
  const showAllDates = () => {
    onShowAll();
    setHistoryOpen(false);
  };

  return (
    <article className="relative mt-6 rounded-[2rem] bg-surface-container-lowest p-6 text-left shadow-[0_4px_0_#121214]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-on-surface">Chat with {currentClient.name}</h3>
          <p className="mt-1 text-xs text-on-surface-variant">{selectedDate ? `Showing messages from ${readableDate(selectedDate)}.` : "Showing this user's entire chat history."}</p>
        </div>
        <div className="relative">
          <button type="button" onClick={() => setHistoryOpen((value) => !value)} aria-expanded={historyOpen} className="inline-flex items-center gap-2 rounded-full bg-tertiary-container px-4 py-2 text-xs font-bold text-on-tertiary-container shadow-[0_2px_0_#121214] hover:brightness-95">
            <span className="material-symbols-outlined text-base" aria-hidden="true">calendar_month</span>
            Calendar history
          </button>
          {historyOpen && (
            <div ref={historyRef} role="dialog" aria-modal="true" aria-labelledby="chat-history-title" className="animate-community-panel absolute right-0 top-full z-30 mt-2 w-[20rem] rounded-[2rem] border-2 border-outline-variant bg-surface-container-lowest p-5 shadow-[0_16px_40px_rgb(27,27,29,0.18)]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-tertiary">Chat history</p>
                  <h4 id="chat-history-title" className="mt-1 text-lg font-bold text-on-surface">{currentClient.name}</h4>
                </div>
                <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close calendar history" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high">
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>
              <ChatHistoryCalendar availableDates={availableDates} selectedDate={selectedDate} onSelectDate={selectDate} onShowAll={showAllDates} />
            </div>
          )}
        </div>
      </div>
      <div ref={messageScrollRef} className="mt-4 h-[30rem] overflow-y-auto rounded-2xl bg-surface-container p-4">
        <div className="space-y-1">
          {messages.length ? messages.map((item, index) => {
            const previous = messages[index - 1];
            const fromClient = item.senderId === currentClient.id;
            const startsMessageRun = !previous || previous.senderId !== item.senderId;
            return <div key={item.id} className={`max-w-[82%] ${fromClient ? '' : 'ml-auto'} ${startsMessageRun ? 'mt-3' : 'mt-1'}`}>{startsMessageRun && <span className="mb-1 block text-[10px] font-bold text-on-surface-variant">{fromClient ? currentClient.name : 'Psychologist'} → {fromClient ? 'Psychologist' : currentClient.name}</span>}<div className={`rounded-2xl p-3 text-sm ${fromClient ? 'bg-surface-container-lowest text-on-surface' : 'bg-tertiary-container text-on-tertiary-container'}`}>{item.content}</div></div>;
          }) : <p className="text-sm text-on-surface-variant">No messages on this date.</p>}
        </div>
      </div>
      <form onSubmit={submit} className="mt-4 flex gap-3"><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength="2000" placeholder="Write a response for the user…" className="min-w-0 flex-1 rounded-full bg-surface-container px-5 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-tertiary/30" /><button disabled={sending} className="rounded-full bg-tertiary px-6 py-3 text-sm font-bold text-on-tertiary disabled:opacity-50">Send</button></form>
    </article>
  );
}
