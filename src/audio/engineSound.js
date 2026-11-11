/**
 * WebAudio ile sentezlenmiş motor sesi (dış dosya yok).
 * RPM'e bağlı harmonik dizisi + gürültü; ateşleme patlamaları.
 */
export class EngineSound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.started = false;
    this.oscs = [];
    this.noiseGain = null;
    this.filter = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(this.ctx.destination);

    // Düşük geçiren filtre (egzoz hissi)
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 800;
    this.filter.Q.value = 1.2;
    this.filter.connect(this.master);

    // Ana harmonik osilatörler (motor tuşu)
    const harmonics = [1, 2, 3, 4, 6];
    this.oscs = harmonics.map((h, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : i < 3 ? 'square' : 'sine';
      const g = this.ctx.createGain();
      g.gain.value = [0.5, 0.22, 0.12, 0.07, 0.04][i];
      osc.connect(g);
      g.connect(this.filter);
      osc.start();
      return { osc, g, h };
    });

    // Egzoz gürültüsü
    const noiseBuf = this._createNoise(2);
    this.noise = this.ctx.createBufferSource();
    this.noise.buffer = noiseBuf;
    this.noise.loop = true;
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.04;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 400;
    noiseFilter.Q.value = 0.7;
    this.noise.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.filter);
    this.noise.start();
    this.noiseFilter = noiseFilter;

    this.started = true;
  }

  _createNoise(seconds) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  resume() {
    this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  /**
   * @param {Object} snap Engine.snapshot()
   */
  update(snap) {
    if (!this.started || !this.enabled) {
      if (this.master) this.master.gain.value = 0;
      return;
    }
    const t = this.ctx.currentTime;
    // 4 zamanlı motor: 2 devir = 4 patlama → temel frekans = rpm/60 * 2 (iki patlama/devir)
    const firingHz = (snap.rpm / 60) * 3; // 6 silindir / 2 devir = 3 ateşleme/devir... rpm/60*3
    const base = Math.max(20, firingHz);

    const volume = snap.running ? 0.12 + 0.1 * (snap.throttle / 100) + 0.04 * (snap.rpm / 7200) : 0;
    this.master.gain.setTargetAtTime(this.enabled ? volume : 0, t, 0.05);

    this.filter.frequency.setTargetAtTime(300 + snap.rpm * 0.35 + snap.throttle * 4, t, 0.08);

    for (const { osc, g, h } of this.oscs) {
      osc.frequency.setTargetAtTime(base * h, t, 0.04);
      // Arıza: misfire düzensizlik
      if (snap.misfire.some(Boolean)) {
        osc.detune.setTargetAtTime((Math.random() - 0.5) * 80, t, 0.1);
      } else {
        osc.detune.setTargetAtTime(0, t, 0.1);
      }
      void g;
    }

    if (this.noiseGain) {
      this.noiseGain.gain.setTargetAtTime(snap.running ? 0.02 + 0.06 * (snap.throttle / 100) : 0, t, 0.1);
      this.noiseFilter.frequency.setTargetAtTime(300 + snap.rpm * 0.5, t, 0.1);
    }
  }

  /** Ateşleme anı kısa tık sesi */
  click(intensity = 0.5) {
    if (!this.started || !this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(120 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);
    g.gain.setValueAtTime(0.06 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  /** Uyarı bipi */
  beep(freq = 660, dur = 0.15) {
    if (!this.started || !this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.resume();
    return this.enabled;
  }
}
