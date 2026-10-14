// Звук без файлов: всё синтезируется WebAudio (шаги, джетпак, ветер бури, метеорит, UI, музыка-эмбиент).
// Громкости — из настроек (master/music/sfx, 0..1). Контекст стартует по первому жесту пользователя (политика автоплея).
export class Audio {
  constructor(settings) {
    this.S = settings; this.ctx = null; this.loops = {};
    const start = () => { this.init(); removeEventListener('pointerdown', start); removeEventListener('keydown', start); };
    addEventListener('pointerdown', start); addEventListener('keydown', start);
    addEventListener('terra-settings', e => { this.S = e.detail; this.applyVol(); });
  }
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = this.ctx = new C();
    this.master = c.createGain(); this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.connect(this.master);
    // Короткая «комнатная» реверберация для музыки и метеоритов
    this.verb = c.createConvolver(); const L = c.sampleRate * 2.2, ir = c.createBuffer(2, L, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < L; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 3); }
    this.verb.buffer = ir; const vg = c.createGain(); vg.gain.value = 0.35; this.verb.connect(vg); vg.connect(this.master);
    // Белый шум — основа для шагов, ветра, выхлопа
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.applyVol();
    this.startMusic();
  }
  applyVol() { if (!this.ctx) return; const S = this.S || {}; this.master.gain.value = S.master ?? 0.8; this.sfx.gain.value = S.sfx ?? 0.8; this.mus.gain.value = (S.music ?? 0.6) * 0.5; }
  get t() { return this.ctx.currentTime; }
  // Простые кирпичики
  tone({ f = 440, f2 = null, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005, out = this.sfx, delay = 0, verb = false }) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = this.t + delay;
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); if (verb) g.connect(this.verb); o.start(t); o.stop(t + dur + 0.05);
  }
  noise({ dur = 0.2, vol = 0.3, type = 'lowpass', f = 800, f2 = null, q = 1, out = this.sfx, delay = 0, verb = false }) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), t = this.t + delay;
    s.buffer = this.noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out); if (verb) g.connect(this.verb); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // Постоянный шумовой луп с управляемой громкостью/фильтром (джетпак, буря)
  loop(name, { type = 'lowpass', f = 600, q = 0.7 } = {}) {
    if (!this.ctx) return null; if (this.loops[name]) return this.loops[name];
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(this.sfx); s.start();
    return (this.loops[name] = { g, fl });
  }
  setLoop(name, vol, f) { const L = this.loops[name]; if (!L) return; const t = this.t; L.g.gain.setTargetAtTime(vol, t, 0.08); if (f) L.fl.frequency.setTargetAtTime(f, t, 0.1); }

  // Мотор транспорта: пила + квадрат через lowpass, «пыхтение» — амплитудная модуляция; rpm 0..1
  engine(on, rpm = 0, load = 0) {
    if (!this.ctx) return; const c = this.ctx, t = this.t;
    let E = this.eng;
    if (!E && !on) return;
    if (!E) {
      E = this.eng = { g: c.createGain(), fl: c.createBiquadFilter(), o1: c.createOscillator(), o2: c.createOscillator(), lfo: c.createOscillator(), lg: c.createGain(), am: c.createGain() };
      E.o1.type = 'sawtooth'; E.o2.type = 'square'; E.o2.detune.value = 7; E.fl.type = 'lowpass'; E.fl.Q.value = 2.5; E.g.gain.value = 0;
      E.lfo.type = 'sine'; E.lg.gain.value = 0.35; E.am.gain.value = 0.65;
      const mix = c.createGain(); mix.gain.value = 0.5; E.o1.connect(mix); E.o2.connect(mix); mix.connect(E.am); E.lfo.connect(E.lg); E.lg.connect(E.am.gain);
      E.am.connect(E.fl); E.fl.connect(E.g); E.g.connect(this.sfx); for (const o of [E.o1, E.o2, E.lfo]) o.start();
    }
    const f = 38 + rpm * 70;                                    // базовая частота «цилиндров»
    E.o1.frequency.setTargetAtTime(f, t, 0.12); E.o2.frequency.setTargetAtTime(f * 0.5, t, 0.12);
    E.lfo.frequency.setTargetAtTime(9 + rpm * 26, t, 0.12);     // пыхтение ускоряется с оборотами
    E.fl.frequency.setTargetAtTime(260 + rpm * 900 + load * 300, t, 0.1);
    E.g.gain.setTargetAtTime(on ? 0.11 + rpm * 0.09 + load * 0.04 : 0, t, on ? 0.15 : 0.35);
  }
  // ---------- События ----------
  play(id, opt = {}) {
    if (id === 'engine_start') { this.tone({ f: 60, f2: 120, type: 'sawtooth', dur: 0.5, vol: 0.12 }); this.noise({ dur: 0.35, vol: 0.12, f: 300, f2: 900 }); this.tone({ f: 900, type: 'sine', dur: 0.08, vol: 0.06, delay: 0.05 }); return; }
    if (id === 'engine_stop') { this.tone({ f: 90, f2: 35, type: 'sawtooth', dur: 0.6, vol: 0.1 }); this.noise({ dur: 0.25, vol: 0.06, type: 'bandpass', f: 1200, f2: 300, delay: 0.1 }); return; }
    if (!this.ctx) return;
    const R = (a, b) => a + Math.random() * (b - a);
    switch (id) {
      case 'step': this.noise({ dur: 0.07, vol: 0.12 * (opt.k || 1), type: 'bandpass', f: R(500, 900), q: 1.2 }); this.tone({ f: R(80, 110), f2: 50, type: 'sine', dur: 0.06, vol: 0.06 }); break;
      case 'jump': this.noise({ dur: 0.12, vol: 0.15, type: 'bandpass', f: 600 }); break;
      case 'land': this.noise({ dur: 0.18, vol: 0.25 * Math.min(1.5, opt.k || 1), type: 'lowpass', f: 500 }); this.tone({ f: 90, f2: 40, dur: 0.15, vol: 0.18 }); break;
      case 'mine_hit': this.tone({ f: R(700, 900), f2: 300, type: 'square', dur: 0.06, vol: 0.06 }); this.noise({ dur: 0.08, vol: 0.12, type: 'highpass', f: 1800 }); break;
      case 'mine_done': [523, 784].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.14, vol: 0.14, delay: i * 0.06 })); break;
      case 'pickup': this.tone({ f: 660, f2: 990, type: 'triangle', dur: 0.12, vol: 0.13 }); break;
      case 'loot_open': this.noise({ dur: 0.35, vol: 0.18, type: 'bandpass', f: 400, f2: 1600 }); [392, 523, 659].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.2, vol: 0.12, delay: 0.12 + i * 0.07 })); break;
      case 'rare': [523, 659, 784, 1046].forEach((f, i) => this.tone({ f, type: 'sine', dur: 0.5, vol: 0.12, delay: i * 0.08, verb: true })); break;
      case 'click': this.tone({ f: 1100, f2: 700, type: 'triangle', dur: 0.045, vol: 0.08 }); break;
      case 'open': this.tone({ f: 420, f2: 640, type: 'sine', dur: 0.1, vol: 0.1 }); this.noise({ dur: 0.08, vol: 0.05, type: 'highpass', f: 3000 }); break;
      case 'close': this.tone({ f: 600, f2: 380, type: 'sine', dur: 0.1, vol: 0.08 }); break;
      case 'toast': this.tone({ f: 880, type: 'sine', dur: 0.12, vol: 0.07 }); this.tone({ f: 1320, type: 'sine', dur: 0.15, vol: 0.05, delay: 0.06 }); break;
      case 'warn': this.tone({ f: 330, type: 'square', dur: 0.12, vol: 0.06 }); this.tone({ f: 260, type: 'square', dur: 0.16, vol: 0.06, delay: 0.14 }); break;
      case 'error': this.tone({ f: 200, f2: 150, type: 'sawtooth', dur: 0.18, vol: 0.06 }); break;
      case 'craft': [440, 554, 659].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.12, vol: 0.1, delay: i * 0.05 })); this.noise({ dur: 0.25, vol: 0.06, type: 'bandpass', f: 2500, q: 3 }); break;
      case 'build': this.tone({ f: 120, f2: 60, dur: 0.25, vol: 0.25 }); this.noise({ dur: 0.3, vol: 0.18, type: 'lowpass', f: 900 }); this.tone({ f: 784, type: 'triangle', dur: 0.2, vol: 0.08, delay: 0.15 }); break;
      case 'goal': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.35, vol: 0.12, delay: i * 0.07, verb: true })); break;
      case 'stage': [262, 330, 392, 523, 659, 784].forEach((f, i) => this.tone({ f, type: 'sine', dur: 1.6, vol: 0.1, attack: 0.05, delay: i * 0.12, verb: true })); break;
      case 'meteor_whoosh': this.noise({ dur: 3.2, vol: 0.22, type: 'bandpass', f: 2400, f2: 300, q: 1.5, verb: true }); break;
      case 'meteor_impact': { const k = opt.k || 1; this.tone({ f: 70, f2: 28, dur: 1.4, vol: 0.5 * k, verb: true }); this.noise({ dur: 1.6, vol: 0.45 * k, type: 'lowpass', f: 1400, f2: 120, verb: true }); break; }
      case 'storm_warn': this.tone({ f: 220, f2: 180, type: 'sawtooth', dur: 0.8, vol: 0.05, verb: true }); this.tone({ f: 220, f2: 180, type: 'sawtooth', dur: 0.8, vol: 0.05, delay: 0.9, verb: true }); break;
      case 'tank': this.noise({ dur: 0.6, vol: 0.2, type: 'highpass', f: 2000, f2: 800 }); break;
      case 'hurt': this.tone({ f: 160, f2: 90, type: 'square', dur: 0.12, vol: 0.07 }); break;
      case 'door': this.noise({ dur: 0.45, vol: 0.12, type: 'bandpass', f: 900, f2: 400, q: 2 }); this.tone({ f: 180, f2: 120, dur: 0.3, vol: 0.06 }); break;
      case 'death': [392, 330, 262, 196].forEach((f, i) => this.tone({ f, type: 'sine', dur: 0.6, vol: 0.12, delay: i * 0.2, verb: true })); break;
    }
  }

  // ---------- Музыка: медленный пэд + редкие «звёздные» ноты (генеративно, спокойная) ----------
  startMusic() {
    const c = this.ctx, scale = [0, 3, 5, 7, 10], roots = [110, 98, 123.47, 87.31]; let bar = 0;
    const pad = (f, t, dur) => { for (const [mul, det] of [[1, -6], [1, 6], [1.5, 0], [2, 3]]) { const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f * mul; o.detune.value = det; fl.type = 'lowpass'; fl.frequency.value = 700; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + 2.5); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(fl); fl.connect(g); g.connect(this.mus); g.connect(this.verb); o.start(t); o.stop(t + dur + 0.1); } };
    const tick = () => {
      if (!this.ctx) return; const t = this.t + 0.1, root = roots[bar % roots.length];
      pad(root, t, 8.5);
      for (let i = 0; i < 4; i++) if (Math.random() < 0.6) { const n = scale[Math.floor(Math.random() * scale.length)] + 12 * (2 + Math.floor(Math.random() * 2)); this.tone({ f: root * Math.pow(2, n / 12), type: 'sine', dur: 2.2, vol: 0.05, attack: 0.02, delay: 0.5 + i * 2 + Math.random() * 0.5, out: this.mus, verb: true }); }
      bar++; this.musT = setTimeout(tick, 8000);
    };
    tick();
  }
}
