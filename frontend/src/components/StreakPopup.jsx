import { useEffect, useState } from 'react';

const RING_FLAMES = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  angle: index * 30,
  delay: `${(index % 4) * 0.12}s`,
}));

const EMBERS = Array.from({ length: 20 }, (_, index) => ({
  id: index,
  left: 8 + Math.random() * 84,
  bottom: 2 + Math.random() * 34,
  size: 5 + Math.random() * 9,
  delay: `${Math.random() * 1.4}s`,
  duration: `${1.9 + Math.random() * 1.5}s`,
  drift: `${(Math.random() - 0.5) * 120}px`,
}));

const flameGradient = 'linear-gradient(180deg, #fff7bd 0%, #ffe066 22%, #ffb21d 48%, #ff6b1a 72%, #e5382d 100%)';

function playFireCelebrationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.38, ctx.currentTime);
    master.connect(ctx.destination);

    // A filtered noise swell gives the effect of a flame suddenly catching.
    const length = Math.floor(ctx.sampleRate * 1.05);
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
    filter.frequency.setValueAtTime(280, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.28);
    filter.frequency.exponentialRampToValueAtTime(360, ctx.currentTime + 1.05);
    fireGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    fireGain.gain.exponentialRampToValueAtTime(0.72, ctx.currentTime + 0.12);
    fireGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.05);
    noise.connect(filter);
    filter.connect(fireGain);
    fireGain.connect(master);
    noise.start();
    noise.stop(ctx.currentTime + 1.05);

    // Crisp micro-pops add a short crackle texture without needing an audio file.
    for (let i = 0; i < 9; i++) {
      const startAt = ctx.currentTime + 0.08 + Math.random() * 0.72;
      const pop = ctx.createOscillator();
      const popGain = ctx.createGain();
      pop.type = 'square';
      pop.frequency.setValueAtTime(650 + Math.random() * 1300, startAt);
      popGain.gain.setValueAtTime(0.035, startAt);
      popGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.035);
      pop.connect(popGain);
      popGain.connect(master);
      pop.start(startAt);
      pop.stop(startAt + 0.04);
    }

    window.setTimeout(() => ctx.close(), 1400);
  } catch {
    // Audio is decorative. A blocked AudioContext must not block the popup.
  }
}

export default function StreakPopup({ streakDays, onDone }) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    playFireCelebrationSound();
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), 3000);
    const closeTimer = window.setTimeout(() => onDone?.(), 3450);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(closeTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-hidden bg-[#160604] transition-opacity duration-[450ms] ${isLeaving ? 'opacity-0' : 'opacity-100'}`}
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,111,20,0.4)_0%,_rgba(93,20,8,0.45)_35%,_rgba(22,6,4,0.98)_78%)]" />

      {/* Fire embers travel upward through the entire scene. */}
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

      <section className={`relative z-10 flex h-full flex-col items-center justify-center px-6 text-center transition-all duration-[450ms] ${isLeaving ? 'scale-90 opacity-0' : 'scale-100 opacity-100'} animate-streak-celebration-enter`}>
        <p className="mb-3 text-xs font-bold tracking-[0.28em] text-orange-100/70">STREAK MENYALA</p>

        <div className="relative flex h-[23rem] w-[23rem] items-center justify-center sm:h-[31rem] sm:w-[31rem]">
          <span className="absolute inset-8 rounded-full bg-orange-500/30 blur-3xl animate-streak-fire-glow" />
          <span className="absolute inset-12 rounded-full border border-orange-200/25 animate-streak-ring-pulse" />

          {/* Orbiting flames provide the lively streak burst around the main fire. */}
          <div className="absolute inset-0 animate-streak-orbit">
            {RING_FLAMES.map((flame) => (
              <span
                key={flame.id}
                className="absolute left-1/2 top-1/2 flex h-1/2 w-0 -translate-x-1/2 origin-bottom justify-center"
                style={{ transform: `translateX(-50%) rotate(${flame.angle}deg)` }}
              >
                <span
                  className="material-symbols-outlined mt-1 text-[33px] bg-clip-text text-transparent animate-streak-orbit-flame"
                  style={{ fontVariationSettings: "'FILL' 1", backgroundImage: flameGradient, animationDelay: flame.delay }}
                >
                  local_fire_department
                </span>
              </span>
            ))}
          </div>

          {/* Three flame layers create an animated fire silhouette with a real fire gradient. */}
          <span
            className="absolute material-symbols-outlined text-[285px] sm:text-[395px] bg-clip-text text-transparent opacity-75 blur-[1px] animate-streak-fire-back"
            style={{ fontVariationSettings: "'FILL' 1", backgroundImage: 'linear-gradient(180deg, #ffd43b 0%, #ff922b 48%, #e5382d 100%)' }}
          >
            local_fire_department
          </span>
          <span
            className="relative material-symbols-outlined text-[250px] sm:text-[350px] bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(255,91,18,0.8)] animate-streak-fire-main"
            style={{ fontVariationSettings: "'FILL' 1", backgroundImage: flameGradient }}
          >
            local_fire_department
          </span>
          <span
            className="absolute material-symbols-outlined text-[125px] sm:text-[175px] bg-clip-text text-transparent animate-streak-fire-core"
            style={{ fontVariationSettings: "'FILL' 1", backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #fff4b8 48%, #ffd43b 100%)' }}
          >
            local_fire_department
          </span>
        </div>

        <div className="-mt-7 flex flex-col items-center animate-streak-message-enter">
          <p className="text-3xl font-black tracking-tight text-white sm:text-5xl">Streak Menyala!</p>
          <p className="mt-2 text-base font-semibold text-orange-100 sm:text-lg">
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, #ffe066, #ff922b, #ff5c33)' }}>{streakDays} Hari</span> beruntun — pertahankan apinya.
          </p>
        </div>
      </section>
    </div>
  );
}
