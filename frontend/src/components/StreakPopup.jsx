import { useEffect } from 'react';

const EMBERS = Array.from({ length: 22 }, (_, index) => ({
  id: index,
  left: 6 + Math.random() * 88,
  bottom: 0 + Math.random() * 28,
  size: 4 + Math.random() * 9,
  delay: `${Math.random() * 1.6}s`,
  duration: `${1.9 + Math.random() * 1.6}s`,
  drift: `${(Math.random() - 0.5) * 130}px`,
}));

const flameGradient = 'linear-gradient(180deg, #fff7bd 0%, #ffe066 18%, #ffb21d 42%, #ff6b1a 68%, #e5382d 88%, #b3221a 100%)';

function playFireCelebrationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.65, ctx.currentTime);
    master.connect(ctx.destination);

    // A filtered noise swell gives the effect of a flame roaring to life.
    const length = Math.floor(ctx.sampleRate * 1.3);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.035) / 1.035;
      samples[i] = brown * 4;
    }

    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const fireGain = ctx.createGain();
    noise.buffer = buffer;
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(0.7, ctx.currentTime);
    filter.frequency.setValueAtTime(260, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(1500, ctx.currentTime + 0.3);
    filter.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 1.3);
    fireGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    fireGain.gain.exponentialRampToValueAtTime(1.1, ctx.currentTime + 0.13);
    fireGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.3);
    noise.connect(filter);
    filter.connect(fireGain);
    fireGain.connect(master);
    noise.start();
    noise.stop(ctx.currentTime + 1.3);

    // A low woosh underlines the initial ignition.
    const woosh = ctx.createOscillator();
    const wooshGain = ctx.createGain();
    woosh.type = 'sawtooth';
    woosh.frequency.setValueAtTime(120, ctx.currentTime);
    woosh.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.5);
    wooshGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    wooshGain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.08);
    wooshGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    woosh.connect(wooshGain);
    wooshGain.connect(master);
    woosh.start();
    woosh.stop(ctx.currentTime + 0.6);

    // Crisp micro-pops add a crackle texture without needing an audio file.
    for (let i = 0; i < 12; i++) {
      const startAt = ctx.currentTime + 0.08 + Math.random() * 1.1;
      const pop = ctx.createOscillator();
      const popGain = ctx.createGain();
      pop.type = 'square';
      pop.frequency.setValueAtTime(650 + Math.random() * 1400, startAt);
      popGain.gain.setValueAtTime(0.07, startAt);
      popGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.035);
      pop.connect(popGain);
      popGain.connect(master);
      pop.start(startAt);
      pop.stop(startAt + 0.04);
    }

    window.setTimeout(() => ctx.close(), 1700);
  } catch {
    // Audio is decorative. A blocked AudioContext must not block the popup.
  }
}

export default function StreakPopup({ streakDays, onDone }) {
  useEffect(() => {
    playFireCelebrationSound();
  }, []);

  const handleClose = () => {
    onDone?.();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex h-screen w-screen cursor-pointer flex-col items-center justify-center overflow-hidden bg-black/55 backdrop-blur-sm px-6 text-center animate-streak-fade-in"
      role="status"
      aria-live="polite"
      onClick={handleClose}
    >
      {/* Fire embers drift upward around the flame without touching the background. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {EMBERS.map((ember) => (
          <span
            key={ember.id}
            className="absolute rounded-full bg-gradient-to-br from-yellow-200 via-orange-400 to-red-500 animate-streak-ember"
            style={{
              left: `${ember.left}%`,
              bottom: `${ember.bottom}%`,
              width: `${ember.size}px`,
              height: `${ember.size}px`,
              animationDelay: ember.delay,
              animationDuration: ember.duration,
              '--drift': ember.drift,
            }}
          />
        ))}
      </div>

      <section
        className="relative z-10 flex w-full max-w-3xl flex-col items-center justify-center animate-streak-celebration-enter"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="mb-4 text-xs font-bold tracking-[0.32em] text-orange-100/80">STREAK MENYALA</p>

        <div className="relative flex items-center justify-center">
          {/* Glow pulsing softly behind the flame. */}
          <span className="absolute inset-0 m-auto h-[70%] w-[70%] rounded-full bg-orange-500/35 blur-3xl animate-streak-fire-glow" />
          <span className="absolute inset-0 m-auto h-[55%] w-[55%] rounded-full border border-orange-200/25 animate-streak-ring-pulse" />

          {/* The large central flame stays a static gradient glyph as requested. */}
          <span
            className="relative material-symbols-outlined bg-clip-text text-transparent"
            style={{
              fontVariationSettings: "'FILL' 1",
              backgroundImage: flameGradient,
              fontSize: 'min(55vh, 55vw)',
              lineHeight: 1,
              filter: 'drop-shadow(0 0 55px rgba(255, 91, 18, 0.8))',
            }}
          >
            local_fire_department
          </span>
        </div>

        <div className="-mt-4 flex flex-col items-center animate-streak-message-enter">
          <p className="bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl" style={{ backgroundImage: 'linear-gradient(90deg, #fff7bd, #ffb21d, #ff5c33)' }}>
            {streakDays}
          </p>
          <p className="mt-1 text-2xl font-black tracking-tight text-white sm:text-4xl">Hari Beruntun!</p>
          <p className="mt-3 text-base font-semibold text-orange-100 sm:text-lg">
            Api semangatmu makin membara — <span className="text-yellow-200">pertahankan terus!</span>
          </p>
          <p className="mt-5 text-xs font-medium text-orange-100/60">Ketuk di mana saja untuk menutup</p>
        </div>
      </section>
    </div>
  );
}
