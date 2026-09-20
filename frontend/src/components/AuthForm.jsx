import { useState } from 'react';
import { useFlow } from '../context/FlowContext';

const demoAccounts = [
  { role: 'Admin', name: 'Careflow Admin', email: 'admin@careflow.local', password: 'AdminCareflow2026!', icon: 'admin_panel_settings', note: 'Manage users, roles, and account bans.' },
  { role: 'Psychologist', name: 'Dr. Anya Putri', email: 'psychologist@careflow.local', password: 'Psychologist2026!', icon: 'psychology', note: 'View assigned clients and chat.' },
  { role: 'User', name: 'Careflow Demo', email: 'demo@careflow.local', password: 'CareflowDemo2026!', icon: 'person', note: 'Pick a consultant and try a private chat.' },
];

export default function AuthForm({ className = '' }) {
  const { authenticate, continueAsGuest, authError, setAuthError } = useFlow();
  const [mode, setMode] = useState('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', dateOfBirth: '' });

  const submit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setAuthError('');
    try {
      await authenticate(mode, form);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  const switchMode = (nextMode) => {
    setMode(nextMode);
    setAuthError('');
  };
  const loginWithDemo = async ({ name, email, password }) => {
    setForm({ name, email, password });
    setMode('login');
    setIsSubmitting(true);
    setAuthError('');
    try {
      await authenticate('login', { name, email, password });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="sign-in" className={`w-full max-w-md rounded-[2rem] border border-surface-container bg-surface-container-lowest p-6 shadow-[0_16px_40px_rgb(27,27,29,0.1)] sm:p-8 ${className}`}>
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-surface-container p-1">
        <button type="button" onClick={() => switchMode('login')} className={`community-tap rounded-lg py-2 text-xs font-bold ${mode === 'login' ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant'}`}>Sign in</button>
        <button type="button" onClick={() => switchMode('register')} className={`community-tap rounded-lg py-2 text-xs font-bold ${mode === 'register' ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant'}`}>Create account</button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && (
          <>
            <label className="block text-xs font-bold text-on-surface">
              Name
              <input required minLength="2" maxLength="80" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-xl bg-surface-container px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" placeholder="Your nickname" />
            </label>
            <label className="block text-xs font-bold text-on-surface">
              Date of birth
              <input type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} className="mt-1.5 w-full rounded-xl bg-surface-container px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
          </>
        )}
        <label className="block text-xs font-bold text-on-surface">
          Email
          <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-xl bg-surface-container px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" placeholder="name@email.com" />
        </label>
        <label className="block text-xs font-bold text-on-surface">
          Password
          <input required minLength="8" maxLength="128" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-xl bg-surface-container px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" placeholder="At least 8 characters" />
        </label>
        {authError && <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">{authError}</p>}
        <button disabled={isSubmitting} className="community-tap w-full rounded-full bg-primary py-3 text-sm font-bold text-on-primary shadow-[0_10px_24px_rgb(44,107,39,0.28)] disabled:opacity-60">
          {isSubmitting ? 'Processing...' : mode === 'login' ? 'Sign in to Careflow' : 'Create account & begin'}
        </button>
      </form>
      <button type="button" disabled={isSubmitting} onClick={() => setDemoOpen((current) => !current)} className="community-tap mt-3 w-full rounded-full bg-tertiary-container py-3 text-xs font-bold text-on-tertiary-container shadow-xs disabled:opacity-60">
        Try a demo account
      </button>
      {demoOpen && (
        <div className="animate-community-panel mt-3 space-y-2 rounded-2xl bg-surface-container p-3">
          {demoAccounts.map((account) => (
            <button type="button" disabled={isSubmitting} onClick={() => loginWithDemo(account)} key={account.role} className="community-tap flex w-full items-center gap-3 rounded-xl bg-surface-container-lowest p-3 text-left shadow-xs hover:bg-tertiary-container">
              <span className="material-symbols-outlined rounded-full bg-tertiary-container p-2 text-on-tertiary-container">{account.icon}</span>
              <span>
                <span className="block text-xs font-bold text-on-surface">{account.role}</span>
                <span className="block text-[10px] text-on-surface-variant">{account.note}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="my-5 flex items-center gap-3 text-[11px] text-on-surface-variant">
        <span className="h-px flex-1 bg-surface-container-high" />
        or
        <span className="h-px flex-1 bg-surface-container-high" />
      </div>
      <button type="button" onClick={continueAsGuest} className="community-tap w-full rounded-full bg-surface-container py-3 text-xs font-bold text-on-surface hover:bg-surface-container-high">
        Continue as guest
      </button>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-on-surface-variant">
        Your account saves session summaries and streaks on the Careflow server. Guest mode stays available and keeps your data on this device.
      </p>
    </section>
  );
}
