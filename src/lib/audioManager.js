// Web Audio API Synthesizer Sound Engine & Web Speech AI Voice for AI-DEATH ARENA
class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('arena_sound_muted') === 'true';
    this.listeners = new Set();
    this.setupGlobalUnlock();
    this.setupVisibilityHandler();
    this.voices = [];
    this.selectedVoice = null;
    this.initSpeech();
  }

  // Pre-unlock AudioContext on the first user interaction anywhere on page
  setupGlobalUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.initContext();
      if (this.ctx && this.ctx.state === 'running') {
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('pointerdown', unlock);
      }
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
  }

  // Immediately suspend audio when tab/app is backgrounded
  setupVisibilityHandler() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.ctx && this.ctx.state === 'running') {
        try {
          this.ctx.suspend();
        } catch (e) {
          console.warn('Audio suspend error', e);
        }
      }
    });
  }

  initSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        try {
          this.voices = window.speechSynthesis.getVoices() || [];
          if (this.voices.length > 0) {
            // Pick a high-quality natural sounding English voice
            const preferred = this.voices.find(v =>
              v.lang.startsWith('en') && (
                v.name.includes('Google') ||
                v.name.includes('Natural') ||
                v.name.includes('Samantha') ||
                v.name.includes('Jenny') ||
                v.name.includes('Guy') ||
                v.name.includes('Aria') ||
                v.name.includes('Zira') ||
                v.name.includes('David') ||
                v.name.includes('Alex') ||
                v.name.includes('Daniel')
              )
            );
            const englishFallback = this.voices.find(v => v.lang.startsWith('en'));
            this.selectedVoice = preferred || englishFallback || this.voices[0] || null;
          }
        } catch (e) {
          console.warn('Speech synthesis voice load error', e);
        }
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  toggleMute() {
    this.initContext();
    this.isMuted = !this.isMuted;
    localStorage.setItem('arena_sound_muted', this.isMuted ? 'true' : 'false');
    if (this.isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
    }
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

  speakVoice(text, options = {}) {
    if (this.isMuted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      // Cancel previous speech to prevent overlapping or queuing delay
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      } else {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const fallback = voices.find(v => v.lang.startsWith('en')) || voices[0];
          utterance.voice = fallback;
          this.selectedVoice = fallback;
        }
      }

      utterance.rate = options.rate !== undefined ? options.rate : 1.0;
      utterance.pitch = options.pitch !== undefined ? options.pitch : 1.0;
      utterance.volume = options.volume !== undefined ? options.volume : 1.0;

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis speak error:', e);
    }
  }

  speakCountdown(number) {
    if (this.isMuted) return;
    const words = {
      3: 'Three!',
      2: 'Two!',
      1: 'One!',
      0: 'Go!'
    };
    const word = words[number];
    if (word) {
      this.speakVoice(word, {
        rate: 1.0,
        pitch: number === 0 ? 1.2 : 1.05,
        volume: 1.0
      });
    }
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
      // Clear, musical rising chime for numbers 3, 2, 1
      const pitches = { 4: 440, 3: 523.25, 2: 659.25, 1: 783.99 };
      const freq = pitches[number] || 523.25;
      this.playBeep(freq, 'sine', 0.22, 0.5);
    } else {
      // Energetic "GO!" launch chime
      this.playBeep(1046.5, 'triangle', 0.35, 0.65);
      setTimeout(() => this.playBeep(1318.51, 'sine', 0.3, 0.55), 80);
    }
    // Synchronized AI voice announcement
    this.speakCountdown(number);
  }

  playCorrect() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      setTimeout(() => this.playBeep(freq, 'sine', 0.18, 0.35), i * 80);
    });
  }

  playWrong() {
    if (this.isMuted) return;
    this.playBeep(180, 'sawtooth', 0.35, 0.4);
  }

  playRoundStart() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    [300, 450, 600, 900].forEach((freq, i) => {
      setTimeout(() => this.playBeep(freq, 'triangle', 0.25, 0.4), i * 90);
    });
  }

  playRoundEnd() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    [587.33, 659.25, 783.99, 880].forEach((freq, i) => {
      setTimeout(() => this.playBeep(freq, 'sine', 0.3, 0.45), i * 110);
    });
  }

  playFinalFanfare() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playBeep(freq, 'triangle', 0.45, 0.75), i * 140);
    });
  }

  playApplauseClapping(durationSec = 3.5) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const totalClaps = Math.floor(durationSec * 35); // ~35 claps per second from crowd

      // Generate a short 0.05s noise buffer for single clap snap
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

        // Bandpass filter for natural palm clap frequency
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000 + Math.random() * 1800; // 1000Hz - 2800Hz
        filter.Q.value = 1.2;

        const gain = this.ctx.createGain();
        const clapVolume = 0.15 + Math.random() * 0.4; // High density applause volume
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
