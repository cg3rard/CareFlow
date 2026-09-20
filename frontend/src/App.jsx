import { FlowProvider, useFlow } from './context/FlowContext';
import Navbar from './components/Navbar';
import logo from './assets/Logo_careflow.png';
import GentleTriage from './components/pages/GentleTriage';
import FlowStudio from './components/pages/FlowStudio';
import SafeHarbor from './components/pages/SafeHarbor';
import LoginPage from './components/LoginPage';
import StreakPopup from './components/StreakPopup';

function MainContent() {
  const { step, isAuthLoading, authUser, guestAllowed, streakPopup, dismissStreakPopup } = useFlow();

  if (isAuthLoading) {
    return <main className="min-h-screen bg-background flex items-center justify-center text-sm font-bold text-on-surface-variant">Memuat Careflow...</main>;
  }
  if (!authUser && !guestAllowed) return <LoginPage />;

  return (
    <>
      <Navbar />
      <main className="w-full pt-28 xl:pt-20 bg-background flex-1 overflow-hidden">
        <div key={step} className="page-stage animate-page-slide-up w-full">
          {step === 1 && <GentleTriage />}
          {step === 2 && <FlowStudio />}
          {step === 3 && <SafeHarbor />}
        </div>
      </main>
      <footer className="w-full bg-surface-container-low mt-12 py-8 border-t border-surface-container">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5"><div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-xs p-1"><img src={logo} alt="Careflow" className="w-full h-full object-contain" /></div><span className="font-bold text-base text-on-surface">Careflow</span></div>
          <span className="text-xs text-on-surface-variant text-center md:text-right font-medium">© 2026 Careflow Space • MindCraft Web Competition 2026</span>
        </div>
      </footer>
      {streakPopup != null && <StreakPopup streakDays={streakPopup} onDone={dismissStreakPopup} />}
    </>
  );
}

export default function App() {
  return <FlowProvider><div className="careflow-app bg-background font-body text-on-surface antialiased min-h-screen flex flex-col"><MainContent /></div></FlowProvider>;
}
