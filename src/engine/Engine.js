import { PART_CATEGORIES, FAULT_DEFS } from '../config/parts.js';
import {
  INLINE6_FIRING_ORDER,
  V6_FIRING_ORDER,
  buildFiringMap,
  activeCylinder,
} from './firingOrder.js';

const IDLE_RPM = 800;
const REDLINE = 7200;

/**
 * Motor simülasyon durumu: parça statleri, RPM, metrikler, arıza mantığı.
 * Three.js'ten bağımsızdır; UI ve sahne bunu okur.
 */
export class Engine {
  constructor(onEvent) {
    this.onEvent = onEvent || (() => {});

    this.layout = 'inline6';
    this.firingOrder = [...INLINE6_FIRING_ORDER];
    this.firingMap = buildFiringMap(this.firingOrder);

    /** Kategori id → seçilen option id */
    this.selected = {};
    for (const cat of PART_CATEGORIES) {
      this.selected[cat.id] = cat.options[0].id;
    }

    this.running = false;
    this.rpm = 0;
    this.targetRpm = IDLE_RPM;
    this.throttle = 0;
    this.crankAngle = 0;
    this.temperature = 20;
    this.boost = 0;
    this.vibration = 0;
    this.torque = 0;
    this.power = 0;
    this.fuelRate = 0;

    /** Aktif arıza id seti */
    this.activeFaults = new Set();
    /** Geçici enjekte edilmiş arıza: id → bitiş süresi (sn) */
    this.injectedFaults = new Map();

    this.time = 0;
    this.test = null; // { targetRpm, throttle, duration, ramp, coldStart }
    this.testTimer = 0;

    /** Son ateşlenen silindir (UI için) */
    this.lastFiredCyl = null;
    this.fireFlash = 0;
    /** Her silindir için misfire durumu */
    this.misfire = new Array(7).fill(false);
    this._misfireDecide = 0;

    this.modifiers = this._computeModifiers();
    this.recomputeMetrics();
  }

  setLayout(layout) {
    this.layout = layout;
    this.firingOrder = layout === 'v6' ? [...V6_FIRING_ORDER] : [...INLINE6_FIRING_ORDER];
    this.firingMap = buildFiringMap(this.firingOrder);
    this.misfire = new Array(7).fill(false);
    this.onEvent({
      type: 'layout',
      severity: 'info',
      title: 'Düzen değiştirildi',
      message:
        layout === 'v6'
          ? 'V6 düzenine geçildi (60° V açısı, ateşleme sırası 1-4-2-5-3-6).'
          : 'Sıralı 6 düzenine geçildi (720°, ateşleme sırası 1-5-3-6-2-4).',
    });
  }

  selectPart(categoryId, optionId) {
    const cat = PART_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return;
    const opt = cat.options.find((o) => o.id === optionId);
    if (!opt) return;

    const prev = this.selected[categoryId];
    if (prev === optionId) return;
    this.selected[categoryId] = optionId;

    this._refreshFaultsFromParts();
    this.modifiers = this._computeModifiers();
    this.recomputeMetrics();

    this.onEvent({
      type: 'part',
      severity: opt.faults.length ? 'warning' : 'info',
      title: `${cat.name} → ${opt.name}`,
      message: opt.desc,
      partCategory: categoryId,
      optionId,
    });

    // Stat değişim özeti
    const m = opt.modifiers;
    const lines = [];
    if (m.power && m.power !== 1) lines.push(`güç ×${m.power.toFixed(2)}`);
    if (m.vibration && m.vibration !== 1) lines.push(`titreşim ×${m.vibration.toFixed(2)}`);
    if (m.heat && m.heat !== 1) lines.push(`ısı ×${m.heat.toFixed(2)}`);
    if (m.boost) lines.push(`boost ${m.boost} bar`);
    if (lines.length) {
      this.onEvent({
        type: 'stats',
        severity: 'info',
        title: 'Etki hesaplandı',
        message: `Değişim etkisi: ${lines.join(', ')}.`,
      });
    }

    // Arıza varsa anında olay yarat
    for (const fid of opt.faults) {
      this._raiseFault(fid, `Parça değişikliği: ${opt.name}`);
    }
  }

