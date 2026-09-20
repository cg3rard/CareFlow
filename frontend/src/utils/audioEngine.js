class ProceduralSoundscapeEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.activeSource = null;
    this.currentMode = null;
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
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      } else {
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

    if (this.currentMode === mode) {
      this.stop();
      return false;
    }

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

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.8, this.ctx.currentTime);

    source.connect(filter);
    filter.connect(this.masterGain);

    source.start();
    this.activeSource = source;

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
    }
  }

  playSuccessEffect() {
    try {
      this.init();
      const startAt = this.ctx.currentTime;
      const notes = [
        { frequency: 659.25, offset: 0, duration: 0.12 },
        { frequency: 880, offset: 0.1, duration: 0.2 },
      ];

      notes.forEach(({ frequency, offset, duration }) => {
        const oscillator = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const noteStart = startAt + offset;
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        noteGain.gain.setValueAtTime(0.0001, noteStart);
        noteGain.gain.exponentialRampToValueAtTime(0.075, noteStart + 0.025);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
        oscillator.connect(noteGain);
        noteGain.connect(this.masterGain);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + duration + 0.01);
      });
    } catch {
    }
  }

  playBellChime() {
    try {
      this.init();
      const startAt = this.ctx.currentTime;
      const tones = [
        { frequency: 1318.51, offset: 0, gain: 0.05, duration: 0.35 },
        { frequency: 987.77, offset: 0.09, gain: 0.065, duration: 0.85 },
      ];

      tones.forEach(({ frequency, offset, gain, duration }) => {
        const noteStart = startAt + offset;
        const oscillator = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const noteGain = this.ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, noteStart);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, noteStart);
        filter.Q.setValueAtTime(0.4, noteStart);

        noteGain.gain.setValueAtTime(0.0001, noteStart);
        noteGain.gain.linearRampToValueAtTime(gain, noteStart + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);

        oscillator.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(this.masterGain);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + duration + 0.02);
      });
    } catch {
    }
  }

  playCrushBurst() {
    try {
      this.init();
      const startAt = this.ctx.currentTime;

      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(120, startAt);
      sub.frequency.exponentialRampToValueAtTime(32, startAt + 0.45);
      subGain.gain.setValueAtTime(0.0001, startAt);
      subGain.gain.linearRampToValueAtTime(0.55, startAt + 0.02);
      subGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.7);
      sub.connect(subGain);
      subGain.connect(this.masterGain);
      sub.start(startAt);
      sub.stop(startAt + 0.72);

      const subLayer = this.ctx.createOscillator();
      const subLayerGain = this.ctx.createGain();
      subLayer.type = 'sine';
      subLayer.frequency.setValueAtTime(70, startAt);
      subLayer.frequency.exponentialRampToValueAtTime(24, startAt + 0.5);
      subLayerGain.gain.setValueAtTime(0.0001, startAt);
      subLayerGain.gain.linearRampToValueAtTime(0.35, startAt + 0.03);
      subLayerGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.65);
      subLayer.connect(subLayerGain);
      subLayerGain.connect(this.masterGain);
      subLayer.start(startAt);
      subLayer.stop(startAt + 0.67);

      const thudSource = this.ctx.createBufferSource();
      thudSource.buffer = this.createNoiseBuffer('brown');
      const thudFilter = this.ctx.createBiquadFilter();
      thudFilter.type = 'lowpass';
      thudFilter.frequency.setValueAtTime(320, startAt);
      thudFilter.frequency.exponentialRampToValueAtTime(90, startAt + 0.2);
      const thudGain = this.ctx.createGain();
      thudGain.gain.setValueAtTime(0.55, startAt);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);
      thudSource.connect(thudFilter);
      thudFilter.connect(thudGain);
      thudGain.connect(this.masterGain);
      thudSource.start(startAt);
      thudSource.stop(startAt + 0.2);

      const rumbleSource = this.ctx.createBufferSource();
      rumbleSource.buffer = this.createNoiseBuffer('brown');
      const rumbleFilter = this.ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(500, startAt);
      rumbleFilter.frequency.exponentialRampToValueAtTime(60, startAt + 0.8);
      const rumbleGain = this.ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.3, startAt + 0.02);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.85);
      rumbleSource.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(this.masterGain);
      rumbleSource.start(startAt);
      rumbleSource.stop(startAt + 0.86);
    } catch {
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