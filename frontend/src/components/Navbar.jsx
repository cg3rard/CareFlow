import { useFlow } from '../context/FlowContext';

const navItems = [
  { id: 1, label: 'Daily Mood Triage' },
  { id: 2, label: 'Flow Studio' },
  { id: 3, label: 'Mood Garden' },
];

const moodStyles = {
  Happy: { icon: 'sentiment_very_satisfied', className: 'bg-primary-container text-on-primary-container' },
  Angry: { icon: 'sentiment_very_dissatisfied', className: 'bg-secondary-container text-on-secondary-container' },
  Sleepy: { icon: 'bedtime', className: 'bg-tertiary-fixed-dim text-on-tertiary-fixed' },
  Bored: { icon: 'sentiment_neutral', className: 'bg-error-container text-on-error-container' },
};

function getMoodStyle(mood) {
  return moodStyles[mood] || { icon: 'mood', className: 'bg-secondary-container text-on-secondary-container' };
}

export default function Navbar() {
  const { step, setStep, activeSound, toggleSoundscape, selectedMood, resetFlow, authUser, startLogin, logout } = useFlow();
  const displayName = authUser?.name || 'Tamu';
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const moodStyle = getMoodStyle(selectedMood);

  return (
    <>
      <header className="apple-header fixed inset-x-0 top-0 z-50 bg-white/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-3">
          <div className="flex items-center min-w-0 gap-3 xl:gap-6">
            <button type="button" onClick={resetFlow} className="flex items-center gap-2.5 shrink-0 cursor-pointer" title="Kembali ke triage">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center shadow-xs transition-colors ${moodStyle.className}`}><span className="material-symbols-outlined text-[20px] transition-colors">{moodStyle.icon}</span></span>
              <span className="hidden sm:inline font-bold text-lg tracking-tight text-on-surface">Careflow</span>
            </button>
            <nav className="hidden xl:flex items-center rounded-full bg-surface-container-low p-1 border border-surface-container" aria-label="Navigasi utama">
              {navItems.map((item) => <button type="button" key={item.id} onClick={() => setStep(item.id)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${step === item.id ? 'bg-primary-container text-on-primary-container shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}>{item.label}</button>)}
            </nav>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => toggleSoundscape(activeSound || 'rain')} className={`w-9 h-9 inline-flex items-center justify-center rounded-full shadow-[0_2px_0_#121214] transition-colors ${activeSound ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`} title={activeSound ? `Matikan suara ${activeSound}` : 'Putar suara hujan'} aria-label={activeSound ? `Matikan suara ${activeSound}` : 'Putar suara hujan'}>
              <span className="material-symbols-outlined text-[19px]">{activeSound ? 'pause' : 'graphic_eq'}</span>
            </button>
            <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-[0_2px_0_#121214] transition-colors ${moodStyle.className}`}><span className="material-symbols-outlined text-[17px]">{moodStyle.icon}</span><span>{selectedMood}</span></div>
            {authUser ? <button type="button" onClick={logout} title="Keluar dari akun" className="flex items-center gap-2 rounded-full bg-surface-container-lowest p-1 pr-2.5 border border-surface-container shadow-[0_2px_0_#121214]"><span className="w-7 h-7 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">{initials}</span><span className="hidden lg:inline max-w-24 truncate text-xs font-bold text-on-surface">{displayName}</span><span className="material-symbols-outlined text-[16px] text-on-surface-variant">logout</span></button> : <button type="button" onClick={startLogin} className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-on-primary shadow-[0_2px_0_#121214]">Masuk</button>}
          </div>
        </div>
        <nav className="xl:hidden h-11 px-3 pb-2 flex items-center gap-1 overflow-x-auto border-t border-surface-container/70" aria-label="Navigasi halaman">
          {navItems.map((item) => <button type="button" key={item.id} onClick={() => setStep(item.id)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${step === item.id ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container'}`}>{item.label}</button>)}
        </nav>
      </header>
    </>
  );
}
