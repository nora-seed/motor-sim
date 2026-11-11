import { PART_CATEGORIES, TEST_SCENARIOS } from '../config/parts.js';

export function initPartsPanel(engine, onLayoutChange) {
  const container = document.getElementById('parts-container');
  container.innerHTML = '';

  for (const cat of PART_CATEGORIES) {
    const section = document.createElement('div');
    section.className = 'part-category';
    section.innerHTML = `
      <h3><span class="cat-icon">${cat.icon}</span> ${cat.name}</h3>
      <div class="part-options" data-cat="${cat.id}"></div>
    `;
    container.appendChild(section);

    const optsWrap = section.querySelector('.part-options');
    for (const opt of cat.options) {
      const btn = document.createElement('button');
      btn.className = 'part-option' + (engine.selected[cat.id] === opt.id ? ' selected' : '');
      btn.dataset.opt = opt.id;
      const faultTag = opt.faults.length
        ? '<span class="tag fault">Arızalı</span>'
        : opt.price > 0
          ? `<span class="tag">${opt.price.toLocaleString('tr-TR')} ₺</span>`
          : '<span class="tag">Standart</span>';
      btn.innerHTML = `
        <div class="opt-head"><strong>${opt.name}</strong>${faultTag}</div>
        <p>${opt.desc}</p>
      `;
      btn.addEventListener('click', () => {
        engine.selectPart(cat.id, opt.id);
        optsWrap.querySelectorAll('.part-option').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      optsWrap.appendChild(btn);
    }
  }

  // Düzen değiştirici
  const layoutWrap = document.getElementById('layout-switch');
  layoutWrap.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      layoutWrap.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      onLayoutChange(b.dataset.layout);
    });
  });
}

export function initTestsPanel(engine) {
  const container = document.getElementById('tests-container');
  container.innerHTML = '<h3>Test Senaryoları</h3>';
  for (const t of TEST_SCENARIOS) {
    const btn = document.createElement('button');
    btn.className = 'btn test-btn';
    btn.innerHTML = `<strong>${t.name}</strong><span>${t.desc}</span>`;
    btn.addEventListener('click', () => t.run(engine));
    container.appendChild(btn);
  }
}

export function initControls(engine, onResumeAudio) {
  const rpmSlider = document.getElementById('rpm-slider');
  const rpmValue = document.getElementById('rpm-value');
  const throttleSlider = document.getElementById('throttle-slider');
  const throttleValue = document.getElementById('throttle-value');

  rpmSlider.addEventListener('input', () => {
    const v = Number(rpmSlider.value);
    rpmValue.textContent = v;
    engine.setManualRpm(v);
    onResumeAudio?.();
  });

  throttleSlider.addEventListener('input', () => {
    const v = Number(throttleSlider.value);
    throttleValue.textContent = v + '%';
    engine.setThrottle(v);
    onResumeAudio?.();
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    onResumeAudio?.();
    engine.start();
  });
  document.getElementById('btn-stop').addEventListener('click', () => {
    onResumeAudio?.();
    engine.stop();
  });

  // Tab değiştirme
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Panel aç/kapat
  document.getElementById('btn-panel').addEventListener('click', () => {
    document.getElementById('panel').classList.toggle('open');
  });
}

export function updateHud(snap) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('hud-rpm', Math.round(snap.rpm).toLocaleString('tr-TR'));
  set('hud-torque', Math.round(snap.torque) + ' Nm');
  set('hud-power', snap.power.toFixed(0) + ' hp');
  set('hud-vib', Math.round(snap.vibration * 100) + '%');
  set('hud-temp', snap.temperature.toFixed(0) + '°C');
  set('hud-boost', snap.boost.toFixed(2) + ' bar');

  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (snap.running) {
    dot.className = 'dot on';
    txt.textContent = 'Çalışıyor';
  } else {
    dot.className = 'dot off';
    txt.textContent = 'Durduruldu';
  }
}
