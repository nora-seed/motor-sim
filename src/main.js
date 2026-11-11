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

// ---------- Olay akışı ----------
const log = new EventLog();
const sound = new EngineSound();

const engine = new Engine((event) => {
  log.push(event);
  handleVisualEvent(event);
});

// ---------- Three.js sahne ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
scene.fog = new THREE.Fog(0x0d1117, 12, 28);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(4.5, 3, 5.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 0.4, 0);
controls.minDistance = 2.5;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI * 0.85;

// Işıklar
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

// Zemin
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(14, 48),
  new THREE.MeshStandardMaterial({ color: 0x161b22, metalness: 0.2, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.4;
ground.receiveShadow = true;
scene.add(ground);

// Motor
const materials = createMaterials();
const motor = new MotorModel(materials);
scene.add(motor.root);

const effects = new Effects(scene);
effects.init();

const metrics = new MetricsPanel();

// ---------- UI başlat ----------
initPartsPanel(engine, (layout) => {
  motor.setLayout(layout);
  effects.clear();
  motor.clearBreakage();
  log.push({
    type: 'layout',
    severity: 'info',
    title: 'Sahne yeniden kuruldu',
    message: layout === 'v6' ? 'V6 geometrisi yüklendi.' : 'Sıralı 6 geometrisi yüklendi.',
  });
});

initTestsPanel(engine);
initControls(engine, () => sound.resume());

// RPM/throttle slider'ı senkron tut
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
const faultVisualMap = new Map(); // faultId → visual

function handleVisualEvent(event) {
  // Ses (ateşleme tıklamalarını sınırla – yüksek RPM'de yük olmasın)
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

  // Kırılma / efektler
  if (event.type === 'fault') {
    const visual = event.visual;
    if (event.faultId && event.title.startsWith('Giderildi')) {
      faultVisualMap.delete(event.faultId);
      if (faultVisualMap.size === 0) motor.clearBreakage();
    } else if (visual && event.faultId && !faultVisualMap.has(event.faultId)) {
      faultVisualMap.set(event.faultId, visual);
      const origin = new THREE.Vector3(0, 0.5, 0);
      if (visual === 'spark') {
        effects.burstSpark(origin);
      } else if (visual === 'smoke') {
        effects.emitSmoke(new THREE.Vector3(-1, 1.2, 0.6));
      } else if (visual === 'steam') {
        effects.emitSteam(new THREE.Vector3(1.5, 0.6, -0.5));
        effects.emitSteam(new THREE.Vector3(-1.5, 0.6, -0.5));
      } else if (visual === 'crack' || visual === 'shake') {
        motor.showBreakage('crack');
        effects.burstSpark(origin);
      }
      shakeAmount = visual === 'shake' ? 0.5 : 0.2;
    }
  }

  if (event.type === 'layout') {
    faultVisualMap.clear();
    motor.clearBreakage();
  }

  if (event.type === 'test') {
    shakeAmount = 0.15;
  }
}

function currentVisual() {
  // Aktif arızaların en ağır görselini seç
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

// ---------- Kesit / butonlar ----------
document.getElementById('btn-cutaway').addEventListener('click', () => {
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
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Ana döngü ----------
const clock = new THREE.Clock();
let sparkCooldown = 0;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);

  engine.update(dt);
  const snap = engine.snapshot();
  const phases = engine.pistonPhases();

  motor.update(snap, phases, dt);
  motor.updateBreakage(dt);

  // Turbo görünürlüğü (şarj sistemi seçiliyse görünür)
  const induction = engine.selected.induction;
  motor.setTurboRequired(induction === 'turbo' || induction === 'supercharged');
  if (motor.turboGroup) {
    motor.turboGroup.visible = induction === 'turbo' || induction === 'supercharged';
  }

  // Parça arıza vurgusu
  setFaultHighlight(materials, currentVisual());

  // Sürekli duman/buhar (aktif arızalara göre)
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

  // Titreşim sarsıntısı
  if (shakeAmount > 0 || snap.vibration > 0.85) {
    const amp = Math.max(shakeAmount, (snap.vibration - 0.7) * 0.12);
    camera.position.x += (Math.random() - 0.5) * amp * 0.06;
    camera.position.y += (Math.random() - 0.5) * amp * 0.06;
    shakeAmount = Math.max(0, shakeAmount - dt * 0.5);
  }

  // UI
  updateHud(snap);
  metrics.update(snap);
  sound.update(snap);

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();

// ---------- Service Worker ----------
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// İlk karşılama olayı
log.push({
  type: 'info',
  severity: 'success',
  title: 'Simülasyon hazır',
  message: 'Parçaları değiştirin, testleri çalıştırın, olayları izleyin.',
});
