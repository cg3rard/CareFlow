/**
 * Multi-Soundscape Procedural Web Audio Engine
 * Supports:
 * 1. "rain" (Hujan Cozy 🌧️)
 * 2. "forest" (Hutan Pinus 🌲)
 * 3. "cafe" (Kafe Santai ☕)
 * 100% offline, zero network requests, zero broken audio files during demo!
 */

class ProceduralSoundscapeEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.activeSource = null;
    this.currentMode = null; // 'rain' | 'forest' | 'cafe' | null
    this.timerId = null;
    this.volume = 0.65;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  createNoiseBuffer(type = 'pink') {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let lastOut = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'brown') {
        // Brownian noise (warm, deep cafe rumble)
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      } else {
        // Pink noise (soothing rain & wind)
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  playMode(mode = 'rain') {
    this.init();

    // If currently playing the same mode, stop it (toggle off)
    if (this.currentMode === mode) {
      this.stop();
      return false;
    }

    // Stop current sound if different
    this.stopImmediate();

    this.currentMode = mode;

    if (mode === 'rain') {
      this.startRain();
    } else if (mode === 'forest') {
      this.startForest();
    } else if (mode === 'cafe') {
      this.startCafe();
    }

    return true;
  }

  startRain() {
    const buffer = this.createNoiseBuffer('pink');
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Keep the rain warm and deliberately quiet: remove the sharp upper hiss
    // before applying a dedicated gain, independent from other soundscapes.
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(110, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.7, this.ctx.currentTime);

    const rainGain = this.ctx.createGain();
    rainGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    rainGain.gain.linearRampToValueAtTime(0.28, this.ctx.currentTime + 1.2);

    source.connect(highpass);
    highpass.connect(filter);
    filter.connect(rainGain);
    rainGain.connect(this.masterGain);

    source.start();
    this.activeSource = source;

    // Sparse droplets add texture without repeatedly cutting through the ambience.
    const scheduleDroplet = () => {
      if (this.currentMode !== 'rain') return;
      this.playDroplet();
      this.timerId = setTimeout(scheduleDroplet, Math.random() * 2200 + 2400);
    };
    this.timerId = setTimeout(scheduleDroplet, 1400);
  }

  startForest() {
    const buffer = this.createNoiseBuffer('pink');
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Swaying wind in trees filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.8, this.ctx.currentTime);

    source.connect(filter);
    filter.connect(this.masterGain);

    source.start();
    this.activeSource = source;

    // Occasional gentle bird chirp
    const scheduleChirp = () => {
      if (this.currentMode !== 'forest') return;
      this.playChirp();
      this.timerId = setTimeout(scheduleChirp, Math.random() * 4000 + 2500);
    };
    scheduleChirp();
  }

  startCafe() {
    const buffer = this.createNoiseBuffer('brown');
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, this.ctx.currentTime);

    source.connect(filter);
    filter.connect(this.masterGain);

    source.start();
    this.activeSource = source;
  }

  playDroplet() {
    if (!this.ctx || this.currentMode !== 'rain') return;
    try {
      const osc = this.ctx.createOscillator();
      const dropGain = this.ctx.createGain();
      const freq = Math.random() * 550 + 900;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.72, this.ctx.currentTime + 0.12);

      dropGain.gain.setValueAtTime(0.009, this.ctx.currentTime);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);

      osc.connect(dropGain);
      dropGain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch {
      // Audio enhancement failure does not affect the active soundscape state.
    }
  }

  playChirp() {
    if (!this.ctx || this.currentMode !== 'forest') return;
    try {
      const osc = this.ctx.createOscillator();
      const chirpGain = this.ctx.createGain();
      osc.type = 'sine';
      const baseFreq = Math.random() * 600 + 2200;
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq + 700, this.ctx.currentTime + 0.06);
      osc.frequency.exponentialRampToValueAtTime(baseFreq + 300, this.ctx.currentTime + 0.14);

      chirpGain.gain.setValueAtTime(0.015, this.ctx.currentTime);
      chirpGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);

      osc.connect(chirpGain);
      chirpGain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.16);
    } catch {
      // Audio enhancement failure does not affect the active soundscape state.
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  stop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
      // Audio enhancement failure does not affect the active soundscape state.
    }
      this.activeSource = null;
    }
    this.currentMode = null;
  }

  stopImmediate() {
    this.stop();
  }

  getMode() {
    return this.currentMode;
  }

  isPlaying() {
    return this.currentMode !== null;
  }
}

export const audioEngine = new ProceduralSoundscapeEngine();
