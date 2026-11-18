// Sparkles: one pooled particle cloud for every spell, fire and portal.
// Particles are drawn additively, so fading a colour to black fades it out;
// the Storybook bloom picks up the brightest ones as a soft glow.
import * as THREE from 'three';
import { canvasTex } from './figure.js';

const N = 1600;
const dot = canvasTex(32, 32, (x, w) => {
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, w);
});
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a, b) => a + Math.random() * (b - a), _v = new THREE.Vector3(), _c = new THREE.Color();

export class Sparkles {
  constructor(scene) {
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3); this.base = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N);
    this.grav = new Float32Array(N); this.next = 0; this.sources = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.32, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
    this.points.frustumCulled = false; scene.add(this.points);
  }
  // One burst: n particles at (x,y,z) spread out by `spread`, moving at `vel`
  // plus a random `jitter`, rising by `up`, living `life` seconds.
  emit(x, y, z, { n = 10, color = 0xfff2a8, spread = 0.3, vel = [0, 0, 0], jitter = 0.6, up = 1, life = 1, grav = 0 } = {}) {
    if (calm) n = Math.ceil(n / 3);
    _c.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.next, j = i * 3; this.next = (i + 1) % N;
      this.pos[j] = x + rnd(-spread, spread); this.pos[j + 1] = y + rnd(-spread, spread) * 0.6; this.pos[j + 2] = z + rnd(-spread, spread);
      this.vel[j] = vel[0] + rnd(-jitter, jitter); this.vel[j + 1] = vel[1] + up * rnd(0.5, 1.2); this.vel[j + 2] = vel[2] + rnd(-jitter, jitter);
      this.base[j] = _c.r; this.base[j + 1] = _c.g; this.base[j + 2] = _c.b;
      this.max[i] = this.life[i] = life * rnd(0.7, 1.2); this.grav[i] = grav;
    }
  }
  // A steady emitter (fire, portal), only running near the viewer.
  source(x, y, z, rate, opts, near = 70) { const s = { x, y, z, rate, opts, near, acc: 0, on: true }; this.sources.push(s); return s; }

  update(dt, eye) {
    for (const s of this.sources) {
      if (!s.on || Math.abs(s.x - eye.x) > s.near || Math.abs(s.z - eye.z) > s.near) continue;
      s.acc += s.rate * dt;
      while (s.acc >= 1) { s.acc--; this.emit(s.x, s.y, s.z, { ...s.opts, n: 1 }); }
    }
    const P = this.pos, V = this.vel, C = this.col, B = this.base;
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      if (this.life[i] <= 0) { if (C[j] || C[j + 1] || C[j + 2]) C[j] = C[j + 1] = C[j + 2] = 0; continue; }
      this.life[i] -= dt;
      V[j + 1] -= this.grav[i] * dt; V[j] *= 1 - dt * 1.2; V[j + 2] *= 1 - dt * 1.2;
      P[j] += V[j] * dt; P[j + 1] += V[j + 1] * dt; P[j + 2] += V[j + 2] * dt;
      const k = Math.max(0, this.life[i] / this.max[i]), f = k > 0.8 ? (1 - k) * 5 : k;   // quick fade in, slow fade out
      C[j] = B[j] * f; C[j + 1] = B[j + 1] * f; C[j + 2] = B[j + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
  }
}
