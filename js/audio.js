// Rich synthesized Capcom-arcade Web Audio engine for Wifebun ♥ Husbun — Beatdown Sesh

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._noiseCache = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-14, this.ctx.currentTime);
        comp.knee.setValueAtTime(18, this.ctx.currentTime);
        comp.ratio.setValueAtTime(6, this.ctx.currentTime);
        comp.attack.setValueAtTime(0.003, this.ctx.currentTime);
        comp.release.setValueAtTime(0.14, this.ctx.currentTime);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.92, this.ctx.currentTime);

        comp.connect(gain);
        gain.connect(this.ctx.destination);
        this.master = comp;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  _canPlay() {
    if (!this.enabled) return false;
    this.init();
    return Boolean(this.ctx && this.master);
  }

  _getNoiseBuffer() {
    if (this._noiseCache && this._noiseCache.sampleRate === this.ctx.sampleRate) {
      return this._noiseCache;
    }
    const len = Math.floor(this.ctx.sampleRate * 1.0);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this._noiseCache = buffer;
    return buffer;
  }

  _noiseBurst(duration, volume, filterFreq, opts = {}) {
    const now = (opts.startTime ?? this.ctx.currentTime);
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._getNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.filterType || 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    if (opts.endFreq) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), now + duration);
    }
    filter.Q.setValueAtTime(opts.q ?? 1.4, now);

    const gain = this.ctx.createGain();
    const attack = opts.attack ?? 0.004;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(attack, duration * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + duration + 0.02);
  }

  _makeDistortionCurve(amount = 28) {
    const n = 256;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  playMove(moveId) {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;

    switch (moveId) {
      case 'pear_bounce': {
        // Rubbery comic BOING-SLAP!
        // 1) Crisp comic slap transient
        this._noiseBurst(0.055, 0.24, 1750, { startTime: now, q: 1.1 });
        const slapOsc = this.ctx.createOscillator();
        const slapGain = this.ctx.createGain();
        slapOsc.type = 'triangle';
        slapOsc.frequency.setValueAtTime(270, now);
        slapOsc.frequency.exponentialRampToValueAtTime(88, now + 0.065);
        slapGain.gain.setValueAtTime(0.26, now);
        slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        slapOsc.connect(slapGain);
        slapGain.connect(this.master);
        slapOsc.start(now);
        slapOsc.stop(now + 0.075);

        // 2) Elastic rubbery spring BOING with playful wobble LFO
        const boing = this.ctx.createOscillator();
        const boingHarm = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const bGain = this.ctx.createGain();
        const hGain = this.ctx.createGain();

        boing.type = 'sine';
        boing.frequency.setValueAtTime(165, now + 0.015);
        boing.frequency.exponentialRampToValueAtTime(560, now + 0.11);
        boing.frequency.exponentialRampToValueAtTime(245, now + 0.21);
        boing.frequency.exponentialRampToValueAtTime(385, now + 0.29);
        boing.frequency.exponentialRampToValueAtTime(260, now + 0.36);

        boingHarm.type = 'triangle';
        boingHarm.frequency.setValueAtTime(330, now + 0.015);
        boingHarm.frequency.exponentialRampToValueAtTime(1120, now + 0.11);
        boingHarm.frequency.exponentialRampToValueAtTime(490, now + 0.26);

        lfo.frequency.setValueAtTime(24, now + 0.015);
        lfoGain.gain.setValueAtTime(36, now + 0.015);
        lfoGain.gain.exponentialRampToValueAtTime(4, now + 0.34);
        lfo.connect(lfoGain);
        lfoGain.connect(boing.frequency);

        bGain.gain.setValueAtTime(0.001, now + 0.015);
        bGain.gain.linearRampToValueAtTime(0.28, now + 0.035);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.37);

        hGain.gain.setValueAtTime(0.09, now + 0.02);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);

        boing.connect(bGain);
        boingHarm.connect(hGain);
        bGain.connect(this.master);
        hGain.connect(this.master);

        boing.start(now + 0.015);
        boingHarm.start(now + 0.015);
        lfo.start(now + 0.015);
        boing.stop(now + 0.39);
        boingHarm.stop(now + 0.29);
        lfo.stop(now + 0.39);
        break;
      }

      case 'dj_spin': {
        // Funky dual-tone turntable vinyl scratch (wikka-wikka-wah!) + club kick
        const kick = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(150, now);
        kick.frequency.exponentialRampToValueAtTime(46, now + 0.11);
        kickGain.gain.setValueAtTime(0.26, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        kick.connect(kickGain);
        kickGain.connect(this.master);
        kick.start(now);
        kick.stop(now + 0.13);

        const strokes = [
          { t: 0.0, f1: 280, f2: 960, dur: 0.085, q: 4.5 },
          { t: 0.09, f1: 880, f2: 220, dur: 0.075, q: 5.0 },
          { t: 0.17, f1: 310, f2: 1180, dur: 0.095, q: 5.2 },
        ];
        strokes.forEach((s) => {
          const st = now + s.t;
          const oscA = this.ctx.createOscillator();
          const oscB = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          oscA.type = 'sawtooth';
          oscB.type = 'square';
          oscA.frequency.setValueAtTime(s.f1, st);
          oscA.frequency.exponentialRampToValueAtTime(s.f2, st + s.dur);
          oscB.frequency.setValueAtTime(s.f1 * 1.498, st);
          oscB.frequency.exponentialRampToValueAtTime(s.f2 * 1.498, st + s.dur);

          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(s.f1 * 2.1, st);
          filter.frequency.exponentialRampToValueAtTime(s.f2 * 1.9, st + s.dur);
          filter.Q.setValueAtTime(s.q, st);

          gain.gain.setValueAtTime(0.001, st);
          gain.gain.linearRampToValueAtTime(0.18, st + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, st + s.dur);

          oscA.connect(filter);
          oscB.connect(filter);
          filter.connect(gain);
          gain.connect(this.master);

          oscA.start(st);
          oscB.start(st);
          oscA.stop(st + s.dur + 0.015);
          oscB.stop(st + s.dur + 0.015);

          this._noiseBurst(s.dur * 0.85, 0.11, s.f1 * 2.5, {
            startTime: st,
            endFreq: s.f2 * 2.2,
            filterType: 'bandpass',
            q: 2.8,
          });
        });
        break;
      }

      case 'mango_seed': {
        // Blazing power-chord launch + fiery supersonic zip!
        // 1) Distorted power chord stab (E3 + B3 + E4 + G#4)
        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this._makeDistortionCurve(34);
        const chordFilter = this.ctx.createBiquadFilter();
        chordFilter.type = 'lowpass';
        chordFilter.frequency.setValueAtTime(3400, now);
        chordFilter.frequency.exponentialRampToValueAtTime(750, now + 0.36);

        const chordGain = this.ctx.createGain();
        chordGain.gain.setValueAtTime(0.001, now);
        chordGain.gain.linearRampToValueAtTime(0.22, now + 0.018);
        chordGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        shaper.connect(chordFilter);
        chordFilter.connect(chordGain);
        chordGain.connect(this.master);

        [164.81, 246.94, 329.63, 415.3].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.03, now + 0.36);
          osc.connect(shaper);
          osc.start(now);
          osc.stop(now + 0.4);
        });

        // 2) Fiery supersonic seed whistle-zip
        const zip = this.ctx.createOscillator();
        const zipGain = this.ctx.createGain();
        zip.type = 'triangle';
        zip.frequency.setValueAtTime(1180, now + 0.02);
        zip.frequency.exponentialRampToValueAtTime(240, now + 0.17);
        zip.frequency.exponentialRampToValueAtTime(1420, now + 0.3);
        zipGain.gain.setValueAtTime(0.19, now + 0.02);
        zipGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        zip.connect(zipGain);
        zipGain.connect(this.master);
        zip.start(now + 0.02);
        zip.stop(now + 0.34);

        // 3) Blazing flame whoosh
        this._noiseBurst(0.32, 0.24, 900, {
          startTime: now,
          endFreq: 4800,
          filterType: 'bandpass',
          q: 1.2,
        });
        break;
      }

      case 'coke_burp': {
        // Fizzy bubbling soda hiss + effervescent pops + guttural comic belch!
        // 1) Carbonated soda hiss
        this._noiseBurst(0.28, 0.2, 4200, {
          startTime: now,
          endFreq: 6800,
          filterType: 'highpass',
          q: 0.9,
        });

        // 2) Sparkling micro-bubble pops
        for (let i = 0; i < 6; i++) {
          const bt = now + 0.015 + i * 0.042;
          const bOsc = this.ctx.createOscillator();
          const bGain = this.ctx.createGain();
          const base = 700 + ((i * 211) % 680);
          bOsc.type = 'sine';
          bOsc.frequency.setValueAtTime(base, bt);
          bOsc.frequency.exponentialRampToValueAtTime(base * 1.9, bt + 0.032);
          bGain.gain.setValueAtTime(0.08, bt);
          bGain.gain.exponentialRampToValueAtTime(0.001, bt + 0.038);
          bOsc.connect(bGain);
          bGain.connect(this.master);
          bOsc.start(bt);
          bOsc.stop(bt + 0.042);
        }

        // 3) Resonant bubbly comic burp
        const burpStart = now + 0.045;
        const osc = this.ctx.createOscillator();
        const sub = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const formant = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(142, burpStart);
        osc.frequency.exponentialRampToValueAtTime(66, burpStart + 0.34);

        sub.type = 'triangle';
        sub.frequency.setValueAtTime(71, burpStart);
        sub.frequency.exponentialRampToValueAtTime(42, burpStart + 0.34);

        lfo.frequency.setValueAtTime(34, burpStart);
        lfo.frequency.linearRampToValueAtTime(18, burpStart + 0.34);
        lfoGain.gain.setValueAtTime(30, burpStart);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        formant.type = 'bandpass';
        formant.frequency.setValueAtTime(540, burpStart);
        formant.frequency.exponentialRampToValueAtTime(260, burpStart + 0.34);
        formant.Q.setValueAtTime(3.2, burpStart);

        gain.gain.setValueAtTime(0.001, burpStart);
        gain.gain.linearRampToValueAtTime(0.32, burpStart + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, burpStart + 0.36);

        osc.connect(formant);
        sub.connect(formant);
        formant.connect(gain);
        gain.connect(this.master);

        osc.start(burpStart);
        sub.start(burpStart);
        lfo.start(burpStart);
        osc.stop(burpStart + 0.38);
        sub.stop(burpStart + 0.38);
        lfo.stop(burpStart + 0.38);
        break;
      }

      case 'white_claw': {
        // Crisp frosty aluminum can-crack (TINK-PSSH!) + icy seltzer chime
        // 1) Metallic tab pull CLICK-TINK
        [2480, 3910].forEach((f, idx) => {
          const tOsc = this.ctx.createOscillator();
          const tGain = this.ctx.createGain();
          tOsc.type = 'triangle';
          tOsc.frequency.setValueAtTime(f, now);
          tOsc.frequency.exponentialRampToValueAtTime(f * 0.72, now + 0.035);
          tGain.gain.setValueAtTime(0.14 / (idx + 1), now);
          tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          tOsc.connect(tGain);
          tGain.connect(this.master);
          tOsc.start(now);
          tOsc.stop(now + 0.045);
        });

        // 2) Crisp pressurized seltzer spray PSSSSHH!
        this._noiseBurst(0.22, 0.28, 5200, {
          startTime: now + 0.015,
          endFreq: 7600,
          filterType: 'highpass',
          q: 1.0,
        });

        // 3) Frosty ice-crystal sparkle chimes
        [1567.98, 2093.0, 2637.02].forEach((freq, idx) => {
          const st = now + 0.03 + idx * 0.032;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, st);
          gain.gain.setValueAtTime(0.11, st);
          gain.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
          osc.connect(gain);
          gain.connect(this.master);
          osc.start(st);
          osc.stop(st + 0.24);
        });
        break;
      }

      case 'height_mog': {
        // Dramatic rising brassy orchestral loom!
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(280, now);
        filter.frequency.exponentialRampToValueAtTime(2400, now + 0.26);
        filter.Q.setValueAtTime(2.4, now);

        const brassGain = this.ctx.createGain();
        brassGain.gain.setValueAtTime(0.001, now);
        brassGain.gain.linearRampToValueAtTime(0.26, now + 0.05);
        brassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

        filter.connect(brassGain);
        brassGain.connect(this.master);

        // Rising heroic/menacing brass fifth + octave
        [
          { f1: 87.31, f2: 174.61 },
          { f1: 130.81, f2: 261.63 },
          { f1: 174.61, f2: 349.23 },
          { f1: 175.8, f2: 351.2 },
        ].forEach((b) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(b.f1, now);
          osc.frequency.exponentialRampToValueAtTime(b.f2, now + 0.27);
          osc.connect(filter);
          osc.start(now);
          osc.stop(now + 0.38);
        });

        // Shimmering apex glint ping
        const glint = this.ctx.createOscillator();
        const glintGain = this.ctx.createGain();
        glint.type = 'sine';
        glint.frequency.setValueAtTime(1396.91, now + 0.2);
        glint.frequency.exponentialRampToValueAtTime(1760, now + 0.34);
        glintGain.gain.setValueAtTime(0.09, now + 0.2);
        glintGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
        glint.connect(glintGain);
        glintGain.connect(this.master);
        glint.start(now + 0.2);
        glint.stop(now + 0.38);
        break;
      }

      case 'forehead_kiss': {
        // Sweet sparkling "mwah!" pop + dreamy romantic harp chimes!
        // 1) Cute playful lip-pop "mwah!"
        const pop = this.ctx.createOscillator();
        const popGain = this.ctx.createGain();
        pop.type = 'sine';
        pop.frequency.setValueAtTime(340, now);
        pop.frequency.exponentialRampToValueAtTime(1140, now + 0.065);
        pop.frequency.exponentialRampToValueAtTime(520, now + 0.145);
        popGain.gain.setValueAtTime(0.001, now);
        popGain.gain.linearRampToValueAtTime(0.24, now + 0.015);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        pop.connect(popGain);
        popGain.connect(this.master);
        pop.start(now);
        pop.stop(now + 0.17);

        this._noiseBurst(0.045, 0.09, 3200, { startTime: now + 0.01, q: 2.2 });

        // 2) Sweet romantic sparkle arpeggio (C6 - E6 - G6 - B6 - C7)
        const chimes = [1046.5, 1318.51, 1567.98, 1975.53, 2093.0];
        chimes.forEach((freq, idx) => {
          const st = now + 0.055 + idx * 0.036;
          const osc = this.ctx.createOscillator();
          const over = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          over.type = 'triangle';
          osc.frequency.setValueAtTime(freq, st);
          over.frequency.setValueAtTime(freq * 2, st);

          gain.gain.setValueAtTime(0.12 - idx * 0.012, st);
          gain.gain.exponentialRampToValueAtTime(0.0008, st + 0.32);

          osc.connect(gain);
          over.connect(gain);
          gain.connect(this.master);
          osc.start(st);
          over.start(st);
          osc.stop(st + 0.34);
          over.stop(st + 0.34);
        });
        break;
      }

      case 'eyp_report': {
        // Crisp executive paper-slam + heavy bass rubber-stamp THUD!
        // 1) Crisp fluttering paper whip-slam
        this._noiseBurst(0.065, 0.26, 2600, { startTime: now, endFreq: 1100, q: 1.0 });
        this._noiseBurst(0.08, 0.22, 1650, { startTime: now + 0.045, q: 1.5 });

        // 2) Heavy authoritative bass stamp THUD
        const stampAt = now + 0.055;
        const sub = this.ctx.createOscillator();
        const punch = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        const punchGain = this.ctx.createGain();

        sub.type = 'sine';
        sub.frequency.setValueAtTime(155, stampAt);
        sub.frequency.exponentialRampToValueAtTime(38, stampAt + 0.22);
        subGain.gain.setValueAtTime(0.36, stampAt);
        subGain.gain.exponentialRampToValueAtTime(0.001, stampAt + 0.25);

        punch.type = 'square';
        punch.frequency.setValueAtTime(210, stampAt);
        punch.frequency.exponentialRampToValueAtTime(62, stampAt + 0.12);
        punchGain.gain.setValueAtTime(0.18, stampAt);
        punchGain.gain.exponentialRampToValueAtTime(0.001, stampAt + 0.14);

        sub.connect(subGain);
        punch.connect(punchGain);
        subGain.connect(this.master);
        punchGain.connect(this.master);

        sub.start(stampAt);
        punch.start(stampAt);
        sub.stop(stampAt + 0.26);
        punch.stop(stampAt + 0.15);

        // 3) Crisp executive seal click
        const clack = this.ctx.createOscillator();
        const clackGain = this.ctx.createGain();
        clack.type = 'triangle';
        clack.frequency.setValueAtTime(980, stampAt + 0.01);
        clack.frequency.exponentialRampToValueAtTime(420, stampAt + 0.065);
        clackGain.gain.setValueAtTime(0.16, stampAt + 0.01);
        clackGain.gain.exponentialRampToValueAtTime(0.001, stampAt + 0.07);
        clack.connect(clackGain);
        clackGain.connect(this.master);
        clack.start(stampAt + 0.01);
        clack.stop(stampAt + 0.08);
        break;
      }

      default:
        this.playWhoosh(1);
    }
  }

  playWhoosh(pitch = 1) {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(88 * pitch, now + 0.095);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.11);

    this._noiseBurst(0.09, 0.12, 1600 * pitch, {
      startTime: now,
      endFreq: 520 * pitch,
      q: 1.6,
    });
  }

  playHit(heavy = false) {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;

    // Sub punch body
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(heavy ? 180 : 145, now);
    sub.frequency.exponentialRampToValueAtTime(heavy ? 36 : 48, now + (heavy ? 0.19 : 0.11));
    subGain.gain.setValueAtTime(heavy ? 0.38 : 0.25, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.21 : 0.12));
    sub.connect(subGain);
    subGain.connect(this.master);
    sub.start(now);
    sub.stop(now + (heavy ? 0.22 : 0.13));

    // Mid arcade smack crunch
    const smack = this.ctx.createOscillator();
    const smackGain = this.ctx.createGain();
    smack.type = heavy ? 'sawtooth' : 'square';
    smack.frequency.setValueAtTime(heavy ? 240 : 195, now);
    smack.frequency.exponentialRampToValueAtTime(52, now + (heavy ? 0.14 : 0.08));
    smackGain.gain.setValueAtTime(heavy ? 0.24 : 0.16, now);
    smackGain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.15 : 0.09));
    smack.connect(smackGain);
    smackGain.connect(this.master);
    smack.start(now);
    smack.stop(now + (heavy ? 0.16 : 0.1));

    // High transient crack
    this._noiseBurst(heavy ? 0.12 : 0.065, heavy ? 0.3 : 0.18, heavy ? 1550 : 2500, {
      startTime: now,
      endFreq: heavy ? 420 : 950,
      q: 1.0,
    });
  }

  playBlock() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;

    // Crisp Capcom arcade guard clank + warm shield resonance
    const body = this.ctx.createOscillator();
    const ping = this.ctx.createOscillator();
    const bGain = this.ctx.createGain();
    const pGain = this.ctx.createGain();

    body.type = 'triangle';
    body.frequency.setValueAtTime(560, now);
    body.frequency.exponentialRampToValueAtTime(240, now + 0.085);
    bGain.gain.setValueAtTime(0.24, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    ping.type = 'square';
    ping.frequency.setValueAtTime(1180, now);
    ping.frequency.exponentialRampToValueAtTime(760, now + 0.06);
    pGain.gain.setValueAtTime(0.1, now);
    pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    body.connect(bGain);
    ping.connect(pGain);
    bGain.connect(this.master);
    pGain.connect(this.master);

    body.start(now);
    ping.start(now);
    body.stop(now + 0.1);
    ping.stop(now + 0.075);

    this._noiseBurst(0.045, 0.14, 3400, { startTime: now, q: 2.2 });
  }

  playDodge() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(820, now + 0.11);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.125);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.135);

    this._noiseBurst(0.11, 0.13, 1200, {
      startTime: now,
      endFreq: 3800,
      q: 2.0,
    });
  }

  playPerfectDodge() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    // Sparkling time-slip bell chord!
    [587.33, 880, 1174.66, 1479.98].forEach((freq, idx) => {
      const start = now + idx * 0.036;
      const osc = this.ctx.createOscillator();
      const over = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      over.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      over.frequency.setValueAtTime(freq * 2, start);
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.32);
      osc.connect(gain);
      over.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      over.start(start);
      osc.stop(start + 0.34);
      over.stop(start + 0.34);
    });
    this._noiseBurst(0.14, 0.12, 2600, { startTime: now, endFreq: 5600, q: 2.4 });
  }

  playSuperReady() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    // Sparkling golden power-up arpeggio
    [659.25, 830.61, 987.77, 1318.51, 1661.22].forEach((freq, idx) => {
      const start = now + idx * 0.046;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.34);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.36);
    });
  }

  playSuperFreeze() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    // Iconic Capcom Super-Freeze: time-stop bass drop + crystalline flash chime + energy surge!
    const drop = this.ctx.createOscillator();
    const dropGain = this.ctx.createGain();
    drop.type = 'sine';
    drop.frequency.setValueAtTime(210, now);
    drop.frequency.exponentialRampToValueAtTime(36, now + 0.38);
    dropGain.gain.setValueAtTime(0.36, now);
    dropGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    drop.connect(dropGain);
    dropGain.connect(this.master);
    drop.start(now);
    drop.stop(now + 0.44);

    // Sweeping anime energy flash
    this._noiseBurst(0.32, 0.25, 1100, {
      startTime: now,
      endFreq: 6400,
      filterType: 'bandpass',
      q: 1.5,
    });

    // Radiant shimmering crystalline super chime chord
    const notes = [523.25, 783.99, 987.77, 1174.66, 1567.98, 2093.0];
    notes.forEach((f, idx) => {
      const start = now + idx * 0.028;
      const oscA = this.ctx.createOscillator();
      const oscB = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      oscA.type = 'triangle';
      oscB.type = 'sine';
      oscA.frequency.setValueAtTime(f, start);
      oscA.frequency.exponentialRampToValueAtTime(f * 1.08, start + 0.44);
      oscB.frequency.setValueAtTime(f * 1.004, start);
      oscB.frequency.exponentialRampToValueAtTime(f * 1.084, start + 0.44);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.46);

      oscA.connect(gain);
      oscB.connect(gain);
      gain.connect(this.master);
      oscA.start(start);
      oscB.start(start);
      oscA.stop(start + 0.48);
      oscB.stop(start + 0.48);
    });
  }

  playJump() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(230, now);
    osc.frequency.exponentialRampToValueAtTime(590, now + 0.11);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);

    this._noiseBurst(0.06, 0.06, 2200, { startTime: now, endFreq: 4200, q: 1.8 });
  }

  playKO() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;

    // Dramatic Capcom K.O. heavy sub slam + gritty impact + reverberant gong shimmer!
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.62);
    subGain.gain.setValueAtTime(0.42, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    sub.connect(subGain);
    subGain.connect(this.master);
    sub.start(now);
    sub.stop(now + 0.7);

    const crunch = this.ctx.createOscillator();
    const crunchGain = this.ctx.createGain();
    crunch.type = 'sawtooth';
    crunch.frequency.setValueAtTime(195, now);
    crunch.frequency.exponentialRampToValueAtTime(38, now + 0.42);
    crunchGain.gain.setValueAtTime(0.24, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    crunch.connect(crunchGain);
    crunchGain.connect(this.master);
    crunch.start(now);
    crunch.stop(now + 0.47);

    this._noiseBurst(0.32, 0.34, 920, { startTime: now, endFreq: 260, q: 0.9 });

    // Metallic K.O. ring-out
    [440, 659.25, 932.33].forEach((f, idx) => {
      const gOsc = this.ctx.createOscillator();
      const gGain = this.ctx.createGain();
      gOsc.type = 'triangle';
      gOsc.frequency.setValueAtTime(f, now + 0.02);
      gOsc.frequency.exponentialRampToValueAtTime(f * 0.88, now + 0.65);
      gGain.gain.setValueAtTime(0.11 / (idx + 1), now + 0.02);
      gGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.68);
      gOsc.connect(gGain);
      gGain.connect(this.master);
      gOsc.start(now + 0.02);
      gOsc.stop(now + 0.7);
    });
  }

  playHeadPop() {
    this.playKO();
  }

  playBell() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    // Crisp brass arcade round bell with hammer transient & rich metallic partials
    this._noiseBurst(0.022, 0.2, 4200, { startTime: now, q: 2.5 });
    const partials = [
      { f: 880, v: 0.22, d: 0.85 },
      { f: 1324, v: 0.12, d: 0.72 },
      { f: 1768, v: 0.08, d: 0.6 },
      { f: 2495, v: 0.05, d: 0.42 },
    ];
    partials.forEach((p) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.f, now);
      gain.gain.setValueAtTime(p.v, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + p.d);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + p.d + 0.03);
    });
  }

  playVictory() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    // Romantic celebratory arcade fanfare with warm chord shimmer
    const lead = [523.25, 659.25, 783.99, 987.77, 1046.5];
    lead.forEach((n, idx) => {
      const start = now + idx * 0.092;
      const isFinal = idx === lead.length - 1;
      const dur = isFinal ? 0.65 : 0.28;

      const osc = this.ctx.createOscillator();
      const harm = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      harm.type = 'sine';
      osc.frequency.setValueAtTime(n, start);
      harm.frequency.setValueAtTime(n * 0.5, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(isFinal ? 0.24 : 0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

      osc.connect(gain);
      harm.connect(gain);
      gain.connect(this.master);

      osc.start(start);
      harm.start(start);
      osc.stop(start + dur + 0.02);
      harm.stop(start + dur + 0.02);
    });

    // Final sparkling major chord chime
    const chordAt = now + 0.37;
    [1318.51, 1567.98, 2093.0].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, chordAt);
      gain.gain.setValueAtTime(0.09, chordAt);
      gain.gain.exponentialRampToValueAtTime(0.0008, chordAt + 0.62);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(chordAt);
      osc.stop(chordAt + 0.65);
    });
  }
}

export const sound = new SoundEngine();
