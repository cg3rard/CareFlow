import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useFlow } from '../../context/FlowContext';

export default function FlowStudio() {
  const {
    microTasks,
    activeMissionIndex,
    toggleTaskDone,
    sliceTaskSmaller,
    totalXp,
    activeSound,
    toggleSoundscape,
    masterVolume,
    handleVolumeChange,
    addCustomMicroAction,
    saveCurrentSession,
    vaultSavedNotice,
    authUser,
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

  const phaseConfigs = {
    box: [
      { label: 'Tarik Napas...', seconds: 4, mouth: 'M36 58 Q50 72 64 58', scale: 'scale-110', bg: 'bg-primary-container' },
      { label: 'Tahan Santai...', seconds: 4, mouth: 'M36 62 Q50 62 64 62', scale: 'scale-105', bg: 'bg-tertiary-container' },
      { label: 'Hembuskan Pelan...', seconds: 4, mouth: 'M38 66 Q50 54 62 66', scale: 'scale-90', bg: 'bg-secondary-container' },
    ],
    deep: [
      { label: 'Tarik Napas Dalam...', seconds: 4, mouth: 'M36 58 Q50 72 64 58', scale: 'scale-115', bg: 'bg-primary-container' },
      { label: 'Tahan Tenang...', seconds: 7, mouth: 'M36 62 Q50 62 64 62', scale: 'scale-106', bg: 'bg-tertiary-container' },
      { label: 'Lepaskan Panjang...', seconds: 8, mouth: 'M38 66 Q50 54 62 66', scale: 'scale-88', bg: 'bg-secondary-container' },
    ],
    free: [
      { label: 'Hirup Sesukamu...', seconds: 3, mouth: 'M36 58 Q50 72 64 58', scale: 'scale-108', bg: 'bg-primary-container' },
      { label: 'Hembus Perlahan...', seconds: 5, mouth: 'M38 66 Q50 54 62 66', scale: 'scale-92', bg: 'bg-secondary-container' },
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
  const [questTime, setQuestTime] = useState(258); // 4:18
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  useEffect(() => {
    let timer = null;
    if (isTimerRunning && questTime > 0) {
      timer = setInterval(() => {
        setQuestTime((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, questTime]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const timerProgressPercentage = Math.round((questTime / TOTAL_QUEST_TIME) * 100);

  // ========================================================
  // 3. Crush the Worry (Bakar Pikiran Negatif)
  // ========================================================
  const [worryText, setWorryText] = useState('');
  const [isCrushing, setIsCrushing] = useState(false);
  const [showCrushFeedback, setShowCrushFeedback] = useState(false);

  const handleCrush = () => {
    if (!worryText.trim() || isCrushing) return;
    setIsCrushing(true);

    try {
      confetti({
        particleCount: 35,
        spread: 70,
        origin: { y: 0.8 },
        colors: ['#ba1a1a', '#ffdad6', '#7f543d', '#303032'],
      });
    } catch {
      // Confetti is decorative; the interaction remains available.
    }

    setTimeout(() => {
      setWorryText('');
      setIsCrushing(false);
      setShowCrushFeedback(true);
      setTimeout(() => setShowCrushFeedback(false), 4500);
    }, 850);
  };

  // Wrapper for task toggle with floating XP banner
  const handleTaskCheck = (task) => {
    toggleTaskDone(task.id);
    if (!task.completed && microTasks[activeMissionIndex]?.id === task.id) {
      setFloatingXpText(`+${task.xp || 15} XP Ketenangan!`);
      setTimeout(() => setFloatingXpText(''), 1500);
    }
  };

  const handleCustomMicroAction = () => {
    const action = window.prompt('Tulis 1 langkah mini yang bisa diselesaikan dalam 2 menit:');
    if (action && addCustomMicroAction(action)) {
      setFloatingXpText('Misi 2 menit ditambahkan ✨');
      setTimeout(() => setFloatingXpText(''), 1800);
    }
  };

  const completedCount = microTasks.filter((t) => t.completed).length;

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 gap-6 pb-28">
      {/* Floating XP Toast */}
      {floatingXpText && (
        <div className="fixed top-24 right-1/2 translate-x-1/2 z-50 bg-[#121214] text-white px-5 py-2.5 rounded-full text-xs font-extrabold shadow-xl animate-float-xp flex items-center gap-2">
          <span>🎉</span>
          <span>{floatingXpText}</span>
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
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Zona Nyaman Aktif</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface">
              Fase Fokus Nyantai • 14:22 Sesi Berjalan
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
          <div className="bg-secondary-container text-on-secondary-container px-4 py-2 rounded-full flex items-center gap-2 shadow-[0_2px_0_#121214]">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            <span className="text-xs font-bold">Energy Level: 84% Stabil</span>
          </div>
          <div className="bg-tertiary-container text-on-tertiary-container px-4 py-2 rounded-full flex items-center gap-2 shadow-[0_2px_0_#121214]">
            <span className="material-symbols-outlined text-[18px]">battery_charging_full</span>
            <span className="text-xs font-bold">+{totalXp} XP Ketenangan</span>
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
                Siklus {breathCycle} / {TOTAL_BREATH_CYCLES}
              </span>
            </div>

            {/* Breathing Interactive Sphere Canvas Area */}
            <div
              onClick={handleSphereTap}
              className={`relative w-64 h-64 my-4 flex items-center justify-center select-none group ${isBreathingActive ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
              title={isBreathingActive ? 'Ketuk lingkaran untuk mempercepat siklus napas' : 'Tekan Mulai untuk memulai sesi napas'}
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
              <span className="text-sm font-semibold text-on-surface-variant">Detik</span>
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
                <span>{isBreathingActive ? 'Berhenti' : breathCycle > 0 ? 'Lanjutkan' : 'Mulai'}</span>
              </button>
              {(breathCycle > 0 || isBreathingActive) && (
                <button
                  type="button"
                  onClick={resetBreathing}
                  className="px-4 py-2.5 rounded-full bg-surface-container text-on-surface text-xs font-bold shadow-[0_2px_0_#121214] hover:bg-surface-container-high active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
                  title="Reset siklus ke 0"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>Reset</span>
                </button>
              )}
            </div>
            {!isBreathingActive && breathCycle >= TOTAL_BREATH_CYCLES && (
              <p className="text-xs font-bold text-primary text-center">🎉 8 siklus selesai! Tekan Mulai untuk sesi baru.</p>
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
                Ritme Bebas
              </button>
            </div>
          </div>

          {/* Card 2: Binaural & Fun Soundscapes */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-[0_4px_0_#121214] border border-surface-container flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[24px]">headphones</span>
                <h2 className="text-base sm:text-lg font-bold text-on-surface">Binaural &amp; Fun Soundscapes</h2>
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
                <span className="text-xs font-bold text-center">Hujan Cozy</span>
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
                <span className="text-xs font-bold text-center">Hutan Pinus</span>
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
                <span className="text-xs font-bold text-center">Kafe Santai</span>
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
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-[0_4px_0_#121214] border border-surface-container flex flex-col gap-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-[24px]">local_fire_department</span>
                <h2 className="text-base sm:text-lg font-bold text-on-surface">
                  Bakar &amp; Hancurkan Pikiran Negatif
                </h2>
              </div>
              <span className="bg-error-container text-on-error-container px-2.5 py-1 rounded-full text-xs font-bold">
                Anti-Overthinking
              </span>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Ketik apa pun yang bikin dada sesak, cemas, atau bikin kamu mandek. Hancurkan sampai jadi debu digital!
            </p>

            <div className="relative">
              <textarea
                rows={3}
                value={worryText}
                disabled={isCrushing}
                onChange={(e) => setWorryText(e.target.value)}
                placeholder="Contoh: Takut kerjaan ini dinilai jelek sama tim, ngerasa gak sanggup selesaiin deadline..."
                className={`w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 rounded-xl p-4 text-xs sm:text-sm focus:outline-none focus:bg-surface-container resize-none transition-all ${
                  isCrushing ? 'animate-paper-crush' : ''
                }`}
              />
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1.5 text-on-surface-variant text-xs">
                <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                <span>Teks tidak disimpan di server mana pun.</span>
              </div>
              <button
                type="button"
                onClick={handleCrush}
                disabled={!worryText.trim() || isCrushing}
                className="px-6 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface text-xs font-bold shadow-[0_3px_0_#121214] hover:scale-105 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isCrushing ? 'Meremas...' : 'Remas & Musnahkan!'}</span>
                <span className="text-base">💥</span>
              </button>
            </div>

            {showCrushFeedback && (
              <div className="w-full bg-primary-container text-on-primary-container p-3 rounded-xl text-center text-xs font-bold animate-fadeIn shadow-xs">
                ✨ Pluff! Pikiran itu sudah terlepas. Kamu bebas melangkah lagi!
              </div>
            )}
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
                  Misi 5 Menit {authUser?.name || 'Teman'}!
                </h2>
              </div>
              <div className="bg-secondary-container text-on-secondary-container px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-[0_2px_0_#121214]">
                <span>Overwhelm Terdeteksi</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                <span>Dipecah Mini 🎯</span>
              </div>
            </div>

            {/* Chunky 5-Minute Timer Module with Animated Circular Progress */}
            <div className="bg-surface-container-low rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_2px_0_#121214]">
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
                    Timer Putaran Sekarang
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-on-surface font-mono">
                    {formatTimer(questTime)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface text-xs font-bold shadow-[0_3px_0_#121214] hover:opacity-90 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isTimerRunning ? 'pause' : 'play_arrow'}
                  </span>
                  <span>{isTimerRunning ? 'Jeda Sesaat' : 'Lanjutkan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuestTime(TOTAL_QUEST_TIME)}
                  className="p-2.5 rounded-full bg-surface-container text-on-surface hover:bg-surface-variant shadow-[0_2px_0_#121214] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  title="Reset 5 Menit"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                </button>
              </div>
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
                      disabled={activeMissionIndex !== 0}
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
                        Misi 1
                      </span>
                      <h3 className={`text-sm sm:text-base font-bold text-on-surface ${microTasks[0].completed ? 'line-through' : ''}`}>
                        {microTasks[0].action}
                      </h3>
                    </div>
                  </div>
                  <div className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shrink-0 shadow-xs">
                    <span>+{microTasks[0].xp || 10} XP {microTasks[0].completed ? 'Selesai 🎉' : '< 2 mnt'}</span>
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
                        {microTasks[1].completed ? 'Quest Selesai' : activeMissionIndex === 1 ? 'Quest Sedang Berjalan' : 'Terkunci • Selesaikan Misi 1'}
                      </span>
                    </div>
                    <span className="bg-tertiary text-on-tertiary px-3 py-0.5 rounded-full text-xs font-bold shadow-xs">
                      Misi #2
                    </span>
                  </div>

                  <div>
                    <h3 className={`text-base sm:text-lg font-bold text-on-surface mb-1 ${microTasks[1].completed ? 'line-through' : ''}`}>
                      {microTasks[1].action}
                    </h3>
                    <div className="inline-flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1 rounded-full text-on-surface-variant text-xs font-medium shadow-xs">
                      <span>✨</span>
                      <span>{microTasks[1].guidance || 'Biarin jelek dulu, yang penting jalan!'}</span>
                    </div>
                  </div>

                  {/* Gamified Interactive Controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleTaskCheck(microTasks[1])}
                      disabled={activeMissionIndex !== 1}
                      className="px-4 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold shadow-[0_3px_0_#121214] hover:opacity-90 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>{microTasks[1].completed ? 'Lanjut ke Misi 3 →' : activeMissionIndex === 1 ? 'Tandai Selesai' : 'Selesaikan Misi 1 dulu'}</span>
                      <span className="material-symbols-outlined text-[18px]">done_all</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => sliceTaskSmaller(microTasks[1].id)}
                      disabled={activeMissionIndex !== 1}
                      className="px-4 py-2.5 rounded-full bg-surface-container-lowest text-on-surface text-xs font-bold shadow-[0_3px_0_#121214] hover:bg-surface-container active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>Kecilin Lagi</span>
                      <span className="text-sm">🤏</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestTime(TOTAL_QUEST_TIME)}
                      className="px-3.5 py-2.5 rounded-full bg-surface-container-lowest text-on-surface-variant text-xs font-bold shadow-[0_3px_0_#121214] hover:bg-surface-container active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">timer</span>
                      <span>5 Menit Baru</span>
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
                      disabled={activeMissionIndex !== 2}
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
                        {microTasks[2].completed ? 'Misi 3 • Selesai' : activeMissionIndex === 2 ? 'Misi 3 • Quest Aktif' : 'Misi 3 • Terkunci'}
                      </span>
                      <h3 className={`text-xs sm:text-sm font-bold text-on-surface ${microTasks[2].completed ? 'line-through' : ''}`}>
                        {microTasks[2].action}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTaskCheck(microTasks[2])}
                    disabled={activeMissionIndex !== 2}
                    className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-on-primary shadow-xs transition-all disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant"
                  >
                    {microTasks[2].completed ? 'Selesai ✨' : activeMissionIndex === 2 ? 'Tandai Selesai' : 'Setelah Misi 2'}
                  </button>
                </div>
              )}
            </div>

            {/* Playful Encouragement Banner */}
            <div className="bg-secondary-container/40 rounded-2xl p-4 flex items-center gap-3 mt-1 shadow-xs">
              <span className="text-2xl shrink-0">🚀</span>
              <p className="text-xs sm:text-sm text-on-surface font-medium leading-relaxed">
                <strong>Momentum &gt; Perfeksionisme!</strong> 3 menit gerak jauh lebih juara daripada overthinking seharian. Let's squeeze it!
              </p>
            </div>
          </div>

          {/* Micro Visualizer: Streak & Flow Rhythm */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-[0_4px_0_#121214] border border-surface-container flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">ssid_chart</span>
                <span className="text-sm font-bold text-on-surface">Aliran Dopamin Hari Ini</span>
              </div>
              <span className="text-xs font-bold text-primary">
                {completedCount >= 3 ? 'Semua Misi Tuntas 🔥' : 'Fokus Berkelanjutan'}
              </span>
            </div>

            {/* Inline SVG Mini Bar Graph for Focus Pulses */}
            <div className="w-full h-24 flex items-end justify-between gap-2 pt-4 px-2">
              <div className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                <div className="w-full bg-primary-container rounded-t-lg h-12 group-hover:h-16 transition-all group-hover:bg-primary"></div>
                <span className="text-[10px] text-on-surface-variant font-mono">09:00</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                <div className="w-full bg-secondary-container rounded-t-lg h-8 group-hover:h-14 transition-all group-hover:bg-secondary"></div>
                <span className="text-[10px] text-on-surface-variant font-mono">10:30</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                <div className="w-full bg-tertiary-container rounded-t-lg h-16 group-hover:h-20 transition-all group-hover:bg-tertiary"></div>
                <span className="text-[10px] text-on-surface-variant font-mono">12:00</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                <div className="w-full bg-primary rounded-t-lg h-20 shadow-sm group-hover:scale-105 transition-all"></div>
                <span className="text-[10px] text-primary font-bold">Sekarang</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1 opacity-40 group cursor-pointer">
                <div className="w-full bg-surface-container-highest rounded-t-lg h-6 group-hover:h-10 transition-all"></div>
                <span className="text-[10px] text-on-surface-variant font-mono">15:00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING MINI DOCK / INTERACTIVE CONTROLS */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-inverse-surface text-inverse-on-surface px-6 py-3.5 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.25)] flex items-center gap-4 sm:gap-6 border border-inverse-on-surface/15 backdrop-blur-md">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 100, behavior: 'smooth' })}
          className="flex items-center gap-2 hover:text-primary-fixed active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">self_improvement</span>
          <span className="text-xs font-bold hidden sm:inline">Tarik Napas Cepat</span>
        </button>

        <div className="w-px h-4 bg-inverse-on-surface/30"></div>

        <button
          type="button"
          onClick={handleCustomMicroAction}
          className="flex items-center gap-2 hover:text-secondary-fixed active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">add_task</span>
          <span className="text-xs font-bold hidden sm:inline">+ Misi 2-Mnt</span>
        </button>

        <div className="w-px h-4 bg-inverse-on-surface/30"></div>

        <button
          type="button"
          onClick={() => setStep(3)}
          className="flex items-center gap-2 hover:text-primary-fixed active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">spa</span>
          <span className="text-xs font-bold hidden sm:inline">Mood Garden 🌿</span>
        </button>

        <div className="w-px h-4 bg-inverse-on-surface/30"></div>

        <button
          type="button"
          onClick={() => void saveCurrentSession()}
          className="flex items-center gap-2 hover:text-primary-fixed active:scale-95 transition-all cursor-pointer"
          title="Simpan ringkasan sesi"
        >
          <span className="material-symbols-outlined text-[20px]">save</span>
          <span className="text-xs font-bold hidden sm:inline">{vaultSavedNotice ? 'Tersimpan' : 'Simpan Sesi'}</span>
        </button>
      </div>
    </div>
  );
}
