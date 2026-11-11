import * as THREE from 'three';

/**
 * Parçacık efektleri: kıvılcım, duman, buhar.
 * Basit CPU parçacık sistemi (yeterli ölçekte).
 */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.systems = [];
  }

  _makeSystem(color, size, count, opts = {}) {
    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);

    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        life: 0,
        maxLife: 0,
        vel: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        active: false,
      });
    }

    const sys = {
      points,
      geo,
      mat,
      particles,
      count,
      spawnRate: opts.spawnRate || 30,
      gravity: opts.gravity ?? -1,
      baseSize: size,
      emitAcc: 0,
      burst: opts.burst || 0,
    };
    this.systems.push(sys);
    return sys;
  }

  init() {
    this.sparkSys = this._makeSystem(0xffcc44, 0.06, 120, {
      additive: true,
      gravity: -4,
      spawnRate: 60,
    });
    this.smokeSys = this._makeSystem(0x555555, 0.14, 80, {
      gravity: 0.6,
      spawnRate: 12,
    });
    this.steamSys = this._makeSystem(0xcfe8ff, 0.18, 90, {
      gravity: 1.2,
      spawnRate: 18,
    });
  }

  _emit(sys, origin, spread, speed) {
    for (let i = 0; i < sys.count; i++) {
      const p = sys.particles[i];
      if (p.active) continue;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.8;
      p.pos.copy(origin);
      p.pos.x += (Math.random() - 0.5) * spread.x;
      p.pos.y += (Math.random() - 0.5) * spread.y;
      p.pos.z += (Math.random() - 0.5) * spread.z;
      p.vel.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed,
        (Math.random() - 0.5) * speed
      );
      return;
    }
  }

  burstSpark(origin) {
    for (let i = 0; i < 12; i++) {
      this._emit(this.sparkSys, origin, { x: 0.1, y: 0.1, z: 0.1 }, 2.2);
    }
  }

  emitSmoke(origin) {
    this._emit(this.smokeSys, origin, { x: 0.3, y: 0.1, z: 0.3 }, 0.5);
  }

  emitSteam(origin) {
    this._emit(this.steamSys, origin, { x: 0.4, y: 0.2, z: 0.4 }, 0.8);
  }

  update(dt) {
    for (const sys of this.systems) {
      const posAttr = sys.geo.attributes.position;
      for (let i = 0; i < sys.count; i++) {
        const p = sys.particles[i];
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          posAttr.setXYZ(i, 0, -999, 0);
          continue;
        }
        p.vel.y += sys.gravity * dt;
        p.pos.addScaledVector(p.vel, dt);
        posAttr.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
      }
      posAttr.needsUpdate = true;
      sys.mat.opacity = 0.8;
    }
  }

  clear() {
    for (const sys of this.systems) {
      for (const p of sys.particles) p.active = false;
      const posAttr = sys.geo.attributes.position;
      for (let i = 0; i < sys.count; i++) posAttr.setXYZ(i, 0, -999, 0);
      posAttr.needsUpdate = true;
    }
  }
}
