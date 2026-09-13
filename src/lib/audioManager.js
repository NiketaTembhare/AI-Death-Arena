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
      this.initContext();

      // Cancel previous speech to prevent queuing overlap
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();
      } catch (err) {
        // ignore cancel error
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';

      // Load available voices dynamically
      const voices = window.speechSynthesis.getVoices() || [];
      if (voices.length > 0) {
        const preferred = voices.find(v =>
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
        const englishFallback = voices.find(v => v.lang.startsWith('en'));
        utterance.voice = preferred || englishFallback || voices[0];
      }

      utterance.rate = options.rate !== undefined ? options.rate : 0.95;
      utterance.pitch = options.pitch !== undefined ? options.pitch : 1.05;
      utterance.volume = options.volume !== undefined ? options.volume : 1.0;

      // Small 60ms timeout to ensure cancel() has settled in Chromium engine
      setTimeout(() => {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
          console.log('🔊 SpeechSynthesis Speaking:', text);
        } catch (e) {
          console.warn('SpeechSynthesis speak error:', e);
        }
      }, 60);
    } catch (e) {
      console.warn('Speech synthesis outer error:', e);
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

  // 1. 5-Second Urgency Warning Tick (rising tension pulse)
  playUrgencyTick(secondsRemaining = 5) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const pitches = { 5: 600, 4: 720, 3: 880, 2: 1080, 1: 1320 };
    const freq = pitches[secondsRemaining] || 880;
    this.playBeep(freq, 'triangle', 0.08, 0.4);

    // Double pulse for the final 1 second for extra urgency
    if (secondsRemaining === 1) {
      setTimeout(() => this.playBeep(1480, 'sine', 0.07, 0.45), 140);
    }
  }

  // 2. New Player Joined Lobby Chime (bright welcoming power-up)
  playPlayerJoined() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const notes = [523.25, 783.99, 1046.5]; // C5 -> G5 -> C6
    notes.forEach((freq, i) => {
      setTimeout(() => this.playBeep(freq, 'sine', 0.14, 0.35), i * 90);
    });
  }

  // 3. Dramatic Snare Drumroll for Round Results Reveal
  playDrumroll(durationSec = 1.4) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.04);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      // Snare roll pulses accelerating with crescendo
      const pulseCount = 28;
      for (let i = 0; i < pulseCount; i++) {
        const progress = i / pulseCount;
        const hitTime = now + (progress * durationSec);

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800 + progress * 800; // 1800Hz -> 2600Hz
        filter.Q.value = 1.5;

        const gain = this.ctx.createGain();
        const volume = 0.06 + Math.pow(progress, 1.8) * 0.4;
        gain.gain.setValueAtTime(volume, hitTime);
        gain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.04);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(hitTime);
        noise.stop(hitTime + 0.04);
      }

      // Final punch hit at the end of drumroll
      const finishTime = now + durationSec;
      setTimeout(() => {
        if (this.isMuted || !this.ctx) return;
        // Low bass punch
        try {
          const kickOsc = this.ctx.createOscillator();
          const kickGain = this.ctx.createGain();
          kickOsc.frequency.setValueAtTime(140, this.ctx.currentTime);
          kickOsc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.3);
          kickGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
          kickGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

          kickOsc.connect(kickGain);
          kickGain.connect(this.ctx.destination);
          kickOsc.start();
          kickOsc.stop(this.ctx.currentTime + 0.3);

      // Cymbal shimmer hit
          this.playBeep(1200, 'triangle', 0.35, 0.4);
        } catch (e) {
          // ignore
        }
      }, durationSec * 1000);
    } catch (e) {
      console.warn('Error synthesizing drumroll:', e);
    }
  }

  // 4. Futuristic AI Arena Entrance Intro (Sci-fi Riser + Cyber Chimes + AI Voice)
  playArenaWelcomeIntro() {
    if (this.isMuted) return;
    const nowMs = Date.now();
    if (this.lastWelcomeTime && (nowMs - this.lastWelcomeTime) < 3000) {
      return;
    }
    this.lastWelcomeTime = nowMs;
    this.initContext();

    if (this.ctx) {
      try {
        const now = this.ctx.currentTime;

        // Sub-bass Kick & Entrance Impact (120Hz -> 35Hz)
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(120, now);
        subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.55);
        subGain.gain.setValueAtTime(0.7, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        subOsc.connect(subGain);
        subGain.connect(this.ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.55);

        // Sci-Fi Cyber Riser / Power Charge (200Hz -> 1200Hz)
        const riserOsc = this.ctx.createOscillator();
        const riserGain = this.ctx.createGain();
        riserOsc.type = 'sawtooth';
        riserOsc.frequency.setValueAtTime(200, now + 0.05);
        riserOsc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
        riserGain.gain.setValueAtTime(0.2, now + 0.05);
        riserGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

        riserOsc.connect(riserGain);
        riserGain.connect(this.ctx.destination);
        riserOsc.start(now + 0.05);
        riserOsc.stop(now + 0.42);

        // Futuristic Arpeggio Chime Sweep (A Major Cyber Chord)
        const chimes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
        chimes.forEach((freq, i) => {
          setTimeout(() => {
            this.playBeep(freq, 'triangle', 0.22, 0.3);
          }, 250 + i * 50);
        });
      } catch (e) {
        console.warn('Intro audio effect warning:', e);
      }
    }

    // AI Voice Announcement: "Welcome to AI Death Arena Battle Ground!"
    setTimeout(() => {
      this.speakVoice("Welcome to AI Death Arena Battle Ground!", {
        rate: 0.92,
        pitch: 1.08,
        volume: 1.0
      });
    }, 300);
  }
}

export const audioManager = new AudioManager();
