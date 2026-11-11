/** 6 silindir ateşleme sıraları ve zamanlama yardımcıları */

// Sıralı 6 (inline-6): 720°'de 6 ateşleme → 120° aralık
// Klasik inline-6 sırası: 1-5-3-6-2-4
export const INLINE6_FIRING_ORDER = [1, 5, 3, 6, 2, 4];

// V6 (60° V): 1-2-3-4-5-6 bank düzenine göre klasik sıralı ateşleme
// Basitleştirilmiş: bank1 (1,3,5) / bank2 (2,4,6) → 1-4-2-5-3-6
export const V6_FIRING_ORDER = [1, 4, 2, 5, 3, 6];

export const FIRING_INTERVAL = 720 / 6; // 120 derece krank

/**
 * Her silindirin ateşleme açısı (0-720) mappingini üretir.
 * @param {number[]} order ateşleme sırası (1 tabanlı silindir numaraları)
 * @returns {Object<number, number>} silindirNo → 0-720 arası ateşleme açısı
 */
export function buildFiringMap(order) {
  const map = {};
  order.forEach((cyl, idx) => {
    map[cyl] = idx * FIRING_INTERVAL;
  });
  return map;
}

/**
 * Krank açısına göre hangi silindir ateşleme yapıyor.
 * @returns {number|null} 1 tabanlı silindir no
 */
export function activeCylinder(crankAngle, firingMap, tolerance = 6) {
  const angle = ((crankAngle % 720) + 720) % 720;
  for (const [cyl, fireAt] of Object.entries(firingMap)) {
    let diff = Math.abs(angle - fireAt);
    if (diff > 360) diff = 720 - diff;
    if (diff <= tolerance) return Number(cyl);
  }
  return null;
}

/**
 * Supap açılış/kapanış pencereleri (krank açısı, 0-720).
 * Basitleştirilmiş ama gerçekçi görünüm için: emme 0-180, egzoz 360-540 çevresi.
 */
export function valveEvents(cyl, firingMap, timingFactor = 1.0) {
  const fireAt = firingMap[cyl];
  // Egzoz açılışı ateşlemeden ~45° önce, emme 180° sonra (kaba ama okunabilir)
  const exhaustOpen = fireAt - 45 * timingFactor;
  const exhaustClose = fireAt + 135 * timingFactor;
  const intakeOpen = fireAt + 180 - 20 * timingFactor;
  const intakeClose = fireAt + 180 + 60 * timingFactor;
  const norm = (a) => ((a % 720) + 720) % 720;
  return {
    exhaust: [norm(exhaustOpen), norm(exhaustClose)],
    intake: [norm(intakeOpen), norm(intakeClose)],
  };
}

/** 720°'lik tek devrin parçaları (grafik için) */
export function cycleSegments(crankAngle) {
  const a = ((crankAngle % 720) + 720) % 720;
  const cylPos = (c) => {
    // Basit 4 zaman: 0=TDC emme, 180=BDC, 360=TDC egzoz, 540=BDC
    return ((a + (c - 1) * 120) % 720 + 720) % 720;
  };
  return { angle: a, cylPos };
}
