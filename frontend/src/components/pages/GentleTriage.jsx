import { useEffect, useState } from 'react';
import { useFlow } from '../../context/FlowContext';
import { audioEngine } from '../../utils/audioEngine';
import { getDailyQuizQuestions, estimateStressFromAnswers, stressLevelLabel } from '../../utils/dailyQuiz';

function pickRandomQuote(quotes) {
  if (!quotes || quotes.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
}

export default function GentleTriage() {
  const {
    selectedMood,
    setSelectedMood,
    selectedMascot,
    setSelectedMascot,
    streakDays,
    authUser,
    saveCurrentSession,
    vaultSavedNotice,
    hasSavedToday,
    quizLoggedToday,
    todayMetric,
    weeklyMetrics,
    logSleepHours,
    logQuizStress,
    triageData,
    setTriageData,
    processTriage,
    isProcessingSlice,
    toggleSoundscape,
    setStep,
  } = useFlow();

  const [bellRung, setBellRung] = useState(false);
  const [bellActive, setBellActive] = useState(false);
  const [activeQuote, setActiveQuote] = useState(null);

  // Multi-step Interactive Quick Quiz — 4 questions rotate daily so the check-in
  // stays fresh instead of repeating the same 4 questions every day.
  const [quizQuestions] = useState(() => getDailyQuizQuestions());
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizConfirmationMessage, setQuizConfirmationMessage] = useState('');
  const [isQuizAnswerConfirming, setIsQuizAnswerConfirming] = useState(false);
  const [isQuizCompleteModalOpen, setIsQuizCompleteModalOpen] = useState(false);
  const [sleepHours, setSleepHours] = useState(null);
  const [sleepHoursDraft, setSleepHoursDraft] = useState('7');
  const [sleepLogged, setSleepLogged] = useState(false);
  const [metricLogError, setMetricLogError] = useState('');
  const [isBrainDumpDraftReady, setIsBrainDumpDraftReady] = useState(false);
  const [brainDumpDraftSavedAt, setBrainDumpDraftSavedAt] = useState(null);
  const brainDumpDraftKey = `careflow_brain_dump_draft_${authUser?.id || 'guest'}`;

  // Keep unfinished thoughts on this device only. The server receives a
  // final, immutable note only when the user explicitly chooses to unravel it.
  useEffect(() => {
    setIsBrainDumpDraftReady(false);
    try {
      const rawDraft = localStorage.getItem(brainDumpDraftKey);
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        if (typeof draft?.content === 'string' && draft.content.trim()) {
          setTriageData((previous) => ({
            ...previous,
            content: draft.content,
            tag: typeof draft.tag === 'string' ? draft.tag : previous.tag,
            panicLevel: Number.isInteger(draft.panicLevel) ? draft.panicLevel : previous.panicLevel,
          }));
        }
      }
    } catch {
      localStorage.removeItem(brainDumpDraftKey);
    } finally {
      setIsBrainDumpDraftReady(true);
    }
  }, [brainDumpDraftKey, setTriageData]);

  useEffect(() => {
    if (!isBrainDumpDraftReady) return undefined;
    const timeout = window.setTimeout(() => {
      try {
        if (triageData.content.trim()) {
          localStorage.setItem(brainDumpDraftKey, JSON.stringify({
            content: triageData.content,
            tag: triageData.tag,
            panicLevel: triageData.panicLevel,
          }));
          setBrainDumpDraftSavedAt(new Date());
        }
      } catch {
        // Draft persistence is optional; typing must remain uninterrupted.
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [brainDumpDraftKey, isBrainDumpDraftReady, triageData]);

  // The quiz (sleep check-in + Yes/No questions) is limited to one
  // completion per calendar day. Hydrate local state from the server so a
  // page refresh resumes from the right step instead of losing progress:
  // - If today's sleep hours are already on the server, skip the sleep
  //   check-in step and jump straight to the Yes/No questions.
  // - Only fully lock the quiz once the stress score is also recorded.
  useEffect(() => {
    if (todayMetric?.sleepHours != null) {
      setSleepHours(todayMetric.sleepHours);
      setSleepLogged(true);
    }
    if (quizLoggedToday) {
      setIsQuizCompleteModalOpen(false);
    }
  }, [quizLoggedToday, todayMetric]);

  const handleLogSleepHours = () => {
    if (quizLoggedToday || isQuizAnswerConfirming) return;
    const parsed = Number.parseFloat(sleepHoursDraft);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 12) return;

    setQuizConfirmationMessage('Durasi tidur tersimpan');
    setIsQuizAnswerConfirming(true);
    setMetricLogError('');

    window.setTimeout(async () => {
      setSleepHours(parsed);
      setSleepLogged(true);
      setIsQuizAnswerConfirming(false);
      try {
        await logSleepHours(parsed);
      } catch (error) {
        setMetricLogError(error.message || 'Durasi tidur gagal tersimpan ke server.');
      }
    }, 800);
  };

  const handleQuizAnswer = (ans) => {
    if (isQuizAnswerConfirming || quizCompleted || quizLoggedToday) return;

    audioEngine.playSuccessEffect();
    const isLastQuestion = quizIndex === quizQuestions.length - 1;
    if (isLastQuestion) {
      setQuizAnswers((currentAnswers) => {
        const finalAnswers = [...currentAnswers, ans];
        const finalScore = estimateStressFromAnswers(finalAnswers, quizQuestions);
        logQuizStress(finalScore, stressLevelLabel(finalScore)?.label).catch((error) => {
          setMetricLogError(error.message || 'Indikator stres gagal tersimpan ke server.');
        });
        return finalAnswers;
      });
      setIsQuizCompleteModalOpen(true);
      return;
    }

    setQuizConfirmationMessage('Jawaban tercatat');
    setIsQuizAnswerConfirming(true);

    window.setTimeout(() => {
      setQuizAnswers((currentAnswers) => [...currentAnswers, ans]);
      setQuizIndex((currentIndex) => currentIndex + 1);
      setIsQuizAnswerConfirming(false);
    }, 800);
  };

  const resetQuiz = () => {
    if (quizLoggedToday) return;
    setQuizIndex(0);
    setQuizAnswers([]);
    setQuizConfirmationMessage('');
    setIsQuizAnswerConfirming(false);
    setIsQuizCompleteModalOpen(false);
    setSleepHours(null);
    setSleepLogged(false);
    setSleepHoursDraft('7');
  };

  const resetYesNoQuiz = () => {
    if (quizLoggedToday) return;
    setQuizIndex(0);
    setQuizAnswers([]);
    setQuizConfirmationMessage('');
    setIsQuizAnswerConfirming(false);
    setIsQuizCompleteModalOpen(false);
  };

  const handleGoToFlowStudio = () => {
    setIsQuizCompleteModalOpen(false);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const quizCompleted = quizAnswers.length === quizQuestions.length || quizLoggedToday;
  const lastQuizAnswer = quizAnswers[quizAnswers.length - 1];

  // Weekly Mood Triage Matrix shows the average sleep duration across the
  // last 7 days rather than a single day's value. Today's freshly-logged
  // value (if not yet reflected in weeklyMetrics) is merged in so the
  // average updates immediately after logging.
  const weeklySleepSamples = (() => {
    const byDate = new Map(weeklyMetrics.filter((m) => m.sleepHours != null).map((m) => [m.metricDate, m.sleepHours]));
    if (sleepHours != null && todayMetric) byDate.set(todayMetric.metricDate, sleepHours);
    return Array.from(byDate.values());
  })();
  const weeklyAverageSleepHours = weeklySleepSamples.length > 0
    ? Math.round((weeklySleepSamples.reduce((sum, value) => sum + value, 0) / weeklySleepSamples.length) * 10) / 10
    : null;
  const displaySleepHours = weeklyAverageSleepHours ?? (sleepHours ?? todayMetric?.sleepHours ?? null);
  const displayStressScore = quizAnswers.length === quizQuestions.length
    ? estimateStressFromAnswers(quizAnswers, quizQuestions)
    : todayMetric?.stressScore ?? null;
  const stressScore = displayStressScore;
  const stressInfo = stressLevelLabel(stressScore);

  const handleSaveVibe = async () => {
    await saveCurrentSession({
      sleepHours: sleepLogged ? sleepHours : null,
      stressScore: quizAnswers.length === quizQuestions.length ? stressScore : null,
      stressLabel: quizCompleted ? stressInfo?.label : undefined,
    });
  };

  const handleZenBell = () => {
    setBellActive((prev) => !prev);
    setBellRung(true);
    audioEngine.playBellChime();
    setTimeout(() => setBellRung(false), 2000);
  };

  const handleTagClick = (tag) => {
    setTriageData((prev) => ({
      ...prev,
      tag: tag,
      content: prev.content ? `${prev.content} [${tag}]` : `Fokus pada ${tag}: `,
    }));
  };

  const handleMascotSelect = (mascot) => {
    setSelectedMascot(mascot.id);
    setActiveQuote(pickRandomQuote(mascot.quotes));
  };

  const mascots = [
    {
      id: 'Gentle',
      name: 'Gentle',
      bg: 'bg-primary-container',
      text: 'text-on-primary-container',
      quotes: [
        'Tarik napas perlahan. Hari ini kita selesaikan satu per satu 🌿',
        'Nggak apa-apa jalan pelan-pelan, yang penting tetap melangkah 🍃',
        'Beri dirimu ruang untuk lembut ke diri sendiri hari ini 🌸',
      ],
      renderSvg: () => (
        <svg className="w-14 h-14 text-on-primary-container" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6" viewBox="0 0 100 100">
          <path d="M 28 48 Q 38 56 48 48"></path>
          <path d="M 52 48 Q 62 56 72 48"></path>
          <path d="M 38 68 Q 50 78 62 68"></path>
        </svg>
      ),
    },
    {
      id: 'Spun Out',
      name: 'Spun Out',
      bg: 'bg-tertiary-fixed',
      text: 'text-on-tertiary-fixed',
      quotes: [
        'Pikiran kusut berputar? Tenang, mari kita rapikan benang kusutnya 🌀',
        'Terlalu banyak yang muter di kepala? Yuk kita pilah satu-satu 🧵',
        'Wajar kok kalau pikiran terasa berantakan, kita uraikan bareng-bareng ✨',
      ],
      renderSvg: () => (
        <svg className="w-14 h-14 text-on-tertiary-fixed" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6" viewBox="0 0 100 100">
          <circle cx="36" cy="42" fill="currentColor" r="6"></circle>
          <circle cx="64" cy="42" r="10"></circle>
          <circle cx="64" cy="42" fill="currentColor" r="3"></circle>
          <path d="M 44 68 Q 50 60 56 68 Q 50 76 44 68 Z" fill="currentColor"></path>
        </svg>
      ),
    },
    {
      id: 'Fuming',
      name: 'Fuming',
      bg: 'bg-secondary-container',
      text: 'text-on-secondary-container',
      quotes: [
        'Merasa kesal atau frustrasi? Wajar banget, salurkan ke tindakan mikro 🔥',
        'Emosi yang menggebu itu valid. Yuk kita ubah jadi energi yang berguna 💥',
        'Boleh kok marah, yang penting kita cari cara sehat buat melepaskannya 🌋',
      ],
      renderSvg: () => (
        <svg className="w-14 h-14 text-on-secondary-container" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6" viewBox="0 0 100 100">
          <line x1="28" x2="44" y1="38" y2="46"></line>
          <line x1="72" x2="56" y1="38" y2="46"></line>
          <circle cx="38" cy="52" fill="currentColor" r="4"></circle>
          <circle cx="62" cy="52" fill="currentColor" r="4"></circle>
          <path d="M 36 74 Q 50 64 64 74"></path>
        </svg>
      ),
    },
    {
      id: 'Zapped',
      name: 'Zapped',
      bg: 'bg-secondary-fixed',
      text: 'text-secondary',
      quotes: [
        'Energi dan dopamin lagi tinggi! Ayo manfaatkan untuk 1 langkah awal ⚡',
        'Kamu lagi bertenaga nih, pas banget buat gaskeun satu misi kecil 🚀',
        'Semangat lagi berapi-api, yuk salurkan ke hal produktif sekarang 🔋',
      ],
      renderSvg: () => (
        <svg className="w-14 h-14 text-secondary" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6" viewBox="0 0 100 100">
          <path d="M 30 46 Q 38 38 46 46"></path>
          <path d="M 54 46 Q 62 38 70 46"></path>
          <path d="M 36 62 Q 50 78 64 62"></path>
          <path d="M 42 66 Q 50 74 58 66" strokeWidth="3"></path>
        </svg>
      ),
    },
    {
      id: 'Drowsy',
      name: 'Drowsy',
      bg: 'bg-tertiary-fixed-dim',
      text: 'text-on-tertiary-fixed-variant',
      quotes: [
        'Lelah fisik butuh rehat tanpa rasa bersalah. Istirahat sejenak ya 🌙',
        'Kalau ngantuk berat, nggak apa-apa pause dulu sebentar 😴',
        'Tubuh capek itu sinyal buat istirahat, dengarkan dirimu ya 🛋️',
      ],
      renderSvg: () => (
        <svg className="w-14 h-14 text-on-tertiary-fixed-variant" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6" viewBox="0 0 100 100">
          <line x1="32" x2="44" y1="46" y2="46"></line>
          <line x1="56" x2="68" y1="46" y2="46"></line>
          <circle cx="50" cy="68" r="6" strokeWidth="5"></circle>
        </svg>
      ),
    },
  ];

  const quickTags = [
    'Tugas Menumpuk 📚',
    'Takut Gagal ⚡',
    'Skripsi Buntu 😵‍💫',
    'Butuh Rehat ☕',
    'Overthinking Malam 🌙',
  ];

  const activeMascotObj = mascots.find((m) => m.id === selectedMascot) || mascots[0];
  const isGuest = !authUser;
  const brainDumpShareActive = Boolean(authUser?.role === 'user' && authUser?.psychologistId && authUser?.shareDataWithPsychologist);
  const brainDumpPrivacyCopy = brainDumpShareActive
    ? `Saat diurai, catatan final tersimpan dan dibagikan ke ${authUser.psychologistName || 'konsultanmu'}.`
    : authUser?.psychologistId
      ? 'Saat diurai, catatan final tersimpan pribadi. Data sharing belum aktif.'
      : authUser
        ? 'Saat diurai, catatan final tersimpan pribadi. Hubungkan konsultan untuk membagikannya.'
        : 'Draft tersimpan di perangkat ini. Masuk untuk menyimpan catatan final ke akunmu.';

  const handleBrainDumpSubmit = async () => {
    const savedEntry = await processTriage();
    if (savedEntry) {
      localStorage.removeItem(brainDumpDraftKey);
      setTriageData((previous) => ({ ...previous, content: '' }));
      setBrainDumpDraftSavedAt(null);
    }
  };

  // Cognitive Overwhelm Meter calculation

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Interactive Top Atmosphere & Greeting Bar */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-container-lowest p-4 sm:p-6 rounded-[2.5rem] shadow-sm border border-surface-container/60 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-full overflow-hidden bg-secondary-container flex items-center justify-center shrink-0 shadow-xs">
              <div className="w-full h-full bg-gradient-to-tr from-amber-200 to-orange-300 flex items-center justify-center text-xl font-bold text-amber-900">
                {(authUser?.name || 'Teman').trim().charAt(0).toUpperCase()}
              </div>            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Welcome back</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary"></span>
                <span className="text-xs text-on-surface-variant font-medium">Hari ini • Sesi Mandiri</span>
              </div>
              <span className="text-xl font-bold text-on-surface tracking-tight">{authUser?.name || 'Teman'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-surface-container px-4 py-1.5 rounded-full shadow-[0_2px_0_#121214]">
              <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
              <span className="text-xs font-bold text-on-surface">Streak: {streakDays} Days</span>
            </div>
            <button
              onClick={handleZenBell}
              className={`w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high active:scale-90 transition-all text-on-surface cursor-pointer shadow-[0_2px_0_#121214] ${
                bellActive ? 'ring-2 ring-emerald-500 scale-110' : ''
              } ${bellRung ? 'animate-zen-bell-pulse' : ''}`}
              title="Zen Chime: Bunyikan Lonceng Ketenangan"
              aria-pressed={bellActive}
            >
              <span
                className={`material-symbols-outlined text-[20px] ${bellActive ? 'text-emerald-500' : ''} ${bellRung ? 'animate-zen-bell-ring' : ''}`}
                style={bellActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                notifications
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Hero Row: Asymmetric Playful Triage Stage */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Hero Banner: 'Not Sure About Your Mood?' */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-[3rem] p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden shadow-sm border border-surface-container">
            {/* Decorative Ambient Backdrops */}
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-tertiary-fixed opacity-40 blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-primary-fixed opacity-50 blur-3xl pointer-events-none"></div>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-surface-container px-4 py-1.5 rounded-full mb-4 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Active Emotional Playground
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-on-surface max-w-xl leading-tight">
                Not Sure About <br />Your Mood?
              </h1>
              <p className="text-base sm:text-lg text-on-surface-variant mt-3 max-w-md leading-relaxed font-medium">
                Unravel tangled feelings with cute micro-expressions, rapid somatic quiz pulses, and unfiltered thought unjamming.
              </p>
              <div className="mt-8 flex items-center gap-4 flex-wrap">
                <a
                  href="#triage-bento"
                  className="inline-flex items-center gap-3 bg-inverse-surface text-inverse-on-surface px-6 py-3 rounded-full text-sm font-bold shadow-[0_4px_0_#121214] hover:opacity-90 active:translate-y-1 active:shadow-none transition-all"
                >
                  <span>Let Us Help!</span>
                  <span className="w-7 h-7 rounded-full bg-surface-container-lowest text-inverse-surface flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </span>
                </a>
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-full shadow-[0_2px_0_#121214]">
                  <span className="material-symbols-outlined text-secondary text-[20px]">bolt</span>
                  <span className="text-xs font-bold text-secondary">Takes ~45 seconds</span>
                </div>
              </div>
            </div>

            {/* Playful Interactive Speech Bubble for Active Mascot */}
            <div className="relative z-10 mt-6 p-3 rounded-2xl bg-surface-container border border-surface-container-high flex items-center gap-3 animate-fadeIn">
              <span className="text-lg">💬</span>
              <p className="text-xs sm:text-sm font-bold text-on-surface italic">
                "{activeQuote || activeMascotObj.quotes?.[0]}"
              </p>
            </div>

            {/* Playful Blob Cluster Visualizer (5 Mascot Doodles) */}
            <div className="relative z-10 mt-4 pt-2">
              <div className="flex flex-wrap items-end justify-center lg:justify-start gap-4 sm:gap-6">
                {mascots.map((m) => {
                  const isSelected = selectedMascot === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleMascotSelect(m)}
                      className="group cursor-pointer flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-2 active:scale-95 select-none"
                    >
                      <div
                        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] ${m.bg} flex items-center justify-center relative transition-all ${
                          isSelected
                            ? 'ring-4 ring-[#121214] scale-110 shadow-[0_4px_0_#121214]'
                            : 'shadow-sm hover:shadow-md'
                        }`}
                      >
                        {m.renderSvg()}
                      </div>
                      <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {m.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Daily Mood Picker Card */}
          <div className="lg:col-span-5 bg-surface-container-lowest rounded-[3rem] p-6 sm:p-10 flex flex-col justify-between shadow-sm border border-surface-container">
            <div>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">Daily Pulse</span>
                <span className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight mt-1">
                Hello {authUser?.name || 'Teman'}!<br />How are you feeling today?
              </h2>
              <p className="text-sm text-on-surface-variant mt-2 font-medium">
                Tap a frequency to tune your day's personal Careflow rhythm.
              </p>

              {/* 4 Interactive Face Chips Selector with tactile feedback */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                {/* Happy */}
                <button
                  type="button"
                  onClick={() => setSelectedMood('Happy')}
                  disabled={hasSavedToday}
                  className={`p-3 rounded-[1.75rem] flex flex-col items-center justify-center gap-2 transition-all tactile-btn ${
                    hasSavedToday ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${
                    selectedMood === 'Happy'
                      ? 'bg-primary-container text-on-primary-container ring-3 ring-primary shadow-[0_4px_0_#121214] scale-105'
                      : 'bg-surface-container text-on-surface hover:bg-primary-container/60 shadow-[0_2px_0_#121214]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-xs">
                    <svg className="w-8 h-8 text-on-primary-container" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3.5" viewBox="0 0 48 48">
                      <path d="M 14 20 Q 18 16 22 20"></path>
                      <path d="M 26 20 Q 30 16 34 20"></path>
                      <path d="M 16 28 Q 24 36 32 28"></path>
                    </svg>
                  </div>
                  <span className="text-xs font-bold">Happy</span>
                </button>

                {/* Angry */}
                <button
                  type="button"
                  onClick={() => setSelectedMood('Angry')}
                  disabled={hasSavedToday}
                  className={`p-3 rounded-[1.75rem] flex flex-col items-center justify-center gap-2 transition-all tactile-btn ${
                    hasSavedToday ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${
                    selectedMood === 'Angry'
                      ? 'bg-secondary-container text-on-secondary-container ring-3 ring-secondary shadow-[0_4px_0_#121214] scale-105'
                      : 'bg-surface-container text-on-surface hover:bg-secondary-container/60 shadow-[0_2px_0_#121214]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-xs">
                    <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3.5" viewBox="0 0 48 48">
                      <line x1="14" x2="21" y1="18" y2="21"></line>
                      <line x1="34" x2="27" y1="18" y2="21"></line>
                      <path d="M 17 32 Q 24 26 31 32"></path>
                    </svg>
                  </div>
                  <span className="text-xs font-bold">Angry</span>
                </button>

                {/* Sleepy */}
                <button
                  type="button"
                  onClick={() => setSelectedMood('Sleepy')}
                  disabled={hasSavedToday}
                  className={`p-3 rounded-[1.75rem] flex flex-col items-center justify-center gap-2 transition-all tactile-btn ${
                    hasSavedToday ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${
                    selectedMood === 'Sleepy'
                      ? 'bg-tertiary-fixed-dim text-on-tertiary-fixed ring-3 ring-tertiary shadow-[0_4px_0_#121214] scale-105'
                      : 'bg-surface-container text-on-surface hover:bg-tertiary-fixed-dim/60 shadow-[0_2px_0_#121214]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-xs">
                    <svg className="w-8 h-8 text-tertiary" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3.5" viewBox="0 0 48 48">
                      <line x1="14" x2="21" y1="22" y2="22"></line>
                      <line x1="27" x2="34" y1="22" y2="22"></line>
                      <circle cx="24" cy="30" r="3" strokeWidth="3"></circle>
                    </svg>
                  </div>
                  <span className="text-xs font-bold">Sleepy</span>
                </button>

                {/* Bored */}
                <button
                  type="button"
                  onClick={() => setSelectedMood('Bored')}
                  disabled={hasSavedToday}
                  className={`p-3 rounded-[1.75rem] flex flex-col items-center justify-center gap-2 transition-all tactile-btn ${
                    hasSavedToday ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${
                    selectedMood === 'Bored'
                      ? 'bg-error-container text-on-error-container ring-3 ring-error shadow-[0_4px_0_#121214] scale-105'
                      : 'bg-surface-container text-on-surface hover:bg-error-container/60 shadow-[0_2px_0_#121214]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-xs">
                    <svg className="w-8 h-8 text-on-surface" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3.5" viewBox="0 0 48 48">
                      <circle cx="17" cy="22" fill="currentColor" r="2"></circle>
                      <circle cx="31" cy="22" fill="currentColor" r="2"></circle>
                      <line x1="16" x2="32" y1="31" y2="31"></line>
                    </svg>
                  </div>
                  <span className="text-xs font-bold">Bored</span>
                </button>
              </div>
            </div>

            {/* Dynamic Feedback Prompt */}
            <div className="mt-8 p-4 rounded-[2rem] bg-surface-container flex items-center justify-between gap-4 shadow-[0_3px_0_#121214]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold block">
                    Selected State
                  </span>
                  <span className="text-sm font-bold text-on-surface">
                    Feeling: {selectedMood}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveVibe}
                disabled={hasSavedToday}
                title={hasSavedToday ? 'Daily Pulse hari ini sudah tersimpan. Coba lagi besok.' : undefined}
                className={`px-5 py-2.5 rounded-full text-xs font-bold shadow-[0_2px_0_#121214] transition-all ${
                  hasSavedToday
                    ? 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-70'
                    : 'bg-inverse-surface text-inverse-on-surface hover:opacity-90 active:translate-y-0.5 active:shadow-none cursor-pointer'
                }`}
              >
                {hasSavedToday ? 'Sudah Diisi Hari Ini ✅' : vaultSavedNotice ? 'Tersimpan! ✨' : 'Simpan Sesi'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid: Interactive Check-in & Brain-Dump */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-6" id="triage-bento">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-2">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest mb-1">
              <span className="material-symbols-outlined text-[16px]">dashboard_customize</span>
              <span>Bento Bio-Signals</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              Weekly Mood Triage Matrix
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Dual Metric Tiles + Multi-step Quiz (Col span 7) */}
          <div className="md:col-span-7 flex flex-col gap-6">
            {/* Dual Tiles Row (Sleep & Stress) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Sleep Duration Bento Tile with Hover Dancing Wave */}
              <div className="bg-secondary-container text-on-secondary-container rounded-[2.5rem] p-6 flex flex-col justify-between min-h-[220px] shadow-[0_4px_0_#121214] relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">bedtime</span>
                    <span className="text-xs uppercase tracking-wider font-bold">Sleep Duration</span>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-surface-container-lowest/80 text-on-surface font-bold shadow-xs">
                    {weeklySleepSamples.length > 0 ? `Rata-rata ${weeklySleepSamples.length} hari` : 'Belum diisi'}
                  </span>
                </div>

                {/* Interactive Wave Bars */}
                <div className="flex items-end justify-between gap-1.5 h-20 my-3 px-2">
                  <div className="w-3 rounded-full bg-on-secondary-container/30 h-10 group-hover:h-14 transition-all duration-300"></div>
                  <div className="w-3 rounded-full bg-on-secondary-container/50 h-14 group-hover:h-18 transition-all duration-300"></div>
                  <div className="w-3 rounded-full bg-on-secondary-container h-18 group-hover:h-12 transition-all duration-300"></div>
                  <div className="w-3 rounded-full bg-on-secondary-container/80 h-12 group-hover:h-20 transition-all duration-300"></div>
                  <div className="w-3 rounded-full bg-on-secondary-container h-20 group-hover:h-15 transition-all duration-300"></div>
                  <div className="w-3 rounded-full bg-on-secondary-container/70 h-16 group-hover:h-10 transition-all duration-300"></div>
                  <div className="w-3 rounded-full bg-on-secondary-container/40 h-8 group-hover:h-16 transition-all duration-300"></div>
                  <div className="w-3 rounded-full bg-on-secondary-container/85 h-15 group-hover:h-12 transition-all duration-300"></div>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl sm:text-4xl font-bold tracking-tight">
                      {displaySleepHours != null ? displaySleepHours : '—'}
                    </span>
                    {displaySleepHours != null && <span className="text-sm font-bold ml-1">jam/malam</span>}
                  </div>
                  <span className="text-xs font-bold text-on-secondary-container">
                    {displaySleepHours != null
                      ? displaySleepHours < 6
                        ? 'Kurang dari ideal'
                        : displaySleepHours <= 9
                          ? 'Dalam rentang sehat'
                          : 'Lebih dari biasanya'
                      : 'Isi di Yes/No Quiz →'}
                  </span>
                </div>
              </div>

              {/* Stress Indicator Bento Tile */}
              <div className="bg-tertiary-container text-on-tertiary-container rounded-[2.5rem] p-6 flex flex-col justify-between min-h-[220px] shadow-[0_4px_0_#121214] relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">psychology_alt</span>
                    <span className="text-xs uppercase tracking-wider font-bold">Stress Indicator</span>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${stressScore != null ? (stressScore >= 70 ? 'bg-red-500' : stressScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-on-tertiary-container/35'}`}></span>
                </div>

                {/* Graduated Step Bar Chart */}
                <div className="flex items-end justify-between gap-1.5 h-20 my-3 px-2">
                  <div className="w-3 rounded-t-md bg-on-tertiary-container/20 h-4 group-hover:h-6 transition-all"></div>
                  <div className="w-3 rounded-t-md bg-on-tertiary-container/30 h-7 group-hover:h-9 transition-all"></div>
                  <div className="w-3 rounded-t-md bg-on-tertiary-container/40 h-10 group-hover:h-13 transition-all"></div>
                  <div className="w-3 rounded-t-md bg-on-tertiary-container/60 h-13 group-hover:h-16 transition-all"></div>
                  <div className="w-3 rounded-t-md bg-on-tertiary-container/80 h-16 group-hover:h-18 transition-all"></div>
                  <div className="w-3 rounded-t-md bg-on-tertiary-container h-20 group-hover:h-20 transition-all"></div>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl sm:text-4xl font-bold tracking-tight">
                      {stressScore != null ? stressScore : '—'}
                    </span>
                    {stressScore != null && <span className="text-sm font-bold ml-1">/100</span>}
                  </div>
                  <span className="text-xs font-bold text-on-tertiary-container">
                    {stressScore != null ? stressInfo.label : 'Isi di Yes/No Quiz →'}
                  </span>
                </div>
              </div>
            </div>

            {/* Yes or No Quick Mood Quiz (Interactive Multi-Question Pulse) */}
            <div className="bg-primary-container text-on-primary-container rounded-[2.5rem] p-6 sm:p-8 flex flex-col justify-between shadow-[0_4px_0_#121214] relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-on-primary-container">extension</span>
                  <span className="text-xs uppercase tracking-wider font-bold">Yes or No Quiz</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-3 py-0.5 rounded-full bg-surface-container-lowest/60 text-on-primary-container font-bold shadow-xs">
                    {quizLoggedToday ? 'Selesai hari ini' : sleepLogged ? `Question ${quizIndex + 1} / ${quizQuestions.length}` : 'Sleep Check-in'}
                  </span>
                  {!quizLoggedToday && (quizIndex > 0 || sleepLogged) && (
                    <button
                      onClick={resetQuiz}
                      className="text-[10px] underline text-on-primary-container hover:opacity-80"
                      title="Ulang Kuis"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Quiz Progress Bar (step 0 = sleep hours, steps 1-4 = yes/no questions) */}
              <div className="w-full bg-surface-container-lowest/40 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-[#121214] h-full transition-all duration-300"
                  style={{
                    width: quizLoggedToday
                      ? '100%'
                      : sleepLogged
                        ? `${((quizIndex + 2) / (quizQuestions.length + 1)) * 100}%`
                        : `${(1 / (quizQuestions.length + 1)) * 100}%`,
                  }}
                />
              </div>

              {metricLogError && (
                <p role="alert" className="mt-3 text-xs font-semibold text-red-700 bg-red-50 rounded-xl px-3 py-2">
                  {metricLogError}
                </p>
              )}

              {quizLoggedToday ? (
                <div className="my-6 flex flex-col items-center text-center gap-3">
                  <span className="material-symbols-outlined text-4xl text-on-primary-container">task_alt</span>
                  <h3 className="text-lg sm:text-xl font-bold text-on-primary-container tracking-tight">
                    Check-in hari ini sudah diisi
                  </h3>
                  <p className="text-sm text-on-primary-container/80 font-medium max-w-xs">
                    Yes/No Quiz hanya bisa diisi sekali sehari. Sampai jumpa besok untuk check-in berikutnya!
                  </p>
                  <button
                    type="button"
                    onClick={handleGoToFlowStudio}
                    className="mt-1 flex items-center justify-center gap-2 rounded-full bg-inverse-surface px-6 py-3 text-sm font-bold text-inverse-on-surface shadow-[0_3px_0_#121214] transition-all hover:opacity-90 active:translate-y-1 active:shadow-none"
                  >
                    <span>Ke Flow Studio</span>
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
                  </button>
                </div>
              ) : !sleepLogged ? (
                <>
                  <div className="my-6">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-container-lowest/60 px-2 py-0.5 rounded-md inline-block mb-1">
                      Pola Tidur
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-on-primary-container tracking-tight">
                      Berapa lama kamu tidur malam ini?
                    </h3>
                    <p className="text-sm text-on-primary-container/80 mt-1 font-medium">
                      Geser slider untuk mengisi kartu Sleep Duration.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-on-primary-container tracking-tight">{sleepHoursDraft}</span>
                      <span className="text-sm font-bold text-on-primary-container/80">jam</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      step="0.5"
                      value={sleepHoursDraft}
                      onChange={(e) => setSleepHoursDraft(e.target.value)}
                      className="w-full h-2 bg-surface-container-lowest/60 rounded-lg appearance-none cursor-pointer accent-[#121214]"
                      aria-label="Jam tidur malam ini"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-on-primary-container/70 px-0.5">
                      <span>0 jam</span>
                      <span>6 jam</span>
                      <span>12 jam</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogSleepHours}
                      disabled={isQuizAnswerConfirming}
                      className="mt-1 py-3 px-5 rounded-full font-bold text-sm bg-inverse-surface text-inverse-on-surface shadow-[0_3px_0_#121214] hover:opacity-90 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:cursor-wait disabled:opacity-70"
                    >
                      Simpan
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="my-6">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-container-lowest/60 px-2 py-0.5 rounded-md inline-block mb-1">
                      {quizQuestions[quizIndex]?.tag}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-on-primary-container tracking-tight">
                      {quizQuestions[quizIndex]?.q}
                    </h3>
                    <p className="text-sm text-on-primary-container/80 mt-1 font-medium">
                      Quick reflex answers unlock tailored breath anchors in your Flow Studio.
                    </p>
                  </div>

                  {/* Tactile Arcade Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleQuizAnswer('yes')}
                      disabled={isQuizAnswerConfirming}
                      className="py-3 rounded-full font-bold text-sm bg-inverse-surface text-inverse-on-surface shadow-[0_3px_0_#121214] hover:opacity-90 active:translate-y-1 active:shadow-none transition-all text-center cursor-pointer disabled:cursor-wait disabled:opacity-70"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuizAnswer('no')}
                      disabled={isQuizAnswerConfirming}
                      className="py-3 rounded-full font-bold text-sm bg-surface-container-lowest text-on-surface shadow-[0_3px_0_#121214] hover:bg-surface-container active:translate-y-1 active:shadow-none transition-all text-center cursor-pointer disabled:cursor-wait disabled:opacity-70"
                    >
                      No
                    </button>
                  </div>
                </>
              )}

              {isQuizAnswerConfirming && (
                <div
                  aria-live="polite"
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[2.5rem] bg-primary-container/95 backdrop-blur-sm animate-quiz-answer-confirmation"
                >
                  <div className="w-20 h-20 rounded-full bg-inverse-surface text-inverse-on-surface shadow-[0_5px_0_#121214] flex items-center justify-center animate-quiz-checkmark-pop">
                    <span className="material-symbols-outlined text-5xl" aria-hidden="true">check</span>
                  </div>
                  <span className="text-sm font-bold text-on-primary-container">{quizConfirmationMessage}</span>
                </div>
              )}

              {isQuizCompleteModalOpen && !isQuizAnswerConfirming && (
                <div
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[2.5rem] bg-primary-container p-6 text-center animate-quiz-answer-confirmation"
                  role="dialog"
                  aria-labelledby="quiz-complete-title"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-inverse-surface text-inverse-on-surface shadow-[0_4px_0_#121214] animate-quiz-checkmark-pop">
                    <span className="material-symbols-outlined text-4xl" aria-hidden="true">check_circle</span>
                  </div>
                  <span className="mt-4 text-xs font-bold uppercase tracking-wider text-on-primary-container">Check-in selesai</span>
                  <h2 id="quiz-complete-title" className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-on-primary-container">
                    Kuis kamu sudah selesai!
                  </h2>
                  <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-on-primary-container/80">
                    {lastQuizAnswer === 'no'
                      ? 'Kuis kamu sudah selesai. Apakah kamu ingin mengulang kuis Yes/No?'
                      : 'Kuis kamu sudah selesai. Lanjutkan ke Flow Studio untuk memakai hasil check-in ini.'}
                  </p>
                  <div className="mt-5 flex justify-center">
                    {lastQuizAnswer === 'no' ? (
                      <button
                        type="button"
                        onClick={resetYesNoQuiz}
                        title="Ulangi Yes/No Quiz"
                        aria-label="Ulangi Yes/No Quiz"
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface shadow-[0_3px_0_#121214] transition-all hover:bg-surface-container active:translate-y-0.5 active:shadow-none"
                      >
                        <span className="material-symbols-outlined text-[24px]" aria-hidden="true">refresh</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGoToFlowStudio}
                        className="flex items-center justify-center gap-2 rounded-full bg-inverse-surface px-6 py-3 text-sm font-bold text-inverse-on-surface shadow-[0_4px_0_#121214] transition-all hover:opacity-90 active:translate-y-1 active:shadow-none"
                      >
                        <span>Ke Flow Studio</span>
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Brain Dump & Tangled Thoughts (Col span 5) */}
          <div className="md:col-span-5 bg-surface-container-lowest rounded-[3rem] p-6 sm:p-8 flex flex-col justify-between shadow-[0_4px_0_#121214] border border-surface-container">
            <div>
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-secondary"></span>
                  <span className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                    Bebaskan Pikiran
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                    auto_fix_high
                  </span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight mt-1">
                Brain Dump &amp;<br />Tangled Thoughts
              </h3>
              <p className="text-xs text-on-surface-variant mt-1 font-medium">
                Don't let racing thoughts loop. Tap hot tags or vomit messy drafts below:
              </p>

              {/* Bouncy Quick Tags with spring hover */}
              <div className="flex flex-wrap gap-2 mt-4">
                {quickTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="px-3 py-1.5 rounded-full bg-surface-container text-xs font-bold text-on-surface shadow-[0_2px_0_#121214] hover:bg-secondary-container hover:text-on-secondary-container active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Free-text unjamming textarea */}
              <div className="mt-4 relative">
                <textarea
                  rows={4}
                  value={triageData.content}
                  onChange={(e) => setTriageData({ ...triageData, content: e.target.value })}
                  placeholder="Type raw unedited thoughts here... 'I have 3 deadlines on Monday and my chest feels heavy...'"
                  className="w-full rounded-[1.75rem] bg-surface-container p-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-high focus:ring-2 focus:ring-primary/40 transition-all resize-none font-medium leading-relaxed shadow-inner"
                />
                <div className="absolute right-3 bottom-3 text-[10px] font-mono text-on-surface-variant/60">
                  {triageData.content.length} karakter
                </div>
              </div>

              <div className={`mt-3 flex gap-3 rounded-2xl p-3 ${brainDumpShareActive ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container text-on-surface'}`} aria-live="polite">
                <span className="material-symbols-outlined mt-0.5 text-[20px]" aria-hidden="true">
                  {brainDumpShareActive ? 'lock_open' : 'lock'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold">{brainDumpDraftSavedAt ? 'Draft tersimpan otomatis di perangkat ini' : 'Draft pribadi siap ditulis'}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed opacity-85">{brainDumpPrivacyCopy}</p>
                </div>
              </div>

            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleBrainDumpSubmit}
                disabled={isProcessingSlice}
                className="w-full flex items-center justify-center gap-2 bg-inverse-surface text-inverse-on-surface py-4 rounded-full font-bold text-sm shadow-[0_4px_0_#121214] hover:opacity-90 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-75"
              >
                {isProcessingSlice ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Mengurai Beban Pikiran Menjadi 3 Misi...</span>
                  </>
                ) : (
                  <>
                    <span>Urai Jadi Langkah Ringan 🚀</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Lower Section: Prescription Bar & Instant Flow Starter */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-4">
        <div className="bg-surface-container-low rounded-[3rem] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_4px_0_#121214] border border-surface-container">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[2rem] bg-primary-container flex items-center justify-center text-on-primary-container shrink-0 shadow-[0_3px_0_#121214]">
              <span className="material-symbols-outlined text-[32px]">self_improvement</span>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-primary font-bold">
                Suggested Prescription
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-on-surface tracking-tight">
                5-Minute Box Breathing Session
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
                Your stress indicator is elevated. A 300-second resonant breath cycle resets your vagus nerve.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={() => toggleSoundscape('rain')}
              className="px-6 py-3 rounded-full bg-surface-container-lowest text-xs font-bold text-on-surface shadow-[0_3px_0_#121214] hover:bg-surface-container active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              Listen Soundscape
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(2);
                window.setTimeout(() => {
                  document.getElementById('fun-soundscapes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }}
              className="px-6 py-3 rounded-full bg-primary text-on-primary text-xs font-bold shadow-[0_4px_0_#121214] hover:opacity-90 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>Start Now</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
