import * as THREE from 'three';

/** Blender-vari metal/plastik malzeme paleti */
export function createMaterials() {
  const mats = {
    block: new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      metalness: 0.75,
      roughness: 0.45,
      side: THREE.DoubleSide,
    }),
    blockHead: new THREE.MeshStandardMaterial({
      color: 0x4a525c,
      metalness: 0.8,
      roughness: 0.35,
      side: THREE.DoubleSide,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: 0xb8bec6,
      metalness: 0.92,
      roughness: 0.28,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: 0x6a7078,
      metalness: 0.88,
      roughness: 0.4,
    }),
    piston: new THREE.MeshStandardMaterial({
      color: 0xd4d8dc,
      metalness: 0.9,
      roughness: 0.25,
    }),
    crank: new THREE.MeshStandardMaterial({
      color: 0x8a9099,
      metalness: 0.95,
      roughness: 0.3,
    }),
    cam: new THREE.MeshStandardMaterial({
      color: 0x9aa2ab,
      metalness: 0.9,
      roughness: 0.32,
    }),
    valve: new THREE.MeshStandardMaterial({
      color: 0xc8ccd2,
      metalness: 0.95,
      roughness: 0.2,
    }),
    copper: new THREE.MeshStandardMaterial({
      color: 0xc47a3a,
      metalness: 0.85,
      roughness: 0.35,
    }),
    plastic: new THREE.MeshStandardMaterial({
      color: 0x1f242a,
      metalness: 0.1,
      roughness: 0.75,
    }),
    redAccent: new THREE.MeshStandardMaterial({
      color: 0xb03030,
      metalness: 0.5,
      roughness: 0.5,
    }),
    turbo: new THREE.MeshStandardMaterial({
      color: 0xd0d4da,
      metalness: 0.9,
      roughness: 0.3,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x88aacc,
      metalness: 0.1,
      roughness: 0.1,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    spark: new THREE.MeshBasicMaterial({
      color: 0xffee88,
      transparent: true,
      opacity: 0.95,
    }),
    exhaust: new THREE.MeshStandardMaterial({
      color: 0x4a4f55,
      metalness: 0.8,
      roughness: 0.55,
    }),
    oilPan: new THREE.MeshStandardMaterial({
      color: 0x2a2f35,
      metalness: 0.6,
      roughness: 0.6,
    }),
  };
  return mats;
}

/** Kesit modunda blok malzemelerini şeffaf yap */
export function setCutaway(mats, enabled) {
  for (const key of ['block', 'blockHead', 'oilPan']) {
    const m = mats[key];
    m.transparent = enabled;
    m.opacity = enabled ? 0.18 : 1;
    m.depthWrite = !enabled;
    m.needsUpdate = true;
  }
}

/** Arıza görsel vurgusu */
export function setFaultHighlight(mats, faultVisual) {
  const base = 0x3a4048;
  const hot = 0xaa3333;
  if (faultVisual === 'crack' || faultVisual === 'shake') {
    mats.block.emissive = new THREE.Color(faultVisual === 'crack' ? 0x551111 : 0x442200);
    mats.block.emissiveIntensity = 0.55;
  } else if (faultVisual === 'steam') {
    mats.block.emissive = new THREE.Color(0x663311);
    mats.block.emissiveIntensity = 0.4;
  } else {
    mats.block.emissive = new THREE.Color(0x000000);
    mats.block.emissiveIntensity = 0;
  }
  mats.block.color.setHex(faultVisual === 'crack' ? 0x5a3030 : base);
  void hot;
}
