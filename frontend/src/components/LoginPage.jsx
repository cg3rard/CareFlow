import AuthForm from './AuthForm';
import logo from '../assets/Logo_careflow.png';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-1 shadow-xs">
            <img src={logo} alt="Careflow" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Careflow</h1>
            <p className="text-xs font-medium text-on-surface-variant">A small space to start moving again.</p>
          </div>
        </div>
        <AuthForm />
      </div>
    </main>
  );
}
