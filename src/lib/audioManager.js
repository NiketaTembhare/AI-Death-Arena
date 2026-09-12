// Web Audio API Synthesizer Sound Engine for AI-DEATH ARENA
class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('arena_sound_muted') === 'true';
    this.listeners = new Set();
    this.activeTimeouts = [];

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // Issue 4 Fix: Pause all audio when tab/app loses visibility
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pauseAllAudio();
        } else {
          this.initContext();
        }
      });

      // User interaction listener to reliably unlock Web Audio API Context
      const unlockAudio = () => {
        this.initContext();
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('click', unlockAudio);
      };
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('click', unlockAudio, { passive: true });
    }
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  pauseAllAudio() {
    this.activeTimeouts.forEach((id) => clearTimeout(id));
    this.activeTimeouts = [];

    if (this.ctx && this.ctx.state === 'running') {
      try {
        this.ctx.suspend();
      } catch (e) {
        console.warn('Audio suspend error', e);
      }
    }
  }

  safeTimeout(fn, ms) {
    const id = setTimeout(() => {
      this.activeTimeouts = this.activeTimeouts.filter((tId) => tId !== id);
      fn();
    }, ms);
    this.activeTimeouts.push(id);
    return id;
  }

  toggleMute() {
    this.initContext();
    this.isMuted = !this.isMuted;
    localStorage.setItem('arena_sound_muted', this.isMuted ? 'true' : 'false');
    this.notify();
    return this.isMuted;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => fn(this.isMuted));
  }

  playBeep(freq = 440, type = 'sine', duration = 0.15, gainVal = 0.3) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  playCountdownBeep(number) {
    if (this.isMuted) return;
    this.initContext();
    if (number > 0) {
      // Clear, musical rising chime for numbers 4, 3, 2, 1
      const pitches = { 4: 440, 3: 523.25, 2: 659.25, 1: 783.99 };
      const freq = pitches[number] || 523.25;
      this.playBeep(freq, 'sine', 0.22, 0.55);
    } else {
      // Energetic "GO!" launch chime
      this.playBeep(1046.5, 'triangle', 0.35, 0.65);
      this.safeTimeout(() => this.playBeep(1318.51, 'sine', 0.3, 0.55), 80);
    }
  }

  playCorrect() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.safeTimeout(() => this.playBeep(freq, 'sine', 0.18, 0.35), i * 80);
    });
  }

  playWrong() {
    if (this.isMuted) return;
    this.playBeep(180, 'sawtooth', 0.35, 0.45);
  }

  playRoundStart() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    [300, 450, 600, 900].forEach((freq, i) => {
      this.safeTimeout(() => this.playBeep(freq, 'triangle', 0.25, 0.45), i * 90);
    });
  }

  playRoundEnd() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    [587.33, 659.25, 783.99, 880].forEach((freq, i) => {
      this.safeTimeout(() => this.playBeep(freq, 'sine', 0.3, 0.45), i * 110);
    });
  }

  playFinalFanfare() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      this.safeTimeout(() => this.playBeep(freq, 'triangle', 0.4, 0.75), i * 140);
    });
  }

  playApplauseClapping(durationSec = 4.5) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const totalClaps = Math.floor(durationSec * 45); // High density crowd clapping

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      for (let i = 0; i < totalClaps; i++) {
        const clapTime = now + (Math.random() * durationSec);
        
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 900 + Math.random() * 2200;
        filter.Q.value = 1.1;

        const gain = this.ctx.createGain();
        const clapVolume = 0.25 + Math.random() * 0.45; // Increased volume for host/projector screen
        gain.gain.setValueAtTime(clapVolume, clapTime);
        gain.gain.exponentialRampToValueAtTime(0.001, clapTime + 0.05);

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        whiteNoise.start(clapTime);
        whiteNoise.stop(clapTime + 0.06);
      }
    } catch (e) {
      console.warn('Error synthesizing applause sound:', e);
    }
  }
}

export const audioManager = new AudioManager();
