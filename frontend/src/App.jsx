import { FlowProvider, useFlow } from './context/FlowContext';
import Navbar from './components/Navbar';
import logo from './assets/Logo_careflow.png';
import GentleTriage from './components/pages/GentleTriage';
import FlowStudio from './components/pages/FlowStudio';
import SafeHarbor from './components/pages/SafeHarbor';
import AdminPanel from './components/pages/AdminPanel';
import PsychologistPanel from './components/pages/PsychologistPanel';
import CommunityPage from './components/pages/CommunityPage';
import LoginPage from './components/LoginPage';
import StreakPopup from './components/StreakPopup';
import ConsultationConsentModal from './components/ConsultationConsentModal';
import FloatingChat from './components/FloatingChat';

function Footer({ offsetForSidebar }) {
  return <footer className={`mt-12 w-full border-t border-surface-container bg-surface-container-low py-8 ${offsetForSidebar ? 'lg:pl-[22rem]' : ''}`}><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 lg:flex-row lg:px-12"><div className="flex items-center gap-2.5"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-white p-1 shadow-xs"><img src={logo} alt="Careflow" className="h-full w-full object-contain" /></div><span className="text-base font-bold text-on-surface">Careflow</span></div><span className="text-center text-xs font-medium text-on-surface-variant md:text-right">© 2026 Careflow Space • MindCraft Web Competition 2026</span></div></footer>;
}

function MainContent() {
  const { step, isAuthLoading, authUser, guestAllowed, streakPopup, dismissStreakPopup, consultationModalOpen, setConsultationModalOpen, setConsentChoice } = useFlow();
  if (isAuthLoading) return <main className="flex min-h-screen items-center justify-center bg-background text-sm font-bold text-on-surface-variant">Memuat Careflow...</main>;
  if (!authUser && !guestAllowed) return <LoginPage />;
  const role = authUser?.role;
  const isCommunityDetail = window.location.pathname.startsWith('/community/feed/');
  const workspace = !isCommunityDetail && (role === 'admin' ? <AdminPanel /> : role === 'psychologist' ? <PsychologistPanel /> : null);
  return <>
    <Navbar />
    <main className={`w-full flex-1 bg-background pt-28 xl:pt-20 ${step === 'community' ? 'overflow-visible' : 'overflow-hidden'}`}><div key={workspace ? role : step} className={step === 'community' ? 'w-full' : 'page-stage w-full animate-page-slide-up'}>{workspace || <>{step === 'community' ? <CommunityPage /> : <>{step === 1 && <GentleTriage />}{step === 2 && <FlowStudio />}{step === 3 && <SafeHarbor />}</>}</>}</div></main>
    <Footer offsetForSidebar={step === 'community' && !workspace} />
    <FloatingChat />
    {streakPopup != null && <StreakPopup streakDays={streakPopup} onDone={dismissStreakPopup} />}
    {consultationModalOpen && <ConsultationConsentModal onAccept={() => { setConsentChoice(true); setConsultationModalOpen(false); }} onDecline={() => { setConsentChoice(false); setConsultationModalOpen(false); }} onClose={() => setConsultationModalOpen(false)} />}
  </>;
}
export default function App() { return <FlowProvider><div className="careflow-app flex min-h-screen flex-col bg-background font-body text-on-surface antialiased"><MainContent /></div></FlowProvider>; }
