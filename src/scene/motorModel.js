import * as THREE from 'three';

const CYL_SPACING = 0.62; // silindir arası mesafe
const BORE = 0.44;
const STROKE = 0.4; // piston kayması (çizim ölçeği)
const ROD_LEN = 0.75;

/**
 * Prosedürel 6 silindir motor modeli.
 * Inline-6 ve V6 düzenlerini üretir; update() ile krank/piston animasyonu yapar.
 */
export class MotorModel {
  constructor(materials) {
    this.mats = materials;
    this.root = new THREE.Group();
    this.layout = 'inline6';
    this.cylGroups = []; // her silindir için { group, piston, rod, valves, spark, bankAngle }
    this.crankGroup = new THREE.Group();
    this.camGroup = new THREE.Group();
    this.turboGroup = null;
    this.brokenBits = [];
    this._buildInline6();
  }

  _clear() {
    while (this.root.children.length) {
      const c = this.root.children[0];
      this.root.remove(c);
      c.traverse?.((o) => {
        o.geometry?.dispose?.();
      });
    }
    this.cylGroups = [];
    this.brokenBits = [];
    this.turboGroup = null;
  }

  setLayout(layout) {
    if (layout === this.layout) return;
    this.layout = layout;
    this._clear();
    if (layout === 'v6') this._buildV6();
    else this._buildInline6();
  }

  // ---------- inşa ----------

