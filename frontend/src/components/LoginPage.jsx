import { useState } from 'react';
import { useFlow } from '../context/FlowContext';
import logo from '../assets/Logo_careflow.png';

export default function LoginPage() {
  const { authenticate, continueAsGuest, authError, setAuthError } = useFlow();
  const [mode, setMode] = useState('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const loginWithDemo = async () => {
    const demoForm = { name: 'Careflow Demo', email: 'demo@careflow.local', password: 'CareflowDemo2026!' };
    setForm(demoForm);
    setMode('login');
    setIsSubmitting(true);
    setAuthError('');
    try {
      await authenticate('login', demoForm);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12 flex items-center justify-center">
      <section className="w-full max-w-md rounded-[2rem] bg-surface-container-lowest border border-surface-container p-6 sm:p-8 shadow-[0_6px_0_#121214]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-xs p-1">
            <img src={logo} alt="Careflow" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Careflow</h1>
            <p className="text-xs text-on-surface-variant font-medium">Ruang kecil untuk mulai bergerak lagi.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 p-1 rounded-xl bg-surface-container mb-6">
          <button type="button" onClick={() => switchMode('login')} className={`rounded-lg py-2 text-xs font-bold transition-colors ${mode === 'login' ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant'}`}>Masuk</button>
          <button type="button" onClick={() => switchMode('register')} className={`rounded-lg py-2 text-xs font-bold transition-colors ${mode === 'register' ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant'}`}>Buat akun</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <label className="block text-xs font-bold text-on-surface">Nama
              <input required minLength="2" maxLength="80" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-xl bg-surface-container px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" placeholder="Nama panggilanmu" />
            </label>
          )}
          {mode === 'register' && (
            <label className="block text-xs font-bold text-on-surface">Tanggal lahir
              <input type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} className="mt-1.5 w-full rounded-xl bg-surface-container px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
          )}
          <label className="block text-xs font-bold text-on-surface">Email
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-xl bg-surface-container px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" placeholder="nama@email.com" />
          </label>
          <label className="block text-xs font-bold text-on-surface">Kata sandi
            <input required minLength="8" maxLength="128" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-xl bg-surface-container px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" placeholder="Minimal 8 karakter" />
          </label>
          {authError && <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">{authError}</p>}
          <button disabled={isSubmitting} className="w-full rounded-full bg-primary py-3 text-sm font-bold text-on-primary shadow-[0_3px_0_#121214] disabled:opacity-60 active:translate-y-0.5 active:shadow-none">
            {isSubmitting ? 'Memproses...' : mode === 'login' ? 'Masuk ke Careflow' : 'Buat akun & mulai'}
          </button>
        </form>
        <button type="button" disabled={isSubmitting} onClick={loginWithDemo} className="w-full rounded-full bg-tertiary-container py-3 text-xs font-bold text-on-tertiary-container shadow-xs hover:bg-tertiary-fixed disabled:opacity-60">Coba akun demo</button>
        <p className="mt-2 text-center text-[10px] text-on-surface-variant">demo@careflow.local · CareflowDemo2026!</p>
        <div className="my-5 flex items-center gap-3 text-[11px] text-on-surface-variant"><span className="h-px flex-1 bg-surface-container-high" />atau<span className="h-px flex-1 bg-surface-container-high" /></div>
        <button type="button" onClick={continueAsGuest} className="w-full rounded-full bg-surface-container py-3 text-xs font-bold text-on-surface hover:bg-surface-container-high">Lanjut sebagai tamu</button>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-on-surface-variant">Akun menyimpan ringkasan sesi dan streak di server Careflow. Mode tamu tetap tersedia dan menyimpan data di perangkat ini.</p>
      </section>
    </main>
  );
}
