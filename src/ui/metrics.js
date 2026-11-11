/** Metrik kartları + güç eğrisi + zamanlama grafiği */

export class MetricsPanel {
  constructor() {
    this.wrap = document.getElementById('metrics-container');
    this.powerCanvas = document.getElementById('power-chart');
    this.timingCanvas = document.getElementById('timing-chart');
    this.powerCtx = this.powerCanvas.getContext('2d');
    this.timingCtx = this.timingCanvas.getContext('2d');
    this.history = []; // {rpm, power, torque}
    this.maxHistory = 180;

    this.cards = [
      { id: 'm-rpm', label: 'Devir', unit: 'RPM' },
      { id: 'm-torque', label: 'Tork', unit: 'Nm' },
      { id: 'm-power', label: 'Güç', unit: 'hp' },
      { id: 'm-vib', label: 'Titreşim', unit: '%' },
      { id: 'm-temp', label: 'Su Sıcaklığı', unit: '°C' },
      { id: 'm-boost', label: 'Boost', unit: 'bar' },
      { id: 'm-fuel', label: 'Yakıt', unit: 'L/h' },
      { id: 'm-faults', label: 'Aktif Arıza', unit: 'adet' },
    ];

    this.wrap.innerHTML = this.cards
      .map(
        (c) => `
      <div class="metric-card" id="${c.id}">
        <div class="metric-label">${c.label}</div>
        <div class="metric-value">—<span class="metric-unit"> ${c.unit}</span></div>
      </div>`
      )
      .join('');
  }

  update(snap) {
    const set = (id, val) => {
      const el = document.querySelector(`#${id} .metric-value`);
      if (el) el.innerHTML = val;
    };
    set('m-rpm', `${Math.round(snap.rpm).toLocaleString('tr-TR')}<span class="metric-unit"> RPM</span>`);
    set('m-torque', `${Math.round(snap.torque)}<span class="metric-unit"> Nm</span>`);
    set('m-power', `${snap.power.toFixed(0)}<span class="metric-unit"> hp</span>`);
    set('m-vib', `${Math.round(snap.vibration * 100)}<span class="metric-unit"> %</span>`);
    set('m-temp', `${snap.temperature.toFixed(0)}<span class="metric-unit"> °C</span>`);
    set('m-boost', `${snap.boost.toFixed(2)}<span class="metric-unit"> bar</span>`);
    set('m-fuel', `${snap.fuelRate.toFixed(1)}<span class="metric-unit"> L/h</span>`);

    const faultCount = snap.faults.length;
    const faultEl = document.querySelector('#m-faults .metric-value');
    if (faultEl) {
      faultEl.innerHTML = `${faultCount}<span class="metric-unit"> adet</span>`;
      faultEl.classList.toggle('danger', faultCount > 0);
    }
    // Sıcaklık uyarısı
    const tempEl = document.querySelector('#m-temp .metric-value');
    if (tempEl) tempEl.classList.toggle('danger', snap.temperature > 110);

    // Geçmiş
    this.history.push({ rpm: snap.rpm, power: snap.power, torque: snap.torque });
    if (this.history.length > this.maxHistory) this.history.shift();

    this.drawPower();
    this.drawTiming(snap);
  }

  drawPower() {
    const ctx = this.powerCtx;
    const w = this.powerCanvas.width;
    const h = this.powerCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    // Izgara
    ctx.strokeStyle = '#21262d';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (this.history.length < 2) {
      ctx.fillStyle = '#6e7681';
      ctx.font = '11px system-ui';
      ctx.fillText('Veri toplanıyor…', 10, 20);
      return;
    }

    const maxPower = Math.max(100, ...this.history.map((p) => p.power)) * 1.15;
    const maxTorque = Math.max(200, ...this.history.map((p) => p.torque)) * 1.15;

    // Güç eğrisi
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.history.forEach((p, i) => {
      const x = (i / (this.maxHistory - 1)) * w;
      const y = h - (p.power / maxPower) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Tork eğrisi
    ctx.strokeStyle = '#f0883e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.history.forEach((p, i) => {
      const x = (i / (this.maxHistory - 1)) * w;
      const y = h - (p.torque / maxTorque) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Lejant
    ctx.font = '10px system-ui';
    ctx.fillStyle = '#58a6ff';
    ctx.fillText('Güç (hp)', 6, 12);
    ctx.fillStyle = '#f0883e';
    ctx.fillText('Tork (Nm)', 70, 12);
  }

  drawTiming(snap) {
    const ctx = this.timingCtx;
    const w = this.timingCanvas.width;
    const h = this.timingCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    const rowH = h / 6;
    const angle = snap.crankAngle;

    // Zaman çizgisi
    for (let c = 1; c <= 6; c++) {
      const y = (c - 1) * rowH;
      ctx.fillStyle = c % 2 ? '#161b22' : '#0d1117';
      ctx.fillRect(0, y, w, rowH);

      // Etiket
      ctx.fillStyle = '#8b949e';
      ctx.font = '10px system-ui';
      ctx.fillText(`#${c}`, 4, y + rowH / 2 + 3);

      // 720° şerit
      const x0 = 28;
      const barW = w - x0 - 6;
      ctx.strokeStyle = '#30363d';
      ctx.strokeRect(x0, y + 6, barW, rowH - 12);

      // Ateşleme işareti
      const fireAt = (c - 1) * 120; // basit: sıra indeksi
      // Gerçek sırayı snap'ten al
      const order = snap.firingOrder || [1, 5, 3, 6, 2, 4];
      const idx = order.indexOf(c);
      const realFire = idx >= 0 ? idx * 120 : fireAt;
      const fx = x0 + (realFire / 720) * barW;
      ctx.fillStyle = snap.misfire[c - 1] ? '#ff5555' : '#ffd33d';
      ctx.fillRect(fx - 1.5, y + 4, 3, rowH - 8);

      // Mevcut krank pozisyonu
      const cx = x0 + (angle / 720) * barW;
      ctx.fillStyle = '#3fb950';
      ctx.fillRect(cx - 1, y + 4, 2, rowH - 8);

      // Güç stroku bandı (ateşleme sonrası 180°)
      const pw0 = x0 + (realFire / 720) * barW;
      const pw1 = x0 + ((realFire + 180) / 720) * barW;
      ctx.fillStyle = 'rgba(88, 166, 255, 0.15)';
      ctx.fillRect(pw0, y + 6, Math.min(pw1, x0 + barW) - pw0, rowH - 12);
      if (pw1 > x0 + barW) {
        ctx.fillRect(x0, y + 6, pw1 - (x0 + barW), rowH - 12);
      }
    }

    // Başlık
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px system-ui';
    ctx.fillText(`Krank ${angle.toFixed(0)}° / 720° · ateşleme: ${snap.firingOrder.join('-')}`, 28, h - 3);
  }
}