  _refreshFaultsFromParts() {
    // Parçalardan gelen kalıcı arızaları yeniden kur
    const fromParts = new Set();
    for (const [catId, optId] of Object.entries(this.selected)) {
      const cat = PART_CATEGORIES.find((c) => c.id === catId);
      const opt = cat?.options.find((o) => o.id === optId);
      if (opt) for (const f of opt.faults) fromParts.add(f);
    }
    // Parça kaynaklı olmayan (enjekte) arızaları koru
    for (const f of [...this.activeFaults]) {
      if (!fromParts.has(f) && !this.injectedFaults.has(f)) this.activeFaults.delete(f);
    }
    for (const f of fromParts) this.activeFaults.add(f);
  }

  _computeModifiers() {
    const acc = {
      power: 1,
      durability: 1,
      vibration: 1,
      heat: 1,
      friction: 1,
      rpmLimit: 1,
      valveTiming: 1,
      ignitionReliability: 1,
      fuel: 1,
      boost: 0,
      heatDissipation: 1,
      turboLag: 0,
      parasiticLoss: 0,
    };
    for (const [catId, optId] of Object.entries(this.selected)) {
      const cat = PART_CATEGORIES.find((c) => c.id === catId);
      const opt = cat?.options.find((o) => o.id === optId);
      if (!opt) continue;
      for (const [k, v] of Object.entries(opt.modifiers)) {
        if (k === 'boost') acc.boost = v;
        else if (acc[k] === undefined) acc[k] = v;
        else if (typeof v === 'number' && k !== 'boost') acc[k] *= v;
        else acc[k] = v;
      }
    }
    // Arıza modifier'ları
    for (const fid of this.activeFaults) {
      // Arızalar zaten parça üzerinden geldiyse modifier yeterli;
      // enjekte arızalar için FAULT_DEFS üzerinden ek katsayı uygula
    }
    return acc;
  }

  _raiseFault(id, source) {
    if (this.activeFaults.has(id)) return;
    this.activeFaults.add(id);
    const def = FAULT_DEFS[id];
    this.onEvent({
      type: 'fault',
      severity: def.severity,
      title: `Arıza: ${def.name}`,
      message: `${def.message} (${source})`,
      faultId: id,
      visual: def.visual,
    });
    this.modifiers = this._computeModifiers();
    this.recomputeMetrics();
  }

  clearFault(id) {
    if (!this.activeFaults.has(id)) return;
    let fromPart = false;
    for (const [catId, sel] of Object.entries(this.selected)) {
      const cat = PART_CATEGORIES.find((c) => c.id === catId);
      const opt = cat?.options.find((o) => o.id === sel);
      if (opt?.faults.includes(id)) fromPart = true;
    }
    if (fromPart) return; // parça değişmeden kalıcı arıza temizlenemez

    this.activeFaults.delete(id);
    this.injectedFaults.delete(id);
    const def = FAULT_DEFS[id];
    this.onEvent({
      type: 'fault',
      severity: 'info',
      title: `Giderildi: ${def.name}`,
      message: 'Arıza geçici olarak giderildi.',
      faultId: id,
    });
    this.modifiers = this._computeModifiers();
    this.recomputeMetrics();
  }

  injectFault(id, durationSec) {
    this.injectedFaults.set(id, this.time + durationSec);
    this._raiseFault(id, 'Test senaryosu');
  }

