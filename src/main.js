import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './styles/main.css';
import { Engine } from './engine/Engine.js';
import { createMaterials, setCutaway, setFaultHighlight } from './scene/materials.js';
import { MotorModel } from './scene/motorModel.js';
import { Effects } from './scene/effects.js';
import { EventLog } from './ui/eventLog.js';
import { MetricsPanel } from './ui/metrics.js';
import { initPartsPanel, initTestsPanel, initControls, updateHud } from './ui/panels.js';
import { EngineSound } from './audio/engineSound.js';

function fatal(err) {
  console.error(err);
  if (typeof window.__showError === 'function') {
    window.__showError((err && err.stack) || err);
    const ov = document.getElementById('error-overlay');
    if (ov) ov.dataset.fatal = '1';
  } else {
    alert('Hata: ' + ((err && err.message) || err));
  }
}

try {
  boot();
} catch (err) {
  fatal(err);
}

function boot() {
  // ---------- Olay akışı ----------
  const log = new EventLog();
  const sound = new EngineSound();

  const engine = new Engine((event) => {
    log.push(event);
    handleVisualEvent(event);
  });

  // ---------- UI: önce arayüz, sonra 3D (UI her koşulda çalışsın) ----------
  initPartsPanel(engine, (layout) => {
    if (motor) {
      motor.setLayout(layout);
      effects?.clear();
      motor.clearBreakage();
    }
    log.push({
      type: 'layout',
      severity: 'info',
      title: 'Sahne yeniden kuruldu',
      message: layout === 'v6' ? 'V6 geometrisi yüklendi.' : 'Sıralı 6 geometrisi yüklendi.',
    });
  });

  initTestsPanel(engine);
  initControls(engine, () => sound.resume());

  // RPM/throttle slider senkronu
  setInterval(() => {
    const rpmSlider = document.getElementById('rpm-slider');
    const thrSlider = document.getElementById('throttle-slider');
    if (rpmSlider && document.activeElement !== rpmSlider) {
      rpmSlider.value = Math.round(engine.targetRpm);
      document.getElementById('rpm-value').textContent = Math.round(engine.targetRpm);
    }
    if (thrSlider && document.activeElement !== thrSlider) {
      thrSlider.value = Math.round(engine.throttle);
      document.getElementById('throttle-value').textContent = Math.round(engine.throttle) + '%';
    }
  }, 250);

  // ---------- Görsel olaylar ----------
  let cutaway = false;
  let shakeAmount = 0;
  const faultVisualMap = new Map();

  function handleVisualEvent(event) {
    const now = performance.now();
    if (event.type === 'combustion' && event.severity === 'info') {
      if (now - (handleVisualEvent._lastClick || 0) > 40) {
        handleVisualEvent._lastClick = now;
        sound.click(0.4);
      }
    } else if (event.type === 'combustion' && event.severity === 'warning') {
      if (now - (handleVisualEvent._lastMis || 0) > 150) {
        handleVisualEvent._lastMis = now;
        sound.click(1.0);
        sound.beep(220, 0.08);
      }
    } else if (event.severity === 'critical') {
      sound.beep(180, 0.35);
      sound.beep(140, 0.4);
    } else if (event.severity === 'warning') {
      sound.beep(520, 0.15);
    }

    if (event.type === 'fault') {
      const visual = event.visual;
      if (event.faultId && event.title.startsWith('Giderildi')) {
        faultVisualMap.delete(event.faultId);
        if (faultVisualMap.size === 0) motor?.clearBreakage();
      } else if (visual && event.faultId && !faultVisualMap.has(event.faultId)) {
        faultVisualMap.set(event.faultId, visual);
        if (effects) {
          const origin = new THREE.Vector3(0, 0.5, 0);
          if (visual === 'spark') effects.burstSpark(origin);
          else if (visual === 'smoke') effects.emitSmoke(new THREE.Vector3(-1, 1.2, 0.6));
          else if (visual === 'steam') {
            effects.emitSteam(new THREE.Vector3(1.5, 0.6, -0.5));
            effects.emitSteam(new THREE.Vector3(-1.5, 0.6, -0.5));
          } else if (visual === 'crack' || visual === 'shake') {
            motor?.showBreakage('crack');
            effects.burstSpark(origin);
          }
        }
        shakeAmount = visual === 'shake' ? 0.5 : 0.2;
      }
    }

    if (event.type === 'layout') {
      faultVisualMap.clear();
      motor?.clearBreakage();
    }
    if (event.type === 'test') shakeAmount = 0.15;
  }

  function currentVisual() {
    const order = ['stop', 'crack', 'shake', 'steam', 'smoke', 'spark', 'timing'];
    let best = null;
    for (const fid of engine.activeFaults) {
      const v = faultVisualMap.get(fid);
      if (!v) continue;
      const idx = order.indexOf(v);
      if (best === null || (idx >= 0 && order.indexOf(best) < idx)) best = v;
    }
    return best;
  }

  // ---------- Three.js (try/catch: WebGL yoksa UI kalsın) ----------
  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let materials = null;
  let motor = null;
  let effects = null;

  try {
    const canvas = document.getElementById('scene');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    scene.fog = new THREE.Fog(0x0d1117, 12, 28);

    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(4.5, 3, 5.5);

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.4, 0);
    controls.minDistance = 2.5;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.85;

    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x1a1510, 0.55);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff2e0, 1.6);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x6699ff, 0.7);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    const fill = new THREE.PointLight(0xffaa66, 0.4, 20);
    fill.position.set(0, 2, 4);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshStandardMaterial({ color: 0x161b22, metalness: 0.2, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.4;
    ground.receiveShadow = true;
    scene.add(ground);

    materials = createMaterials();
    motor = new MotorModel(materials);
    scene.add(motor.root);

    effects = new Effects(scene);
    effects.init();
  } catch (webglErr) {
    console.warn('WebGL başlatılamadı, arayüz devam ediyor:', webglErr);
    // Paneli kilitleme: sadece sahne alanı üzerinde uyarı göster
    const canvas = document.getElementById('scene');
    if (canvas) {
      canvas.style.display = 'none';
    }
    let note = document.getElementById('webgl-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'webgl-note';
      note.style.cssText =
        'position:absolute;inset:52px 0 70px 0;display:flex;align-items:center;justify-content:center;' +
        'background:#0d1117;color:#8b949e;font:14px system-ui;text-align:center;padding:24px;z-index:5;';
      note.innerHTML =
        '<div><strong style="color:#f85149">3D sahne açılamadı</strong><br><br>' +
        'Tarayıcınız WebGL desteklemiyor veya devre dışı.<br>' +
        'Aşağıdaki paneller ve simülasyon yine çalışır.<br><br><code style="font-size:11px"></code></div>';
      document.getElementById('app').appendChild(note);
    }
    const code = note.querySelector('code');
    if (code) code.textContent = String((webglErr && webglErr.message) || webglErr);
  }

  const metrics = new MetricsPanel();

  // ---------- Kesit / ses butonları ----------
  document.getElementById('btn-cutaway').addEventListener('click', () => {
    if (!materials) return;
    cutaway = !cutaway;
    setCutaway(materials, cutaway);
    document.getElementById('btn-cutaway').classList.toggle('active', cutaway);
    log.push({
      type: 'ui',
      severity: 'info',
      title: cutaway ? 'Kesit görünümü açık' : 'Kesit görünümü kapalı',
      message: cutaway ? 'Blok şeffaf – piston ve krank görünür.' : 'Dış kaplama geri geldi.',
    });
  });

  document.getElementById('btn-sound').addEventListener('click', () => {
    sound.resume();
    const on = sound.toggle();
    document.getElementById('btn-sound').textContent = on ? '🔊' : '🔇';
  });

  // ---------- PWA install ----------
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('btn-install').classList.remove('hidden');
  });
  document.getElementById('btn-install').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById('btn-install').classList.add('hidden');
  });

  // ---------- Resize ----------
  function resize() {
    if (!renderer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w < 1 || h < 1) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Ana döngü ----------
  const clock = new THREE.Clock();
  let sparkCooldown = 0;
  let frame = 0;

  function tick() {
    requestAnimationFrame(tick);
    frame++;
    try {
      const dt = Math.min(clock.getDelta(), 0.05);

      engine.update(dt);
      const snap = engine.snapshot();
      const phases = engine.pistonPhases();

      if (motor && scene) {
        motor.update(snap, phases, dt);
        motor.updateBreakage(dt);

        const induction = engine.selected.induction;
        motor.setTurboRequired(induction === 'turbo' || induction === 'supercharged');
        if (motor.turboGroup) {
          motor.turboGroup.visible = induction === 'turbo' || induction === 'supercharged';
        }

        setFaultHighlight(materials, currentVisual());

        sparkCooldown -= dt;
        if (sparkCooldown <= 0 && snap.running) {
          sparkCooldown = 0.15;
          if (snap.misfire.some(Boolean)) {
            effects.burstSpark(new THREE.Vector3((Math.random() - 0.5) * 2, 0.8, 0));
          }
          if (snap.faults.includes('cloggedIntake') || snap.faults.includes('fouledPlugs')) {
            effects.emitSmoke(new THREE.Vector3(-1.8, 1.1, 0.6));
          }
          if (snap.temperature > 115) {
            effects.emitSteam(new THREE.Vector3(1.6, 0.7, -0.4));
          }
        }
        effects.update(dt);

        if (shakeAmount > 0 || snap.vibration > 0.85) {
          const amp = Math.max(shakeAmount, (snap.vibration - 0.7) * 0.12);
          camera.position.x += (Math.random() - 0.5) * amp * 0.06;
          camera.position.y += (Math.random() - 0.5) * amp * 0.06;
          shakeAmount = Math.max(0, shakeAmount - dt * 0.5);
        }
      }

      updateHud(snap);
      metrics.update(snap);
      sound.update(snap);

      if (controls) controls.update();
      if (renderer && scene && camera) renderer.render(scene, camera);

      // İlk karelerde hata yoksa (fatal olmayan) overlay'i gizle
      if (frame === 2) {
        const ov = document.getElementById('error-overlay');
        if (ov && ov.dataset.fatal !== '1') ov.classList.add('hidden');
      }
    } catch (tickErr) {
      if (frame < 5) fatal(tickErr);
      console.error('tick hatası:', tickErr);
    }
  }

  tick();

  // ---------- Service Worker ----------
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  log.push({
    type: 'info',
    severity: 'success',
    title: 'Simülasyon hazır',
    message: 'Parçaları değiştirin, testleri çalıştırın, olayları izleyin.',
  });
}
