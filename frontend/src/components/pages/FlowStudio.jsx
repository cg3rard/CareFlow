import { useState, useEffect } from 'react';
import { useFlow } from '../../context/FlowContext';

export default function FlowStudio() {
  const {
    microTasks,
    activeMissionIndex,
    toggleTaskDone,
    sliceTaskSmaller,
    resetMicroTasks,
    totalXp,
    taskCompletionLog,
    weeklyTaskCompletions,
    lifetimeXp,
    activeSound,
    toggleSoundscape,
    masterVolume,
    handleVolumeChange,
    addCustomMicroAction,
    saveCurrentSession,
    vaultSavedNotice,
    authUser,
    brainDumpOutcome,
    setStep,
  } = useFlow();

  // ========================================================
  // 1. Bio-Sync Breathing Engine with SVG Face & Presets
  // ========================================================
  const [breathingPattern, setBreathingPattern] = useState('box'); // 'box' (4-4-4) | 'deep' (4-7-8) | 'free'
  const [breathPhaseIndex, setBreathPhaseIndex] = useState(0);
  const [breathSeconds, setBreathSeconds] = useState(4);
  const [breathCycle, setBreathCycle] = useState(0);
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [floatingXpText, setFloatingXpText] = useState('');
  const TOTAL_BREATH_CYCLES = 8;

  // Simple, transparent level curve: every 100 XP earned from completing
  // micro-tasks advances the level by 1. Based on lifetimeXp (persisted in
  // the database via task_completions), not the per-session totalXp, so
  // Level survives logout/reload instead of resetting.
  const XP_PER_LEVEL = 100;
  const calmLevel = Math.floor(lifetimeXp / XP_PER_LEVEL) + 1;
  const xpIntoCurrentLevel = lifetimeXp % XP_PER_LEVEL;

  const phaseConfigs = {
    box: [
      { label: 'Breathe In...', seconds: 4, mouth: 'M36 58 Q50 72 64 58', scale: 'scale-110', bg: 'bg-primary-container' },
      { label: 'Hold Gently...', seconds: 4, mouth: 'M36 62 Q50 62 64 62', scale: 'scale-105', bg: 'bg-tertiary-container' },
      { label: 'Breathe Out Slowly...', seconds: 4, mouth: 'M38 66 Q50 54 62 66', scale: 'scale-90', bg: 'bg-secondary-container' },
    ],
    deep: [
      { label: 'Breathe In Deeply...', seconds: 4, mouth: 'M36 58 Q50 72 64 58', scale: 'scale-115', bg: 'bg-primary-container' },
      { label: 'Hold Calmly...', seconds: 7, mouth: 'M36 62 Q50 62 64 62', scale: 'scale-106', bg: 'bg-tertiary-container' },
      { label: 'Release Slowly...', seconds: 8, mouth: 'M38 66 Q50 54 62 66', scale: 'scale-88', bg: 'bg-secondary-container' },
    ],
    free: [
      { label: 'Inhale As You Like...', seconds: 3, mouth: 'M36 58 Q50 72 64 58', scale: 'scale-108', bg: 'bg-primary-container' },
      { label: 'Exhale Slowly...', seconds: 5, mouth: 'M38 66 Q50 54 62 66', scale: 'scale-92', bg: 'bg-secondary-container' },
    ],
  };

  useEffect(() => {
    if (!isBreathingActive) return undefined;
    const currentPattern = phaseConfigs[breathingPattern] || phaseConfigs.box;
    const interval = setInterval(() => {
      setBreathSeconds((prev) => {
        if (prev > 1) return prev - 1;

        setBreathPhaseIndex((prevIdx) => {
          const nextIdx = (prevIdx + 1) % currentPattern.length;
          if (nextIdx === 0) {
            setBreathCycle((cycle) => {
              const nextCycle = cycle + 1;
              if (nextCycle >= TOTAL_BREATH_CYCLES) setIsBreathingActive(false);
              return Math.min(nextCycle, TOTAL_BREATH_CYCLES);
            });
          }
          return nextIdx;
        });

        const nextPhase = currentPattern[(breathPhaseIndex + 1) % currentPattern.length];
        return nextPhase ? nextPhase.seconds : 4;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [breathingPattern, breathPhaseIndex, isBreathingActive]);

  const activePhase = (phaseConfigs[breathingPattern] || phaseConfigs.box)[breathPhaseIndex] || phaseConfigs.box[0];

  const startBreathing = () => {
    if (breathCycle >= TOTAL_BREATH_CYCLES) {
      setBreathCycle(0);
      setBreathPhaseIndex(0);
      setBreathSeconds((phaseConfigs[breathingPattern] || phaseConfigs.box)[0].seconds);
    }
    setIsBreathingActive(true);
  };

  const stopBreathing = () => setIsBreathingActive(false);

  const resetBreathing = () => {
    setIsBreathingActive(false);
    setBreathCycle(0);
    setBreathPhaseIndex(0);
    setBreathSeconds((phaseConfigs[breathingPattern] || phaseConfigs.box)[0].seconds);
  };

  // Manual sphere tap to cycle immediately (only while a session is active)
  const handleSphereTap = () => {
    if (!isBreathingActive) return;
    const currentPattern = phaseConfigs[breathingPattern] || phaseConfigs.box;
    const nextIdx = (breathPhaseIndex + 1) % currentPattern.length;
    setBreathPhaseIndex(nextIdx);
    setBreathSeconds(currentPattern[nextIdx].seconds);
  };

  // ========================================================
  // 2. 5-Minute Quest Countdown Timer with SVG progress
  // ========================================================
  const TOTAL_QUEST_TIME = 300;
  const [questTime, setQuestTime] = useState(TOTAL_QUEST_TIME); // 5:00
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [hasQuestStarted, setHasQuestStarted] = useState(false); // A new mission can only run after the timer starts

  useEffect(() => {
    let timer = null;
    if (isTimerRunning && questTime > 0) {
      timer = setInterval(() => {
        setQuestTime((t) => {
          if (t <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, questTime]);

  // Start the quest: run the timer and unlock mission access
  const startQuest = () => {
    setHasQuestStarted(true);
    setIsTimerRunning(true);
  };

  // Toggle pause/resume. If never started, the button acts as "Start".
  const toggleQuestTimer = () => {
    if (!hasQuestStarted) {
      startQuest();
      return;
    }
    setIsTimerRunning((prev) => !prev);
  };

  // Reset the 5-minute timer back to its initial state (not running, missions locked again)
  const resetQuestTimer = () => {
    setQuestTime(TOTAL_QUEST_TIME);
    setIsTimerRunning(false);
    setHasQuestStarted(false);
  };

  // Start a completely new round of missions: uncheck all missions & reset timer to 5:00
  const startNewMissionRound = () => {
    resetMicroTasks();
    resetQuestTimer();
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const timerProgressPercentage = Math.round((questTime / TOTAL_QUEST_TIME) * 100);

  // Are all missions complete? (activeMissionIndex becomes -1 when no tasks remain)
  const isAllMissionsCleared = hasQuestStarted && microTasks.length > 0 && activeMissionIndex === -1;
  // Time ran out before all missions were completed = failed
  const isQuestFailed = hasQuestStarted && questTime <= 0 && !isAllMissionsCleared;
  // Timer & mission actions are locked when: not yet started, paused, or the quest has ended (failed/succeeded)
  const isQuestLocked = !hasQuestStarted || !isTimerRunning || isQuestFailed || isAllMissionsCleared;

  // Permanently stop the timer once all missions are complete (can no longer be paused/resumed)
  useEffect(() => {
    if (isAllMissionsCleared && isTimerRunning) {
      setIsTimerRunning(false);
    }
  }, [isAllMissionsCleared, isTimerRunning]);

  // ========================================================
  // 3. Crush the Worry (Burn Negative Thoughts)
  // ========================================================
  const [worryText, setWorryText] = useState('');
  const [isCrushing, setIsCrushing] = useState(false);
  const [ashParticles, setAshParticles] = useState([]);
  const [emojiParticles, setEmojiParticles] = useState([]);
  const [isShockwaveActive, setIsShockwaveActive] = useState(false);
  const [isCardShaking, setIsCardShaking] = useState(false);

  const BURST_EMOJIS = ['💥', '🔥', '✨', '⚡', '💫'];

  const handleCrush = () => {
    if (!worryText.trim() || isCrushing) return;
    setIsCrushing(true);

    // Brief wind-up shake before the actual burst, then trigger the
    // shockwave + debris + card rumble together for a punchier payoff.
    window.setTimeout(() => {
      setAshParticles(
        Array.from({ length: 26 }, (_, index) => {
          const angle = (index / 26) * Math.PI * 2 + Math.random() * 0.4;
          const distance = 70 + Math.random() * 110;
          return {
            id: index,
            size: 3 + Math.random() * 7,
            delay: `${Math.random() * 0.06}s`,
            duration: `${0.55 + Math.random() * 0.35}s`,
            dx: `${Math.cos(angle) * distance}px`,
            dy: `${Math.sin(angle) * distance}px`,
            spin: `${(Math.random() - 0.5) * 720}deg`,
          };
        })
      );
      setEmojiParticles(
        Array.from({ length: 7 }, (_, index) => {
          const angle = (index / 7) * Math.PI * 2 + Math.random() * 0.5;
          const distance = 55 + Math.random() * 70;
          return {
            id: index,
            emoji: BURST_EMOJIS[index % BURST_EMOJIS.length],
            delay: `${Math.random() * 0.05}s`,
            duration: `${0.6 + Math.random() * 0.3}s`,
            dx: `${Math.cos(angle) * distance}px`,
            dy: `${Math.sin(angle) * distance}px`,
          };
        })
      );
      setIsShockwaveActive(true);
      setIsCardShaking(true);

      window.setTimeout(() => setIsCardShaking(false), 400);
      window.setTimeout(() => {
        setWorryText('');
        setIsCrushing(false);
        setAshParticles([]);
        setEmojiParticles([]);
        setIsShockwaveActive(false);
      }, 750);
    }, 260);
  };

  // Wrapper for task toggle with floating XP banner
  const handleTaskCheck = (task) => {
    if (!hasQuestStarted) {
      setFloatingXpText('Press "Start Mission" first to begin ⏱️');
      setTimeout(() => setFloatingXpText(''), 1800);
      return;
    }
    if (!isTimerRunning || isQuestFailed || isAllMissionsCleared) {
      setFloatingXpText('Resume the timer first to complete the mission ⏸️');
      setTimeout(() => setFloatingXpText(''), 1800);
      return;
    }
    toggleTaskDone(task.id);
    if (!task.completed && microTasks[activeMissionIndex]?.id === task.id) {
      setFloatingXpText(`+${task.xp || 15} Calm XP!`);
      setTimeout(() => setFloatingXpText(''), 1500);
    }
  };

  const handleCustomMicroAction = () => {
    const action = window.prompt('Write 1 mini step you can finish in 2 minutes:');
    if (action && addCustomMicroAction(action)) {
      setFloatingXpText('2-minute mission added ✨');
      setTimeout(() => setFloatingXpText(''), 1800);
    }
  };

  const completedCount = microTasks.filter((t) => t.completed).length;

  // Groups real task-completion timestamps into daily buckets over the last
  // 7 days so the "Focus Activity This Week" chart reflects actual usage
  // instead of a fixed mock-up. Combines the current session's local log
  // (works for guests too) with server-synced completions for logged-in
  // users, de-duplicated by completion id so nothing is double-counted.
  const weeklyFocusActivity = (() => {
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const seenIds = new Set();
    const allCompletions = [];
    weeklyTaskCompletions.forEach((entry) => {
      if (entry.id && seenIds.has(entry.id)) return;
      if (entry.id) seenIds.add(entry.id);
      allCompletions.push({ xp: entry.xp, completedAt: entry.completedAt });
    });
    taskCompletionLog.forEach((entry) => {
      allCompletions.push({ xp: entry.xp, completedAt: entry.completedAt });
    });

    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return { key: date.toDateString(), label: DAY_LABELS[date.getDay()], xp: 0, isToday: index === 6 };
    });
    const dayByKey = new Map(days.map((day) => [day.key, day]));

    allCompletions.forEach(({ xp, completedAt }) => {
      const key = new Date(completedAt).toDateString();
      const day = dayByKey.get(key);
      if (day) day.xp += xp || 0;
    });

    return days;
  })();
  const maxWeeklyXp = Math.max(1, ...weeklyFocusActivity.map((day) => day.xp));
  const hasWeeklyActivity = weeklyFocusActivity.some((day) => day.xp > 0);

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 gap-6 pb-28">
      {/* Floating XP Toast */}
      {floatingXpText && (
        <div className="fixed top-24 right-1/2 translate-x-1/2 z-50 bg-[#121214] text-white px-5 py-2.5 rounded-full text-xs font-extrabold shadow-xl animate-float-xp flex items-center gap-2">
          <span>🎉</span>
          <span>{floatingXpText}</span>
        </div>
      )}

      {brainDumpOutcome && (
        <div className="rounded-2xl border border-primary/25 bg-primary-container px-5 py-4 text-on-primary-container shadow-[0_3px_0_#121214]" role="status">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined mt-0.5" aria-hidden="true">{brainDumpOutcome.shared ? 'lock_open' : 'lock'}</span>
            <div>
              <p className="text-sm font-bold">Brain Dump note saved</p>
              <p className="mt-1 text-xs font-medium leading-relaxed">
                {brainDumpOutcome.shared
                  ? 'This final note has also been shared with the psychologist you selected, per your active data consent.'
                  : 'This final note is saved privately to your account and has not been shared with a psychologist.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setBreathingPattern('free');
                  setBreathPhaseIndex(0);
                  setBreathSeconds(3);
                  setBreathCycle(0);
                  setIsBreathingActive(true);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-inverse-surface px-4 py-2 text-xs font-bold text-inverse-on-surface shadow-[0_2px_0_#121214] transition-all hover:opacity-90 active:translate-y-0.5 active:shadow-none"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">air</span>
                Start a ~1 minute breathing grounding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP MOOD STATUS BAR */}
      <div className="w-full bg-surface-container-lowest rounded-[2rem] p-4 sm:p-5 shadow-[0_4px_0_#121214] border border-surface-container flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center shrink-0 shadow-xs relative">
            <svg className="w-10 h-10 text-on-primary-container animate-pulse" fill="none" viewBox="0 0 40 40">
              <circle cx="20" cy="20" fill="currentColor" fillOpacity="0.15" r="16"></circle>
              <path d="M14 18C14 16.8954 14.8954 16 16 16C17.1046 16 18 16.8954 18 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5"></path>
              <path d="M22 18C22 16.8954 22.8954 16 24 16C25.1046 16 26 16.8954 26 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5"></path>
              <path d="M15 24C16.8 26.5 23.2 26.5 25 24" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5"></path>
            </svg>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Comfort Zone Active</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface">
              Relaxed Focus Phase
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
          <div className="bg-secondary-container text-on-secondary-container px-4 py-2 rounded-full flex items-center gap-2 shadow-[0_2px_0_#121214]" title={`Total ${lifetimeXp} lifetime XP`}>
            <span className="material-symbols-outlined text-[18px]">military_tech</span>
            <span className="text-xs font-bold">Level {calmLevel} • {xpIntoCurrentLevel}/{XP_PER_LEVEL} XP</span>
          </div>
          <div className="bg-tertiary-container text-on-tertiary-container px-4 py-2 rounded-full flex items-center gap-2 shadow-[0_2px_0_#121214]" title="XP from the current session">
            <span className="material-symbols-outlined text-[18px]">battery_charging_full</span>
            <span className="text-xs font-bold">{totalXp} XP This Session</span>
          </div>
        </div>
      </div>

      {/* 2-COLUMN PLAYFUL BENTO STUDIO LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
        {/* ========================================================
            LEFT COLUMN: Bio-Sync & Zen Breathing + Soundscapes + Worry Burner
           ======================================================== */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Card 1: Bio-Sync Breathing Sphere Interactive */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 sm:p-8 shadow-[0_4px_0_#121214] border border-surface-container flex flex-col items-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">air</span>
                <span className="text-lg font-bold text-on-surface">Bio-Sync &amp; Zen Breathing</span>
              </div>
              <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold uppercase shadow-xs">
                Cycle {breathCycle} / {TOTAL_BREATH_CYCLES}
              </span>
            </div>

            {/* Breathing Interactive Sphere Canvas Area */}
            <div
              onClick={handleSphereTap}
              className={`relative w-64 h-64 my-4 flex items-center justify-center select-none group ${isBreathingActive ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
              title={isBreathingActive ? 'Tap the circle to speed up the breath cycle' : 'Press Start to begin a breathing session'}
            >
              {/* Pulsing Aura Rings */}
              <div
                className={`absolute inset-0 rounded-full bg-primary-container opacity-40 transition-all duration-1000 transform animate-breathing-glow ${
                  activePhase.scale
                }`}
              ></div>
              <div className="absolute inset-4 rounded-full bg-secondary-container opacity-50 blur-xl transition-all duration-1000"></div>

              {/* Tactile Face Sphere with Expression Changes */}
              <div
                className={`relative w-44 h-44 rounded-full ${activePhase.bg} flex flex-col items-center justify-center shadow-md transition-all duration-700 ease-in-out group-hover:scale-105 active:scale-95 ${
                  activePhase.scale
                }`}
              >
                <svg className="w-20 h-20 text-on-primary-container transition-transform duration-300" fill="none" viewBox="0 0 100 100">
                  <path d="M30 40 Q38 35 45 42" stroke="currentColor" strokeLinecap="round" strokeWidth="4.5"></path>
                  <path d="M55 42 Q62 35 70 40" stroke="currentColor" strokeLinecap="round" strokeWidth="4.5"></path>
                  <circle cx="28" cy="52" fill="#fec5a7" r="5"></circle>
                  <circle cx="72" cy="52" fill="#fec5a7" r="5"></circle>
                  <path d={activePhase.mouth} stroke="currentColor" strokeLinecap="round" strokeWidth="4.5" className="transition-all duration-500"></path>
                </svg>
                <span className="text-sm font-bold text-on-primary-container mt-1">
                  {activePhase.label}
                </span>
              </div>
            </div>

            {/* Chunky Timer Metric */}
            <div className="flex items-center gap-3 bg-surface-container-low px-6 py-2 rounded-full my-2 shadow-[0_2px_0_#121214]">
              <span className="material-symbols-outlined text-primary text-[22px]">timer</span>
              <span className="text-3xl sm:text-4xl font-bold font-mono text-on-surface">
                0{breathSeconds}
              </span>
              <span className="text-sm font-semibold text-on-surface-variant">Seconds</span>
            </div>

            {/* Start / Stop Controls */}
            <div className="w-full flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={isBreathingActive ? stopBreathing : startBreathing}
                className={`px-6 py-2.5 rounded-full text-sm font-bold shadow-[0_3px_0_#121214] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-2 ${
                  isBreathingActive ? 'bg-error-container text-on-error-container' : 'bg-primary text-on-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{isBreathingActive ? 'pause' : 'play_arrow'}</span>
                <span>{isBreathingActive ? 'Stop' : breathCycle > 0 ? 'Resume' : 'Start'}</span>
              </button>
              {(breathCycle > 0 || isBreathingActive) && (
                <button
                  type="button"
                  onClick={resetBreathing}
                  className="px-4 py-2.5 rounded-full bg-surface-container text-on-surface text-xs font-bold shadow-[0_2px_0_#121214] hover:bg-surface-container-high active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
                  title="Reset cycle to 0"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>Reset</span>
                </button>
              )}
            </div>
            {!isBreathingActive && breathCycle >= TOTAL_BREATH_CYCLES && (
              <p className="text-xs font-bold text-primary text-center">🎉 8 cycles complete! Press Start for a new session.</p>
            )}

            {/* Breathing Preset Modes */}
            <div className="w-full mt-4 flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={() => setBreathingPattern('box')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-[0_2px_0_#121214] ${
                  breathingPattern === 'box'
                    ? 'bg-inverse-surface text-inverse-on-surface scale-105'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                Box Breathing 4-4 (Chilled)
              </button>
              <button
                type="button"
                onClick={() => setBreathingPattern('deep')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-[0_2px_0_#121214] ${
                  breathingPattern === 'deep'
                    ? 'bg-inverse-surface text-inverse-on-surface scale-105'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                4-7-8 Deep Chill
              </button>
              <button
                type="button"
                onClick={() => setBreathingPattern('free')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-[0_2px_0_#121214] ${
                  breathingPattern === 'free'
                    ? 'bg-inverse-surface text-inverse-on-surface scale-105'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                Free Rhythm
              </button>
            </div>
          </div>

          {/* Card 2: Fun Soundscapes */}
          <div id="fun-soundscapes" className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-[0_4px_0_#121214] border border-surface-container flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[24px]">headphones</span>
                <h2 className="text-base sm:text-lg font-bold text-on-surface">Fun Soundscapes</h2>
              </div>
              <span className="text-xs text-on-surface-variant font-medium">Spatial 432Hz</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Sound 1: Hujan Cozy */}
              <button
                type="button"
                onClick={() => toggleSoundscape('rain')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all cursor-pointer tactile-btn shadow-[0_2px_0_#121214] relative overflow-hidden ${
                  activeSound === 'rain'
                    ? 'bg-secondary-container text-on-secondary-container ring-2 ring-secondary'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                <span className="text-2xl mb-1">🌧️</span>
                <span className="text-xs font-bold text-center">Cozy Rain</span>
                {activeSound === 'rain' ? (
                  <div className="flex items-center gap-0.5 mt-1 h-3">
                    <span className="w-1 bg-secondary rounded-full animate-eq-1"></span>
                    <span className="w-1 bg-secondary rounded-full animate-eq-2"></span>
                    <span className="w-1 bg-secondary rounded-full animate-eq-3"></span>
                  </div>
                ) : (
                  <span className="text-[10px] text-on-surface-variant mt-0.5 font-medium">Pause</span>
                )}
              </button>

              {/* Sound 2: Hutan Pinus */}
              <button
                type="button"
                onClick={() => toggleSoundscape('forest')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all cursor-pointer tactile-btn shadow-[0_2px_0_#121214] relative overflow-hidden ${
                  activeSound === 'forest'
                    ? 'bg-primary-container text-on-primary-container ring-2 ring-primary'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                <span className="text-2xl mb-1">🌲</span>
                <span className="text-xs font-bold text-center">Pine Forest</span>
                {activeSound === 'forest' ? (
                  <div className="flex items-center gap-0.5 mt-1 h-3">
                    <span className="w-1 bg-primary rounded-full animate-eq-1"></span>
                    <span className="w-1 bg-primary rounded-full animate-eq-2"></span>
                    <span className="w-1 bg-primary rounded-full animate-eq-3"></span>
                  </div>
                ) : (
                  <span className="text-[10px] text-on-surface-variant mt-0.5 font-medium">Pause</span>
                )}
              </button>

              {/* Sound 3: Kafe Santai */}
              <button
                type="button"
                onClick={() => toggleSoundscape('cafe')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all cursor-pointer tactile-btn shadow-[0_2px_0_#121214] relative overflow-hidden ${
                  activeSound === 'cafe'
                    ? 'bg-tertiary-container text-on-tertiary-container ring-2 ring-tertiary'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                <span className="text-2xl mb-1">☕</span>
                <span className="text-xs font-bold text-center">Cozy Cafe</span>
                {activeSound === 'cafe' ? (
                  <div className="flex items-center gap-0.5 mt-1 h-3">
                    <span className="w-1 bg-tertiary rounded-full animate-eq-1"></span>
                    <span className="w-1 bg-tertiary rounded-full animate-eq-2"></span>
                    <span className="w-1 bg-tertiary rounded-full animate-eq-3"></span>
                  </div>
                ) : (
                  <span className="text-[10px] text-on-surface-variant mt-0.5 font-medium">Pause</span>
                )}
              </button>
            </div>

            {/* Volume Master Slider */}
            <div className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-2">
              <div className="flex justify-between items-center text-on-surface-variant text-xs">
                <span className="uppercase tracking-wider font-bold">Volume Master Ambient</span>
                <span className="font-bold text-on-surface">{Math.round(masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={masterVolume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-secondary"
              />
            </div>
          </div>

          {/* Card 3: Bakar & Hancurkan Pikiran Negatif (Crush the Worry) */}
          <div className={`bg-surface-container-lowest rounded-[2rem] p-6 shadow-[0_4px_0_#121214] border border-surface-container flex flex-col gap-4 relative overflow-hidden ${isCardShaking ? 'animate-card-rumble' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-[24px]">local_fire_department</span>
                <h2 className="text-base sm:text-lg font-bold text-on-surface">
                  Burn &amp; Crush Negative Thoughts
                </h2>
              </div>
              <span className="bg-error-container text-on-error-container px-2.5 py-1 rounded-full text-xs font-bold">
                Anti-Overthinking
              </span>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Type anything that's weighing on your chest, making you anxious, or stuck in your head. Crush it into digital dust!
            </p>

            <div className="relative">
              <textarea
                rows={3}
                value={worryText}
                disabled={isCrushing}
                onChange={(e) => setWorryText(e.target.value)}
                placeholder="Example: Afraid this work will be judged poorly by the team, feeling like I can't finish the deadline..."
                className={`w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 rounded-xl p-4 text-xs sm:text-sm focus:outline-none focus:bg-surface-container resize-none transition-all ${
                  isShockwaveActive ? 'animate-worry-explode' : isCrushing ? 'animate-worry-windup' : ''
                }`}
              />
              {isShockwaveActive && (
                <>
                  <span className="absolute inset-0 rounded-xl bg-error/30 animate-explosion-flash pointer-events-none" aria-hidden="true" />
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                    <span className="w-10 h-10 rounded-full border-4 border-error animate-shockwave-ring" />
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                    <span className="w-10 h-10 rounded-full border-2 border-amber-400 animate-shockwave-ring" style={{ animationDelay: '0.08s' }} />
                  </span>
                </>
              )}
              {ashParticles.length > 0 && (
                <div className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden="true">
                  {ashParticles.map((particle) => (
                    <span
                      key={particle.id}
                      className="absolute left-1/2 top-1/2 rounded-full bg-gradient-to-br from-amber-300 via-error to-error-container animate-explosion-particle"
                      style={{
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        animationDelay: particle.delay,
                        animationDuration: particle.duration,
                        '--dx': particle.dx,
                        '--dy': particle.dy,
                        '--spin': particle.spin,
                      }}
                    />
                  ))}
                </div>
              )}
              {emojiParticles.length > 0 && (
                <div className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden="true">
                  {emojiParticles.map((particle) => (
                    <span
                      key={particle.id}
                      className="absolute left-1/2 top-1/2 text-lg animate-emoji-burst"
                      style={{
                        animationDelay: particle.delay,
                        animationDuration: particle.duration,
                        '--dx': particle.dx,
                        '--dy': particle.dy,
                      }}
                    >
                      {particle.emoji}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCrush}
                disabled={!worryText.trim() || isCrushing}
                className="px-6 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface text-xs font-bold shadow-[0_3px_0_#121214] hover:scale-105 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isShockwaveActive ? 'BOOM! 💥' : isCrushing ? 'Bracing...' : 'Crush & Destroy!'}</span>
                <span className="text-base">{isCrushing ? '🔥' : '💥'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            RIGHT COLUMN: Gamified Slicer & Quest Cards (col-span-6)
           ======================================================== */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Header & Mini Mission Badge */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 sm:p-8 shadow-[0_4px_0_#121214] border border-surface-container flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                  <span className="text-xs uppercase tracking-widest text-secondary font-bold">
                    Gamified Slicer
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-on-surface">
                  5-Minute Mission {authUser?.name || 'Friend'}!
                </h2>
              </div>
            </div>

            {/* Chunky 5-Minute Timer Module with Animated Circular Progress */}
            <div className="bg-surface-container-low rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-[0_2px_0_#121214]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Circular SVG Progress */}
                  <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-surface-variant"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                      ></path>
                      <path
                        className="text-secondary transition-all duration-1000 ease-linear"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${timerProgressPercentage}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3.5"
                      ></path>
                    </svg>
                    <span className="material-symbols-outlined text-secondary text-[24px] absolute">
                      hourglass_top
                    </span>
                  </div>
                  <div>
                    <div className="text-[11px] text-on-surface-variant uppercase tracking-wider font-bold">
                      {hasQuestStarted ? 'Current Round Timer' : 'Press Start to Activate the Mission'}
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-on-surface font-mono">
                      {formatTimer(questTime)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={toggleQuestTimer}
                    disabled={isQuestFailed || isAllMissionsCleared}
                    className={`flex-1 sm:flex-none px-5 py-2.5 rounded-full text-xs font-bold shadow-[0_3px_0_#121214] hover:opacity-90 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                      !hasQuestStarted ? 'bg-primary text-on-primary' : 'bg-inverse-surface text-inverse-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isAllMissionsCleared ? 'check_circle' : isQuestFailed ? 'flag' : isTimerRunning ? 'pause' : 'play_arrow'}
                    </span>
                    <span>
                      {isAllMissionsCleared
                        ? 'Mission Complete'
                        : isQuestFailed
                          ? 'Time\'s Up'
                          : !hasQuestStarted
                            ? 'Start Mission'
                            : isTimerRunning
                              ? 'Pause'
                              : 'Resume'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={resetQuestTimer}
                    disabled={isQuestFailed || isAllMissionsCleared}
                    className="p-2.5 rounded-full bg-surface-container text-on-surface hover:bg-surface-variant shadow-[0_2px_0_#121214] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    title="Reset 5 Minutes"
                  >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                  </button>
                </div>
              </div>

              {/* Popup: Time's Up / Failed to Complete Mission (in-flow, pushes content below it) */}
              {isQuestFailed && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-error-container shadow-[0_4px_0_#121214] px-5 py-6 text-center animate-fadeIn">
                  <span className="text-4xl animate-bounce">⏳</span>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-on-error-container">
                      Time's Up! Mission Not Yet Complete
                    </h3>
                    <p className="text-xs text-on-error-container/80 mt-1 max-w-xs mx-auto">
                      It's okay, this isn't a permanent failure. Let's reset and try again with a smaller step!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startNewMissionRound}
                    className="mt-1 flex items-center gap-2 px-5 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface text-xs font-bold shadow-[0_3px_0_#121214] hover:scale-105 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px] animate-spin" style={{ animationDuration: '2s' }}>refresh</span>
                    <span>Retry the 5-Minute Mission</span>
                  </button>
                </div>
              )}

              {/* Popup: All Missions Successfully Completed (in-flow, pushes content below it) */}
              {isAllMissionsCleared && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-primary-container shadow-[0_4px_0_#121214] px-5 py-6 text-center animate-fadeIn">
                  <span className="text-4xl animate-bounce">🎉</span>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-on-primary-container">
                      5-Minute Mission Successfully Completed!
                    </h3>
                    <p className="text-xs text-on-primary-container/80 mt-1 max-w-xs mx-auto">
                      Great work! All the small steps are done. This momentum deserves a celebration ✨
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startNewMissionRound}
                    className="mt-1 flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold shadow-[0_3px_0_#121214] hover:scale-105 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    <span>Start a New Mission</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3 Playful Mission Cards Stack */}
            <div className="flex flex-col gap-4">
              {/* Mission 1 */}
              {microTasks[0] && (
                <div
                  className={`rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
                    microTasks[0].completed
                      ? 'bg-primary-container/40 opacity-90 shadow-xs'
                      : 'bg-surface-container-low shadow-[0_2px_0_#121214]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleTaskCheck(microTasks[0])}
                      disabled={isQuestLocked || activeMissionIndex !== 0}
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 ${
                        microTasks[0].completed
                          ? 'bg-primary text-on-primary'
                          : 'border-2 border-gray-300 text-transparent hover:border-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">check</span>
                    </button>
                    <div>
                      <span className={`text-xs text-on-surface-variant ${microTasks[0].completed ? 'line-through' : ''}`}>
                        Mission 1
                      </span>
                      <h3 className={`text-sm sm:text-base font-bold text-on-surface ${microTasks[0].completed ? 'line-through' : ''}`}>
                        {microTasks[0].action}
                      </h3>
                    </div>
                  </div>
                  <div className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shrink-0 shadow-xs">
                    <span>+{microTasks[0].xp || 10} XP {microTasks[0].completed ? 'Done 🎉' : '< 2 min'}</span>
                  </div>
                </div>
              )}

              {/* Mission 2 (Active Quest in Lilac tactile container) */}
              {microTasks[1] && (
                <div className={`rounded-2xl p-5 shadow-[0_4px_0_#121214] flex flex-col gap-4 relative border transition-all ${
                  microTasks[1].completed ? 'bg-primary-container/35 border-primary/20' : activeMissionIndex === 1 ? 'bg-tertiary-container/45 border-tertiary/30' : 'bg-surface-container-low opacity-70 border-surface-container-high'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-tertiary animate-ping"></span>
                      <span className="text-xs font-bold uppercase tracking-wider text-tertiary">
                        {microTasks[1].completed ? 'Quest Complete' : activeMissionIndex === 1 ? 'Quest In Progress' : 'Locked • Complete Mission 1'}
                      </span>
                    </div>
                    <span className="bg-tertiary text-on-tertiary px-3 py-0.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-1">
                      <span>Mission #2</span>
                      <span className="opacity-80">•</span>
                      <span>+{microTasks[1].xp || 20} XP</span>
                    </span>
                  </div>

                  <div>
                    <h3 className={`text-base sm:text-lg font-bold text-on-surface mb-1 ${microTasks[1].completed ? 'line-through' : ''}`}>
                      {microTasks[1].action}
                    </h3>
                    <div className="inline-flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1 rounded-full text-on-surface-variant text-xs font-medium shadow-xs">
                      <span>✨</span>
                      <span>{microTasks[1].guidance || 'Let it be messy for now, what matters is getting going!'}</span>
                    </div>
                  </div>

                  {/* Gamified Interactive Controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleTaskCheck(microTasks[1])}
                      disabled={isQuestLocked || activeMissionIndex !== 1}
                      className="px-4 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold shadow-[0_3px_0_#121214] hover:opacity-90 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>{microTasks[1].completed ? 'Continue to Mission 3 →' : activeMissionIndex === 1 ? 'Mark as Done' : 'Complete Mission 1 first'}</span>
                      <span className="material-symbols-outlined text-[18px]">done_all</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => sliceTaskSmaller(microTasks[1].id)}
                      disabled={isQuestLocked || activeMissionIndex !== 1}
                      className="px-4 py-2.5 rounded-full bg-surface-container-lowest text-on-surface text-xs font-bold shadow-[0_3px_0_#121214] hover:bg-surface-container active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>Break It Down More</span>
                      <span className="text-sm">🤏</span>
                    </button>
                    <button
                      type="button"
                      onClick={resetQuestTimer}
                      className="px-3.5 py-2.5 rounded-full bg-surface-container-lowest text-on-surface-variant text-xs font-bold shadow-[0_3px_0_#121214] hover:bg-surface-container active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">timer</span>
                      <span>New 5 Minutes</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mission 3 (Next Up) */}
              {microTasks[2] && (
                <div className={`rounded-2xl p-4 flex items-center justify-between gap-3 shadow-[0_2px_0_#121214] transition-all ${
                  microTasks[2].completed ? 'bg-primary-container/35' : activeMissionIndex === 2 ? 'bg-secondary-container/45 ring-1 ring-secondary/25' : 'bg-surface-container-low opacity-70'
                }`}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleTaskCheck(microTasks[2])}
                      disabled={isQuestLocked || activeMissionIndex !== 2}
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 ${
                        microTasks[2].completed
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-highest text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {microTasks[2].completed ? 'check' : activeMissionIndex === 2 ? 'task_alt' : 'lock_clock'}
                      </span>
                    </button>
                    <div>
                      <span className={`text-xs text-on-surface-variant ${microTasks[2].completed ? 'line-through' : ''}`}>
                        {microTasks[2].completed ? 'Mission 3 • Done' : activeMissionIndex === 2 ? 'Mission 3 • Quest Active' : 'Mission 3 • Locked'}
                        {' • '}+{microTasks[2].xp || 15} XP
                      </span>
                      <h3 className={`text-xs sm:text-sm font-bold text-on-surface ${microTasks[2].completed ? 'line-through' : ''}`}>
                        {microTasks[2].action}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTaskCheck(microTasks[2])}
                    disabled={isQuestLocked || activeMissionIndex !== 2}
                    className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-on-primary shadow-xs transition-all disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant"
                  >
                    {microTasks[2].completed ? 'Done ✨' : activeMissionIndex === 2 ? 'Mark as Done' : 'After Mission 2'}
                  </button>
                </div>
              )}
            </div>

            {/* Playful Encouragement Banner */}
            <div className="bg-secondary-container/40 rounded-2xl p-4 flex items-center gap-3 mt-1 shadow-xs">
              <span className="text-2xl shrink-0">🚀</span>
              <p className="text-xs sm:text-sm text-on-surface font-medium leading-relaxed">
                <strong>Momentum &gt; Perfectionism.</strong> One small step now matters more than a grand plan you keep postponing.
              </p>
            </div>
          </div>

          {/* Micro Visualizer: Streak & Flow Rhythm */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-[0_4px_0_#121214] border border-surface-container flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">ssid_chart</span>
                <span className="text-sm font-bold text-on-surface">Focus Activity This Week</span>
              </div>
              <span className="text-xs font-bold text-primary">
                {completedCount >= 3 ? 'All Missions Complete 🔥' : hasWeeklyActivity ? 'Sustained Focus' : 'No Activity Yet'}
              </span>
            </div>

            {/* Real bar graph built from actual task-completion timestamps over the last 7 days */}
            {hasWeeklyActivity ? (
              <div className="w-full h-24 flex items-end justify-between gap-2 pt-4 px-2">
                {weeklyFocusActivity.map((day) => (
                  <div key={day.key} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                    <div
                      className={`w-full rounded-t-lg transition-all ${day.isToday ? 'bg-primary shadow-sm' : 'bg-primary-container group-hover:bg-primary'}`}
                      style={{ height: `${day.xp > 0 ? Math.max(12, (day.xp / maxWeeklyXp) * 80) : 4}px` }}
                      title={`${day.xp} XP on ${day.label}`}
                    ></div>
                    <span className={`text-[10px] font-mono ${day.isToday ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
                      {day.isToday ? 'Today' : day.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-24 flex flex-col items-center justify-center gap-1 text-center">
                <span className="text-xs text-on-surface-variant font-medium">No missions completed this week yet.</span>
                <span className="text-[11px] text-on-surface-variant/70">This chart fills in as soon as you mark a mission done.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