  setTest(test) {
    this.test = test;
    this.testTimer = test.duration || 5;
    if (test.coldStart) this.temperature = 18;
    if (!this.running) this.start();
    this.onEvent({
      type: 'test',
      severity: 'info',
      title: 'Test başlatıldı',
      message: `Süre: ${test.duration || 5} sn.`,
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.targetRpm = Math.max(IDLE_RPM, this.targetRpm);
    this.onEvent({
      type: 'lifecycle',
      severity: 'success',
      title: 'Motor çalıştırıldı',
      message: `Rölanti: ${Math.round(this.targetRpm)} RPM.`,
    });
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.throttle = 0;
    this.onEvent({
      type: 'lifecycle',
      severity: 'info',
      title: 'Motor durduruldu',
      message: 'Krank yavaşça durdu.',
    });
  }

  setThrottle(v) {
    this.throttle = Math.max(0, Math.min(100, v));
  }

  setManualRpm(v) {
    this.targetRpm = Math.max(200, Math.min(7500, v));
  }

  recomputeMetrics() {
    const m = this.modifiers;
    // Maks tork: 320 Nm taban × güç modifier'ları
    let maxTorque = 320 * m.power;
    if (m.boost) maxTorque *= 1 + m.boost * 0.35;
    if (m.parasiticLoss) maxTorque *= 0.97;
    this.maxTorque = maxTorque;
    this.rpmLimit = Math.round(REDLINE * (m.rpmLimit || 1));
  }

  /** Krank açısına göre anlık piston pozisyonları (0..1, 1 = TDC) */
  pistonPhases() {
    const phases = [];
    for (let c = 1; c <= 6; c++) {
      const fireAt = this.firingMap[c];
      // 0° = TDC ateşleme; 180° = BDC
      const rel = ((this.crankAngle - fireAt) % 720 + 720) % 720;
      phases.push({
        cyl: c,
        angle: rel,
        // cos ile 0=üst ölü nokta, 1=alt
        pos: (1 - Math.cos((rel * Math.PI) / 180)) / 2,
        onPowerStroke: rel >= 0 && rel < 180,
        firing: rel < 8 && this.running,
        misfire: this.misfire[c],
      });
    }
    return phases;
  }

  update(dt) {
    this.time += dt;

    // Geçici arıza süreleri
    for (const [id, end] of [...this.injectedFaults]) {
      if (this.time >= end) {
        this.injectedFaults.delete(id);
        this.clearFault(id);
      }
    }

    // Test zamanlayıcı
    if (this.test) {
      this.testTimer -= dt;
      if (this.test.ramp) {
        const progress = 1 - Math.max(0, this.testTimer / this.test.duration);
        const start = IDLE_RPM;
        this.targetRpm = start + (this.test.targetRpm - start) * progress;
        this.throttle = this.test.throttle;
      } else {
        this.targetRpm = this.test.targetRpm;
        this.throttle = this.test.throttle ?? this.throttle;
      }
      if (this.testTimer <= 0) {
        this.test = null;
        this.targetRpm = IDLE_RPM;
        this.throttle = 0;
        this.onEvent({
          type: 'test',
          severity: 'success',
          title: 'Test tamamlandı',
          message: 'Motor rölantiye döndü.',
        });
      }
    }

    const m = this.modifiers;

    // RPM dinamiği
    if (this.running) {
      const gasRpm = IDLE_RPM + (this.throttle / 100) * (this.rpmLimit - IDLE_RPM) * 0.95;
      let effectiveTarget;
      if (this.test) {
        effectiveTarget = this.targetRpm;
      } else if (this.throttle > 2) {
        effectiveTarget = gasRpm;
      } else {
        effectiveTarget = Math.min(this.targetRpm, this.rpmLimit);
      }
      effectiveTarget = Math.max(IDLE_RPM, Math.min(this.rpmLimit, effectiveTarget));

      const accel = 1400 * dt * (0.4 + this.throttle / 100);
      if (this.rpm < effectiveTarget) this.rpm = Math.min(effectiveTarget, this.rpm + accel);
      else this.rpm = Math.max(effectiveTarget, this.rpm - 900 * dt);

      // Devir kesici
      if (this.rpm >= this.rpmLimit) {
        this.rpm = this.rpmLimit;
        if (this.fireFlash <= 0) {
          this.onEvent({
            type: 'revlimit',
            severity: 'warning',
            title: 'Devir kesici',
            message: `Kırmızı çizgi: ${this.rpmLimit} RPM – ateşleme kesildi.`,
          });
          this.fireFlash = 1.5;
        }
      }
      if (this.fireFlash > 0) this.fireFlash -= dt;
    } else {
      this.rpm = Math.max(0, this.rpm - 1200 * dt);
    }

    // Krank açısı
    this.crankAngle = (this.crankAngle + (this.rpm / 60) * 360 * dt) % 720;

    // Boost (turbo gecikmeli)
    const targetBoost = this.running && m.boost ? (m.boost * this.throttle) / 100 : 0;
    const boostRate = m.turboLag ? 0.8 : 4.0;
    this.boost += (targetBoost - this.boost) * Math.min(1, boostRate * dt);

    // Ateşleme kontrolü
    const fireAt = activeCylinder(this.crankAngle, this.firingMap, 8);
    if (fireAt !== null && this.running && this.rpm > 50) {
      // Misfire kararı
      if (this.time - this._misfireDecide > 0.5) {
        this._misfireDecide = this.time;
        const rel = this.activeFaults.has('misfire') || this.activeFaults.has('fouledPlugs');
        for (let c = 1; c <= 6; c++) {
          this.misfire[c] = rel && Math.random() < 0.55;
        }
      }
      const isMis = this.misfire[fireAt] || this.fireFlash > 0;
      if (!isMis) {
        this.lastFiredCyl = fireAt;
        this.onEvent({
          type: 'combustion',
          severity: 'info',
          silent: true,
          title: `Ateşleme #${fireAt}`,
          message: `Krank ${this.crankAngle.toFixed(0)}° – silindir ${fireAt} ateşledi.`,
          cyl: fireAt,
        });
      } else {
        this.onEvent({
          type: 'combustion',
          severity: 'warning',
          silent: true,
          title: `Misfire #${fireAt}`,
          message: `Silindir ${fireAt} ateşleme atladı!`,
          cyl: fireAt,
          visual: 'spark',
        });
      }
    }

    // Metrikler
    this.recomputeMetrics();
    const rpmN = this.rpm / 7200;
    // Tork eğrisi: düşük devirde turbo gecikmesi, ortada tepe
    let torqueCurve = Math.max(0, Math.sin(Math.min(1.2, rpmN * Math.PI * 0.9)) * 1.05);
    if (m.turboLag && this.modifiers.boost > 0) {
      torqueCurve *= 0.55 + 0.45 * (this.boost / this.modifiers.boost);
    }
    const duty = this.running ? 0.25 + 0.75 * (this.throttle / 100) : 0;
    this.torque = this.maxTorque * torqueCurve * duty * (this.misfireAny() ? 0.72 : 1);
    this.power = (this.torque * this.rpm) / 7127; // hp

    // Isı: ısı üretimi ↔ soğutma denge (stok sistem ~90-105°C'de dengelenir)
    const heatGen = (this.running ? 1 : 0) * (0.5 + rpmN * 0.55 + this.throttle / 400) * (m.heat || 1);
    const coolingCap = (m.heatDissipation || 1) * 1.0; // radyatör kapasitesi (çarpan)
    const targetTemp = 25 + (heatGen * 60) / coolingCap;
    const coolRate = 0.06 * coolingCap;
    this.temperature += (targetTemp - this.temperature) * Math.min(1, coolRate * dt * 10);

    if (this.temperature > 130) {
      if (!this.activeFaults.has('overheat') && !this.injectedFaults.has('overheat')) {
        this._raiseFault('overheat', 'Termal sınır');
      }
    } else if (this.activeFaults.has('overheat') && this.temperature < 105 && !this.injectedFaults.has('overheat')) {
      this.clearFault('overheat');
    }
    if (this.temperature < 20) this.temperature = 20;

    // Yakıt tüketimi (L/s gösterimi için L/100km yerine anlık L/h)
    this.fuelRate = this.running
      ? (2 + (this.power / 100) * 8 + (this.modifiers.fuel - 1) * 10) * 0.1
      : 0;

    // Titreşim
    const baseVib = 0.15 + rpmN * 0.4 + this.throttle / 400;
    const faultVib = this.modifiers.vibration || 1;
    const targetVib = Math.min(1.5, baseVib * faultVib);
    this.vibration += (targetVib - this.vibration) * Math.min(1, dt * 3);
    if (this.vibration > 0.9) {
      // süreklilik için düşük öncelikli olay üretme (rate limit)
      if (!this._vibEventAt || this.time - this._vibEventAt > 4) {
        this._vibEventAt = this.time;
        this.onEvent({
          type: 'vibration',
          severity: this.vibration > 1.1 ? 'warning' : 'info',
          title: 'Yüksek titreşim',
          message: `Titreşim seviyesi %${Math.round(this.vibration * 100)} – mekanik dengesizlik.`,
          visual: 'shake',
        });
      }
    }
  }

  misfireAny() {
    return this.misfire.slice(1).some(Boolean);
  }

  /** HUD için özet */
  snapshot() {
    return {
      rpm: this.rpm,
      torque: this.torque,
      power: this.power,
      vibration: this.vibration,
      temperature: this.temperature,
      boost: this.boost,
      running: this.running,
      crankAngle: this.crankAngle,
      throttle: this.throttle,
      faults: [...this.activeFaults],
      misfire: this.misfire.slice(1),
      lastFiredCyl: this.lastFiredCyl,
      layout: this.layout,
      firingOrder: this.firingOrder,
      rpmLimit: this.rpmLimit,
    };
  }
}
