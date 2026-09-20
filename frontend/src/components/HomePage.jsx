import logo from '../assets/Logo_careflow.png';
import AuthForm from './AuthForm';

const aboutCards = [
  {
    icon: 'mood',
    title: 'Daily Mood Triage',
    description: 'Check in with a quick, playful quiz that reads your sleep and stress patterns every day.',
  },
  {
    icon: 'bolt',
    title: 'Flow Studio',
    description: 'Turn overwhelming thoughts into small, doable missions with guided breathing and focus tools.',
  },
  {
    icon: 'park',
    title: 'Mood Garden',
    description: 'Watch your streaks and wellbeing trends grow over time in a calm, visual weekly summary.',
  },
  {
    icon: 'diversity_3',
    title: 'Circle Community',
    description: 'Share your story anonymously or openly, and support others in a safe, moderated space.',
  },
  {
    icon: 'psychology',
    title: 'Psychologist Support',
    description: 'Connect with a real psychologist, share your data with consent, and chat privately.',
  },
];

const homeNavItems = [
  { href: '#about', label: 'About Us' },
  { href: '#vision', label: 'Vision' },
  { href: '#mission', label: 'Mission' },
];

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function HomeNavbar() {
  return (
    <header className="apple-header fixed inset-x-0 top-0 z-50 bg-white/95 shadow-[0_1px_8px_rgba(0,0,0,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-12">
        <button type="button" onClick={() => scrollToId('home-top')} className="community-tap flex shrink-0 items-center gap-2.5">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white p-1 shadow-xs">
            <img src={logo} alt="Careflow" className="h-full w-full object-contain" />
          </span>
          <span className="hidden text-lg font-bold tracking-tight text-on-surface sm:inline">Careflow</span>
        </button>
        <nav className="hidden items-center rounded-full border border-surface-container bg-surface-container-low p-1 md:flex" aria-label="Home navigation">
          {homeNavItems.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => scrollToId(item.href.slice(1))}
              className="community-tap rounded-full px-4 py-1.5 text-xs font-bold text-on-surface-variant hover:text-on-surface"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => scrollToId('sign-in')}
          className="community-tap rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary shadow-[0_8px_20px_rgb(44,107,39,0.28)]"
        >
          Sign in
        </button>
      </div>
      <nav className="flex h-11 items-center gap-1 overflow-x-auto border-t border-surface-container/70 px-3 pb-2 md:hidden" aria-label="Home navigation mobile">
        {homeNavItems.map((item) => (
          <button
            key={item.href}
            type="button"
            onClick={() => scrollToId(item.href.slice(1))}
            className="whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold text-on-surface-variant"
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-background">
      <HomeNavbar />
      <main className="w-full pt-28 md:pt-24">
        <section id="home-top" className="mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 py-10 sm:px-6 lg:flex-row lg:px-12 lg:py-16">
          <div className="w-full max-w-xl text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-container px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-on-primary-container">
              Your gentle space to reset
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-on-surface sm:text-5xl">
              Small steps, calmer mind, every day with Careflow
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-on-surface-variant sm:text-base">
              Careflow helps you untangle overwhelming thoughts into tiny, doable
              missions, track your mood and stress, and connect with a
              supportive community and real psychologists when you need them.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <button
                type="button"
                onClick={() => scrollToId('sign-in')}
                className="community-tap rounded-full bg-primary px-6 py-3 text-sm font-bold text-on-primary shadow-[0_10px_24px_rgb(44,107,39,0.28)]"
              >
                Get started
              </button>
              <button
                type="button"
                onClick={() => scrollToId('about')}
                className="community-tap rounded-full bg-surface-container px-6 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-high"
              >
                Learn more
              </button>
            </div>
          </div>
          <div className="w-full max-w-md">
            <img src={logo} alt="Careflow" className="mx-auto w-full max-w-xs object-contain" />
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">About Us</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
              Everything you need to feel a little lighter
            </h2>
            <p className="mt-3 text-sm text-on-surface-variant sm:text-base">
              Five simple spaces designed to work together, so support is
              always within reach.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {aboutCards.map((card, index) => (
              <div
                key={card.title}
                style={{ animationDelay: `${index * 70}ms` }}
                className="animate-community-card community-card-surface rounded-[2rem] border border-surface-container bg-surface-container-lowest p-6 shadow-[0_8px_24px_rgb(27,27,29,0.06)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
                  <span className="material-symbols-outlined text-2xl">{card.icon}</span>
                </div>
                <h3 className="mt-4 text-base font-bold text-on-surface">{card.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="vision" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-12">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] bg-primary-container p-8 text-on-primary-container shadow-[0_8px_24px_rgb(27,27,29,0.06)] sm:p-10">
              <span className="text-xs font-bold uppercase tracking-widest">Our Vision</span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                A world where asking for support feels as easy as breathing.
              </h2>
              <p className="mt-4 text-sm leading-relaxed opacity-90">
                We imagine a future where mental wellbeing check-ins are a
                normal part of everyone's day, free of stigma, and where
                reaching out for help is always within one small step's reach.
              </p>
            </div>
            <div id="mission" className="rounded-[2rem] bg-tertiary-container p-8 text-on-tertiary-container shadow-[0_8px_24px_rgb(27,27,29,0.06)] sm:p-10">
              <span className="text-xs font-bold uppercase tracking-widest">Our Mission</span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Turning overwhelm into small, doable, supported steps.
              </h2>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed opacity-90">
                <li>• Make daily mood and stress check-ins quick, honest, and judgment-free.</li>
                <li>• Slice big, scary tasks into calm, five-minute missions.</li>
                <li>• Build a safe community where support goes both ways.</li>
                <li>• Connect people with real psychologists, with full consent and privacy.</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="sign-in-section" className="mx-auto flex max-w-7xl flex-col items-center px-4 py-14 sm:px-6 lg:px-12">
          <div className="mb-8 max-w-lg text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Join Careflow</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-on-surface">
              Ready to start your gentle reset?
            </h2>
            <p className="mt-3 text-sm text-on-surface-variant">
              Sign in, create an account, or continue as a guest below.
            </p>
          </div>
          <AuthForm />
        </section>
      </main>
      <footer className="w-full border-t border-surface-container bg-surface-container-low py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 lg:flex-row lg:px-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white p-1 shadow-xs">
              <img src={logo} alt="Careflow" className="h-full w-full object-contain" />
            </div>
            <span className="text-base font-bold text-on-surface">Careflow</span>
          </div>
          <span className="text-center text-xs font-medium text-on-surface-variant md:text-right">
            © 2026 Careflow Space • MindCraft Web Competition 2026
          </span>
        </div>
      </footer>
    </div>
  );
}