  _buildInline6() {
    this.layout = 'inline6';
    const { mats } = this;

    // Blok
    const totalLen = CYL_SPACING * 6 + 0.35;
    const block = new THREE.Mesh(new THREE.BoxGeometry(totalLen, 1.15, 1.05), mats.block);
    block.position.y = 0.15;
    block.castShadow = block.receiveShadow = true;
    block.name = 'block';
    this.root.add(block);

    // Silindir başlığı
    const head = new THREE.Mesh(new THREE.BoxGeometry(totalLen, 0.5, 1.0), mats.blockHead);
    head.position.y = 0.95;
    head.castShadow = true;
    head.name = 'head';
    this.root.add(head);

    // Yağ panosu
    const pan = new THREE.Mesh(new THREE.BoxGeometry(totalLen - 0.1, 0.35, 0.9), mats.oilPan);
    pan.position.y = -0.55;
    pan.name = 'oilPan';
    this.root.add(pan);

    // Krank mili
    this._buildCrank(totalLen);

    // Eksantrik (üstte)
    this._buildCam(totalLen);

    // Silindirler
    for (let i = 0; i < 6; i++) {
      const x = -totalLen / 2 + 0.35 + i * CYL_SPACING;
      this.cylGroups.push(this._buildCylinder(x, 0, 0));
    }

    // Buji telleri (kırmızı aksan)
    for (let i = 0; i < 6; i++) {
      const x = -totalLen / 2 + 0.35 + i * CYL_SPACING;
      const wire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6),
        mats.redAccent
      );
      wire.position.set(x, 1.45, 0.25);
      wire.rotation.z = 0.3;
      this.root.add(wire);
    }

    // Egzoz manifoldu (arka)
    this._buildExhaust(totalLen, 0);

    // Şarj sistemi
    this._buildInduction(totalLen);
  }

  _buildV6() {
    this.layout = 'v6';
    const { mats } = this;
    const totalLen = CYL_SPACING * 3 + 0.5;
    const bankAngle = Math.PI / 6; // 30° each side = 60° V

    // V blok (merkez)
    const block = new THREE.Mesh(new THREE.BoxGeometry(totalLen, 1.0, 1.2), mats.block);
    block.position.y = 0.1;
    block.castShadow = block.receiveShadow = true;
    block.name = 'block';
    this.root.add(block);

    // V'nin iki tarafında kafa
    const vAngle = Math.PI / 3; // 60°

    this._buildCrank(totalLen);

    // Her banka 3 silindir
    for (let bank = 0; bank < 2; bank++) {
      const side = bank === 0 ? -1 : 1;
      const bankAngleDeg = (side * vAngle) / 2;
      const bankGroup = new THREE.Group();
      bankGroup.rotation.z = bankAngleDeg;
      bankGroup.position.set(0, 0.35, 0);
      this.root.add(bankGroup);

      // Kafa
      const head = new THREE.Mesh(new THREE.BoxGeometry(totalLen, 0.45, 0.85), mats.blockHead);
      head.position.y = 0.85;
      head.castShadow = true;
      bankGroup.add(head);

      for (let i = 0; i < 3; i++) {
        const x = -totalLen / 2 + 0.4 + i * CYL_SPACING;
        const cyl = this._buildCylinder(x, 0, bankGroup, true);
        cyl.bankAngle = bankAngleDeg;
        cyl.bankSide = side;
        this.cylGroups.push(cyl);
      }

      // Egzoz manifold bu bankada
      const ex = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, totalLen - 0.2, 10),
        mats.exhaust
      );
      ex.rotation.z = Math.PI / 2;
      ex.position.set(0, 0.7, side * 0.55);
      bankGroup.add(ex);
    }

    // Yağ panosu
    const pan = new THREE.Mesh(new THREE.BoxGeometry(totalLen - 0.15, 0.35, 1.0), mats.oilPan);
    pan.position.y = -0.5;
    pan.name = 'oilPan';
    this.root.add(pan);

    this._buildCam(totalLen);
    this._buildExhaust(totalLen, 0, true);
    this._buildInduction(totalLen);
  }

  _buildCrank(totalLen) {
    const { mats } = this;
    this.crankGroup = new THREE.Group();
    this.crankGroup.name = 'crank';

    // Ana şaft
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, totalLen + 0.3, 14),
      mats.crank
    );
    shaft.rotation.z = Math.PI / 2;
    this.crankGroup.add(shaft);

    // Krank kolları + ağırlıklar (her silindir için)
    this.crankThrows = [];
    const spacing = this.layout === 'v6' ? (CYL_SPACING * 3 + 0.5) / 3 : CYL_SPACING;
    const count = 6;
    const start = -(count - 1) / 2;
    // Faz: inline-6 klasik 0/120/240... çift düzlük
    const phases = [];
    if (this.layout === 'inline6') {
      // 1-5-3-6-2-4 için krank fazları (derece)
      const order = [0, 240, 120, 120, 240, 0]; // roughly flat-plane pairs
      for (let i = 0; i < 6; i++) phases.push((order[i] * Math.PI) / 180);
    } else {
      for (let i = 0; i < 6; i++) phases.push((i * 120 * Math.PI) / 180);
    }

    for (let i = 0; i < 6; i++) {
      const x = (start + i) * spacing * (this.layout === 'v6' ? 1 : 1);
      const throwGroup = new THREE.Group();
      throwGroup.position.x = this.layout === 'v6' ? x : x;
      throwGroup.userData.phase = phases[i];

      // Pin
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 10), mats.steel);
      pin.rotation.z = Math.PI / 2;
      pin.position.y = 0.16;
      throwGroup.add(pin);

      // Karşılıklı ağırlık
      const weight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.16), mats.crank);
      weight.position.y = -0.14;
      throwGroup.add(weight);

      // Kollar (biyel yatağı)
      const web1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), mats.crank);
      web1.position.set(-0.1, 0.05, 0);
      throwGroup.add(web1);
      const web2 = web1.clone();
      web2.position.x = 0.1;
      throwGroup.add(web2);

      this.crankGroup.add(throwGroup);
      this.crankThrows.push(throwGroup);
    }

    // Volan
    const flywheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.12, 24),
      mats.darkSteel
    );
    flywheel.rotation.z = Math.PI / 2;
    flywheel.position.x = totalLen / 2 + 0.25;
    this.crankGroup.add(flywheel);

    this.root.add(this.crankGroup);
  }

  _buildCam(totalLen) {
    const { mats } = this;
    this.camGroup = new THREE.Group();
    this.camGroup.name = 'cam';

    const cam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, totalLen - 0.1, 10),
      mats.cam
    );
    cam.rotation.z = Math.PI / 2;
    cam.position.y = 1.28;
    this.camGroup.add(cam);

    // Kam lopları
    this.cams = [];
    const spacing = this.layout === 'v6' ? (CYL_SPACING * 3 + 0.5) / 3 : CYL_SPACING;
    for (let i = 0; i < 6; i++) {
      const x = (-(5) / 2 + i) * spacing;
      for (let lobe = 0; lobe < 2; lobe++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mats.cam);
        l.scale.set(1, 0.6, 1);
        l.position.set(x + (lobe ? 0.09 : -0.09), 1.28, 0);
        l.userData.phase = (i * 120 + lobe * 30) * (Math.PI / 180);
        this.camGroup.add(l);
        this.cams.push(l);
      }
    }

    // Zamanlama dişlisi (ön uç)
    const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), mats.darkSteel);
    gear.rotation.z = Math.PI / 2;
    gear.position.set(-totalLen / 2 - 0.08, 1.28, 0);
    this.camGroup.add(gear);

    this.root.add(this.camGroup);
  }

  _buildExhaust(totalLen, y, isV = false) {
    const { mats } = this;
    if (isV) return; // V6'da bankalar ekliyor
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, totalLen - 0.2, 12),
      mats.exhaust
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 0.4, -0.62);
    this.root.add(pipe);
    // Çıkış borusu
    const out = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.7, 12),
      mats.exhaust
    );
    out.rotation.x = Math.PI / 2.4;
    out.position.set(totalLen / 2 - 0.3, 0.3, -0.95);
    this.root.add(out);
  }

  _buildInduction(totalLen) {
    const { mats } = this;
    // Emme kolektörü
    const plenum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, totalLen - 0.4, 12),
      mats.darkSteel
    );
    plenum.rotation.z = Math.PI / 2;
    plenum.position.set(0, 1.1, 0.62);
    this.root.add(plenum);

    // Borular
    for (let i = 0; i < 6; i++) {
      const x = -(CYL_SPACING * 5) / 2 + i * CYL_SPACING;
      const runner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 0.35, 8),
        mats.darkSteel
      );
      runner.position.set(x, 1.15, 0.42);
      runner.rotation.x = 0.7;
      this.root.add(runner);
    }

    // Hava filtresi kutusu
    const filter = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), mats.plastic);
    filter.position.set(-totalLen / 2 - 0.3, 1.1, 0.62);
    this.root.add(filter);

    // Turbo (seçiliyse görünür – ana sahne toggle eder)
    this.turboGroup = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.08, 10, 20), mats.turbo);
    housing.rotation.y = Math.PI / 2;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), mats.steel);
    shaft.rotation.z = Math.PI / 2;
    this.turboGroup.add(housing, shaft);
    this.turboGroup.position.set(totalLen / 2 - 0.1, 0.75, -0.55);
    this.turboGroup.visible = false;
    this.root.add(this.turboGroup);

    // Radyatör (ön)
    const rad = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 1.1), mats.darkSteel);
    rad.position.set(-totalLen / 2 - 0.75, 0.55, 0);
    this.root.add(rad);
    for (let i = 0; i < 6; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 1.12), mats.steel);
      fin.position.set(-totalLen / 2 - 0.75, 0.2 + i * 0.15, 0);
      this.root.add(fin);
    }
  }

  /** Tek silindir grubu: silindir kovanı yarı saydam, piston, biyel, supaplar, buji */
  _buildCylinder(x, z, parentOrY, isV = false) {
    const { mats } = this;
    const group = new THREE.Group();
    const parent = isV ? parentOrY : this.root;
    const yPos = isV ? 0.55 : 0.55;
    group.position.set(x, yPos, isV ? 0 : 0);
    parent.add(group);

    // Kovan (kesit modunda şeffaflaşır)
    const liner = new THREE.Mesh(
      new THREE.CylinderGeometry(BORE / 2, BORE / 2, 0.9, 20, 1, true),
      mats.glass.clone()
    );
    liner.material.transparent = true;
    liner.material.opacity = 0.22;
    liner.material.side = THREE.DoubleSide;
    liner.name = 'liner';
    group.add(liner);

    // Dış silindir (katı halka)
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(BORE / 2 + 0.05, BORE / 2 + 0.05, 0.9, 20, 1, true),
      mats.block.clone()
    );
    outer.material.transparent = true;
    outer.material.opacity = 0.35;
    outer.material.side = THREE.DoubleSide;
    outer.name = 'cylOuter';
    group.add(outer);

    // Piston
    const piston = new THREE.Mesh(
      new THREE.CylinderGeometry(BORE / 2 - 0.02, BORE / 2 - 0.02, 0.16, 20),
      mats.piston
    );
    piston.castShadow = true;
    piston.name = 'piston';
    group.add(piston);

    // Segeller
    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(BORE / 2 - 0.02, 0.012, 6, 20),
        mats.darkSteel
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05 - r * 0.03;
      piston.add(ring);
    }

    // Biyel
    const rod = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, ROD_LEN, 0.06),
      mats.steel
    );
    rod.castShadow = true;
    rod.name = 'rod';
    group.add(rod);

    // Supaplar (2: emme/egzoz)
    const valves = [];
    for (let v = 0; v < 2; v++) {
      const valve = new THREE.Group();
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.35, 6),
        mats.valve
      );
      const headV = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.045, 0.04, 12),
        mats.valve
      );
      headV.position.y = -0.18;
      valve.add(stem, headV);
      valve.position.set(v ? 0.12 : -0.12, 0.95, 0);
      valve.userData.side = v; // 0 emme, 1 egzoz
      group.add(valve);
      valves.push(valve);
    }

    // Buji
    const plug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6),
      mats.copper
    );
    plug.position.y = 1.1;
    group.add(plug);

    // Kıvılcım deliği (ateşleme anında ışık)
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      mats.spark.clone()
    );
    spark.material.transparent = true;
    spark.material.opacity = 0;
    spark.position.y = 0.7;
    spark.name = 'sparkFX';
    group.add(spark);

    return {
      group,
      piston,
      rod,
      valves,
      spark,
      liner,
      outer,
      bankAngle: 0,
      bankSide: 0,
      x,
      broken: false,
    };
  }

  // ---------- animasyon ----------

  /**
   * @param {Object} state Engine.snapshot()
   * @param {Array} phases pistonPhases()
   */
  update(state, phases, dt) {
    const spin = (state.crankAngle * Math.PI) / 180;
    this.crankGroup.rotation.x = -spin;
    if (this.camGroup) this.camGroup.rotation.x = -spin / 2;

    if (this.turboGroup) {
      const boostPart = state.boost > 0.05;
      this.turboGroup.visible = this.turboGroup.userData.required === true || boostPart;
      if (boostPart) this.turboGroup.rotation.x += dt * 40 * (state.boost / 0.6);
    }

    for (const phase of phases) {
      const cg = this.cylGroups[phase.cyl - 1];
      if (!cg) continue;

      // Piston: 0 = üst, 1 = alt
      const yOff = 0.32 - phase.pos * STROKE;
      cg.piston.position.y = yOff;

      // Biyel: piston pin'den krank pinine
      const throwPhase = this.crankThrows?.[phase.cyl - 1]?.userData.phase ?? 0;
      const crankR = 0.16;
      const crankY = Math.cos(spin + throwPhase) * crankR;
      const crankZ = Math.sin(spin + throwPhase) * crankR;
      // Grup içinde krank noktası (aşağıda)
      const pinLocal = { y: yOff - 0.08 - 0, z: 0 };
      // Basitleştirilmiş biyel yönelimi
      const dy = (yOff - 0.15) - crankY * 0.3;
      cg.rod.position.y = (yOff - 0.08 + (crankY * 0.3)) / 2 - 0.1;
      cg.rod.position.z = crankZ * 0.35;
      cg.rod.rotation.x = Math.atan2(crankZ * 0.5, Math.max(0.2, dy)) * 0.8;
      void pinLocal;

      // Supaplar
      for (const valve of cg.valves) {
        // Kaba zamanlama: valf açılış penceresi
        const rel = phase.angle;
        const isIntake = valve.userData.side === 0;
        let open = 0;
        if (isIntake) {
          // emme: 180-300 civarı (ateşleme sonrası)
          const d = rel - 200;
          open = Math.max(0, 1 - Math.abs(d) / 70);
        } else {
          // egzoz: 320-450
          const d = rel - 380;
          open = Math.max(0, 1 - Math.abs(d) / 70);
        }
        // Arıza: kopuk kam → valf hiç açılmaz
        const timingOk = state.faults?.includes('brokenCam') ? 0 : 1;
        valve.position.y = 0.95 - open * 0.09 * timingOk;
      }

      // Kıvılcım
      const wantSpark = phase.firing && !phase.misfire && state.running;
      const wantMis = phase.firing && phase.misfire && state.running;
      const targetOp = wantSpark ? 0.95 : wantMis ? 0.45 : 0;
      cg.spark.material.opacity += (targetOp - cg.spark.material.opacity) * Math.min(1, dt * 20);
      if (wantSpark) {
        cg.spark.material.color.setHex(0xffee88);
        cg.spark.scale.setScalar(1 + Math.sin(state.time * 40) * 0.15);
      } else if (wantMis) {
        cg.spark.material.color.setHex(0xff6644);
        cg.spark.scale.setScalar(0.7);
      }

      // Çatlak görseli
      const cracked = state.faults?.includes('crackedPiston');
      cg.piston.material = cracked ? this.mats.redAccent : this.mats.piston;
    }
  }

  /** Belirli bir silindiri vurgula (ateşleme anı) */
  flashCylinder(cyl) {
    const cg = this.cylGroups[cyl - 1];
    if (!cg) return;
    cg.spark.material.opacity = 1;
  }

  setTurboRequired(required) {
    if (this.turboGroup) this.turboGroup.userData.required = required;
  }

  /** Arıza görseli: blok kırık parçalar */
  showBreakage(kind) {
    if (this.brokenBits.length) return;
    const { mats } = this;
    if (kind === 'crack' || kind === 'shake') {
      for (let i = 0; i < 5; i++) {
        const bit = new THREE.Mesh(
          new THREE.TetrahedronGeometry(0.06 + Math.random() * 0.05),
          mats.darkSteel
        );
        bit.position.set((Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 0.8);
        bit.userData.vel = new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          Math.random() * 0.8,
          (Math.random() - 0.5) * 0.5
        );
        this.root.add(bit);
        this.brokenBits.push(bit);
      }
    }
  }

  clearBreakage() {
    for (const b of this.brokenBits) {
      this.root.remove(b);
      b.geometry.dispose();
    }
    this.brokenBits = [];
  }

  updateBreakage(dt) {
    for (const b of this.brokenBits) {
      b.userData.vel.y -= 2.5 * dt;
      b.position.addScaledVector(b.userData.vel, dt);
      b.rotation.x += dt * 3;
      b.rotation.z += dt * 2;
      if (b.position.y < -1.2) b.position.y = -1.2;
    }
  }
}
