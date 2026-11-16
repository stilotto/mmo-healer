// Keyboard, mouse and touch, the way the big MMOs do it: WASD with keyboard
// turning, right-drag to steer, left-drag to look around, wheel to zoom from
// third person all the way into first person.
import * as THREE from 'three';
import { collide } from './world.js';

const ray = new THREE.Raycaster(), head = new THREE.Vector3(), dir = new THREE.Vector3();

export class Player {
  constructor(camera, dom, blockers) {
    Object.assign(this, { camera, blockers, x: 0, z: 19, y: 0, vy: 0, yaw: Math.PI, camOff: 0, pitch: 0.28, dist: 11, lastDist: 11,
      moving: false, speed: 0, L: false, R: false, auto: false, stick: null, onClick: null, enabled: false, look: false, unlockAt: 0, dom });
    this.keys = new Set();
    const typing = e => e.target.tagName === 'INPUT';
    addEventListener('keydown', e => {
      if (typing(e) || !this.enabled) return;
      this.keys.add(e.code);
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'KeyV' && !e.repeat) this.toggleView();
      if (e.code === 'NumLock' || (e.code === 'KeyR' && !e.repeat)) this.auto = !this.auto;
      if (e.code === 'KeyW' || e.code === 'KeyS') this.auto = false;
      if (this.onKey && !e.repeat) this.onKey(e);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.L = this.R = false; });
    dom.addEventListener('contextmenu', e => e.preventDefault());

    // Mouse-look: the pointer is locked and the mouse steers with no button held.
    document.addEventListener('pointerlockchange', () => { if (!this.locked) this.unlockAt = performance.now(); this.L = this.R = false; if (this.onLock) this.onLock(this.locked); });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.yaw += this.camOff - e.movementX * 0.0032; this.camOff = 0;
      this.pitch = Math.max(-1.3, Math.min(1.45, this.pitch + e.movementY * 0.0032));
    });

    const ptr = new Map();
    dom.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      if (this.locked) { if (e.button === 0 && this.onClick) this.onClick(innerWidth / 2, innerHeight / 2); return; }
      if (this.look && e.pointerType === 'mouse') { this.lock(); return; }
      dom.setPointerCapture(e.pointerId);
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, b: e.pointerType === 'touch' ? 2 : e.button, touch: e.pointerType === 'touch', moved: 0 });
      if (e.pointerType !== 'touch') { if (e.button === 0) this.L = true; if (e.button === 2) { this.R = true; this.yaw += this.camOff; this.camOff = 0; } }
    });
    dom.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
      if (p.moved < 6) return;
      const k = p.touch ? 0.007 : 0.005;
      if (p.b === 2) { this.yaw += this.camOff - dx * k; this.camOff = 0; } else if (p.b === 0) this.camOff -= dx * k;
      this.pitch = Math.max(-1.3, Math.min(1.45, this.pitch + dy * k));
    });
    const up = e => {
      const p = ptr.get(e.pointerId); if (!p) return; ptr.delete(e.pointerId);
      if (!p.touch) { if (p.b === 0) this.L = false; if (p.b === 2) this.R = false; }
      if (p.moved < 6 && (p.b === 0 || p.touch) && this.onClick) this.onClick(e.clientX, e.clientY);
    };
    dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
    dom.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.sign(e.deltaY) * 1.6); }, { passive: false });

    // Touch stick
    const st = document.getElementById('stick'), nub = st.firstElementChild;
    const sm = e => {
      const r = st.getBoundingClientRect(); let x = (e.clientX - r.left - 55) / 45, y = (e.clientY - r.top - 55) / 45;
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
      this.stick = { x, y }; nub.style.transform = `translate(${x * 35}px,${y * 35}px)`;
    };
    st.addEventListener('pointerdown', e => { st.setPointerCapture(e.pointerId); sm(e); });
    st.addEventListener('pointermove', e => { if (this.stick) sm(e); });
    const se = () => { this.stick = null; nub.style.transform = ''; };
    st.addEventListener('pointerup', se); st.addEventListener('pointercancel', se);
  }

  zoom(d) { this.dist = Math.max(0, Math.min(30, this.dist + d)); if (this.dist < 1.2) this.dist = d < 0 ? 0 : 1.6; if (this.dist) this.lastDist = this.dist; }
  toggleView() { this.dist = this.dist ? 0 : this.lastDist; }
  get firstPerson() { return this.dist === 0; }
  get locked() { return document.pointerLockElement === this.dom; }
  lock() { try { const r = this.dom.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  free() { if (this.locked) document.exitPointerLock(); }
  setLook(on) { this.look = on; if (on) this.lock(); else this.free(); }

  update(dt) {
    const K = c => this.keys.has(c) ? 1 : 0;
    let f = Math.max(K('KeyW'), this.L && this.R ? 1 : 0, this.auto ? 1 : 0) - K('KeyS');
    this.pitch = Math.max(-1.3, Math.min(1.45, this.pitch + (K('ArrowDown') - K('ArrowUp')) * 1.4 * dt));
    const ad = K('KeyA') - K('KeyD'), steer = this.R || this.locked;
    let s = K('KeyQ') - K('KeyE') + (steer ? ad : 0);
    s = Math.max(-1, Math.min(1, s));
    this.yaw += (K('ArrowLeft') - K('ArrowRight') + (steer ? 0 : ad)) * 2.6 * dt;
    if (this.stick) { f -= this.stick.y; s -= this.stick.x; }
    const m = Math.hypot(f, s);
    this.moving = m > 0.15 || this.y > 0;
    if (m > 0.15) {
      const sp = (f < -0.1 ? 4.2 : 7) * Math.min(1, m) / m * dt;
      const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
      this.x += (sn * f + cs * s) * sp; this.z += (cs * f - sn * s) * sp;
      collide(this, 0.5);
      if (!this.L && this.camOff) { this.camOff = Math.atan2(Math.sin(this.camOff), Math.cos(this.camOff)); this.camOff *= Math.max(0, 1 - dt * 4); }
    }
    this.speed = m > 0.15 ? 1 : 0; this.back = f < -0.1;
    if (K('Space') && this.y === 0) this.vy = 7.5;
    if (this.y > 0 || this.vy > 0) { this.y += this.vy * dt; this.vy -= 22 * dt; if (this.y <= 0) { this.y = 0; this.vy = 0; } }

    // Camera
    const a = this.yaw + this.camOff, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    head.set(this.x, this.y + 1.75, this.z);
    if (this.dist === 0) {
      this.camera.position.set(this.x + Math.sin(a) * 0.2, this.y + 1.7, this.z + Math.cos(a) * 0.2);
      this.camera.lookAt(this.x + Math.sin(a) * cp * 10, this.y + 1.7 - sp * 10, this.z + Math.cos(a) * cp * 10);
    } else {
      dir.set(-Math.sin(a) * cp, sp, -Math.cos(a) * cp);
      let d = this.dist;
      ray.set(head, dir); ray.far = d + 0.5;
      const hit = ray.intersectObjects(this.blockers, true)[0];
      if (hit) d = Math.max(0.6, hit.distance - 0.5);
      this.camera.position.copy(head).addScaledVector(dir, d);
      // Look along the view direction, not at the head, so that when the
      // camera rests on the ground you can still tip the view up to the sky.
      if (this.camera.position.y < 0.35) this.camera.position.y = 0.35;
      head.copy(this.camera.position).addScaledVector(dir, -10); head.y += 0.6; this.camera.lookAt(head);
    }
  }
}
