import rainTrack from '../music/rainBGM.mp3.mpeg';
import forestTrack from '../music/forestBGM.mp3.mpeg';
import cafeTrack from '../music/cafeBGM.mp3.mpeg';

const TRACKS = {
  rain: rainTrack,
  forest: forestTrack,
  cafe: cafeTrack,
};

const FADE_MS = 700;

/**
 * Plays real looping music tracks for the soundscape picker (rain / forest / cafe)
 * and keeps the lightweight WebAudio UI effects (bell chime, success, crush burst)
 * used by the breathing, quest and worry-crush interactions.
 *
 * Public API is unchanged from the previous procedural engine so FlowContext /
 * FlowStudio need no edits: playMode, stop, stopImmediate, setVolume, getMode,
 * isPlaying, playSuccessEffect, playBellChime, playCrushBurst.
 */
class SoundscapeEngine {
  constructor() {
    this.volume = 0.65;
    this.currentMode = null;
    this.audio = null;
    this.fadeTimer = null;
    // WebAudio context is only for the short UI effect sounds, created lazily.
    this.ctx = null;
    this.masterGain = null;
  }

  ensureAudio() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.preload = 'auto';
      this.audio.volume = this.volume;
    }
    return this.audio;
  }

  clearFade() {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  fadeTo(target, done) {
    this.clearFade();
    const el = this.audio;
    if (!el) {
      if (done) done();
      return;
    }
    const steps = 14;
    const stepMs = FADE_MS / steps;
    const start = el.volume;
    const delta = (target - start) / steps;
    let i = 0;
    this.fadeTimer = setInterval(() => {
      i += 1;
      const next = start + delta * i;
      el.volume = Math.max(0, Math.min(1, next));
      if (i >= steps) {
        this.clearFade();
        el.volume = Math.max(0, Math.min(1, target));
        if (done) done();
      }
    }, stepMs);
  }

  /**
   * Toggle a soundscape. Returns true if the requested mode is now playing,
   * false if it was toggled off (same contract as before).
   */
  playMode(mode = 'rain') {
    if (!TRACKS[mode]) return false;

    // Tapping the active track stops it.
    if (this.currentMode === mode) {
      this.stop();
      return false;
    }

    const el = this.ensureAudio();
    this.clearFade();

    this.currentMode = mode;
    el.src = TRACKS[mode];
    el.currentTime = 0;
    el.volume = 0;

    const startPlayback = () => {
      const playPromise = el.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Autoplay can be blocked until a user gesture; the click that
          // triggered this counts as one, but guard just in case.
        });
      }
      this.fadeTo(this.volume);
    };

    startPlayback();
    return true;
  }

  stop() {
    this.clearFade();
    if (this.audio) {
      const el = this.audio;
      this.fadeTo(0, () => {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      });
    }
    this.currentMode = null;
  }

  stopImmediate() {
    this.clearFade();
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    this.currentMode = null;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.audio && !this.fadeTimer) {
      this.audio.volume = this.volume;
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  getMode() {
    return this.currentMode;
  }

  isPlaying() {
    return this.currentMode !== null;
  }

  // ----- Short UI effect sounds (WebAudio, unchanged behaviour) -----

  initEffects() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  createNoiseBuffer(type = 'brown') {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'brown') {
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  playSuccessEffect() {
    try {
      this.initEffects();
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
      /* ignore */
    }
  }

  playBellChime() {
    try {
      this.initEffects();
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
      /* ignore */
    }
  }

  playPopSnip() {
    try {
      this.initEffects();
      const startAt = this.ctx.currentTime;

      // A quick upward "snip" tone — light and playful, for breaking a task down smaller.
      const oscillator = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(520, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(980, startAt + 0.09);
      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.linearRampToValueAtTime(0.06, startAt + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.14);
      oscillator.connect(noteGain);
      noteGain.connect(this.masterGain);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.16);

      // A brief noise tick to give it a tactile "snip" texture.
      const tickSource = this.ctx.createBufferSource();
      tickSource.buffer = this.createNoiseBuffer('white');
      const tickFilter = this.ctx.createBiquadFilter();
      tickFilter.type = 'highpass';
      tickFilter.frequency.setValueAtTime(2500, startAt);
      const tickGain = this.ctx.createGain();
      tickGain.gain.setValueAtTime(0.05, startAt);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.05);
      tickSource.connect(tickFilter);
      tickFilter.connect(tickGain);
      tickGain.connect(this.masterGain);
      tickSource.start(startAt);
      tickSource.stop(startAt + 0.05);
    } catch {
      /* ignore */
    }
  }

  playCrushBurst() {
    try {
      this.initEffects();
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
      /* ignore */
    }
  }
}

export const audioEngine = new SoundscapeEngine();
