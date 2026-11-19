// Fishing: stand on the bank (or in the shallows) of a fishing water, cast,
// watch the float, and click when it dips. People from the roster sit on the
// bank with rods too; their tackle is drawn here, their comings and goings are
// in people.js.
import * as THREE from 'three';
import { makeRod } from './figure.js';
import { fishable, castPoint, ripple, SURFACE } from './water.js';
import { fishCatch } from './game.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const floatGeo = (() => {
  const top = new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), bot = new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  return [top, bot];
})();
const red = new THREE.MeshLambertMaterial({ color: 0xe03a2a, emissive: 0x401008 }), white = new THREE.MeshLambertMaterial({ color: 0xf4f0e6 });
const lineMat = new THREE.LineBasicMaterial({ color: 0xe8e8e0, transparent: true, opacity: 0.7 });
const _v = new THREE.Vector3();

function tackle(scene) {
  const float = new THREE.Group(); float.add(new THREE.Mesh(floatGeo[0], red), new THREE.Mesh(floatGeo[1], white));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geo, lineMat); line.frustumCulled = false;
  float.traverse(o => { o.userData.looked = true; }); line.userData.looked = true;
  scene.add(float, line); float.visible = line.visible = false;
  return { float, line };
}
// Stretch the line from the rod tip to the float.
function string(t, rod) {
  rod.userData.tip.getWorldPosition(_v);
  const a = t.line.geometry.attributes.position; a.setXYZ(0, _v.x, _v.y, _v.z); a.setXYZ(1, t.float.position.x, t.float.position.y + 0.08, t.float.position.z); a.needsUpdate = true;
}

export class Fishing {
  constructor(scene, ctx) {
    this.scene = scene; this.ctx = ctx; this.state = null; this.t = 0;
    this.rod = makeRod(); this.rod.visible = false; ctx.fig.sockets.handL.add(this.rod);
    this.me = tackle(scene);
    this.npc = new Map();       // person -> { rod, tk, spot, next, bite }
  }
  get active() { return !!this.state; }
  // Where the healer could fish from right now, or null.
  spot() { const p = this.ctx.player; return p.water === 'swim' ? null : fishable(p.x, p.z); }

  start() {
    const c = this.ctx, p = c.player, why = c.blocked();
    if (why) return c.err(why);
    const b = this.spot();
    if (!b) return c.err(p.water === 'swim' ? "Can't fish while swimming" : 'You need to stand at the water\'s edge');
    const at = castPoint(b, p.x, p.z, p.yaw + p.camOff);
    p.yaw = Math.atan2(at.x - p.x, at.z - p.z); p.camOff = 0;
    this.body = b; this.at = at; this.state = 'cast'; this.t = 0; this.rod.visible = true;
    this.me.float.visible = this.me.line.visible = true;
    c.sfx('cast');
    if (!c.S.seenFish) { c.S.seenFish = true; c.chat('c-sys', 'Watch the float. When it dips, click (or press G, or the Fish button) to reel in. Moving stops fishing.'); }
  }
  // Click while the float is down to land the catch; too soon and the hook comes up empty.
  reel() {
    const c = this.ctx;
    if (this.state === 'bite') {
      const res = fishCatch(c.S);
      ripple(this.at.x, this.at.z, 1.6, 0.9); c.splash(this.at.x, this.at.z, 18);
      this.stop(); c.caught(res, this.body); return true;
    }
    if (this.state === 'wait' || this.state === 'cast') { this.stop(); c.chat('c-sys', 'You reel in too soon. Nothing on the hook.'); return true; }
    return false;
  }
  stop(msg) {
    if (!this.state) return;
    this.state = null; this.rod.visible = false; this.me.float.visible = this.me.line.visible = false;
    if (msg) this.ctx.chat('c-sys', msg);
  }
  hint() {
    return this.state === 'bite' ? 'Bite! Click now, or press G' : this.state ? 'Watch the float. Click when it dips' : '';
  }

  // Someone from the roster sits down at a bank spot with a rod.
  attach(p, spot, body) {
    if (this.npc.has(p)) return;
    const rod = makeRod(), hand = p.fig.sockets.handL;
    for (const o of hand.children) o.visible = false;      // the shield or off-hand dagger goes away for now
    hand.add(rod);
    const tk = tackle(this.scene), m = Math.hypot(spot.fx - spot.x, spot.fz - spot.z) || 1;
    const fx = spot.x + (spot.fx - spot.x) / m * 5.5, fz = spot.z + (spot.fz - spot.z) / m * 5.5;
    tk.float.position.set(fx, SURFACE, fz); tk.float.visible = tk.line.visible = true;
    this.npc.set(p, { rod, tk, spot, body, x: fx, z: fz, next: rnd(6, 16), bite: 0 });
  }
  detach(p) {
    const n = this.npc.get(p); if (!n) return;
    const hand = p.fig.sockets.handL; hand.remove(n.rod);
    for (const o of hand.children) o.visible = true;
    this.scene.remove(n.tk.float, n.tk.line); n.tk.line.geometry.dispose();
    this.npc.delete(p);
  }

  update(dt, t) {
    const c = this.ctx;
    if (this.state) {
      const why = c.blocked(true);
      if (why) this.stop(why === 'combat' ? 'You stop fishing.' : '');
    }
    if (this.state) {
      this.t += dt; const f = this.me.float;
      if (this.state === 'cast') {
        this.rod.userData.tip.getWorldPosition(_v);
        const k = Math.min(1, this.t / 0.7);
        f.position.set(_v.x + (this.at.x - _v.x) * k, _v.y + (SURFACE - _v.y) * k + Math.sin(k * Math.PI) * 1.6, _v.z + (this.at.z - _v.z) * k);
        if (k >= 1) { this.state = 'wait'; this.t = 0; this.wait = rnd(4, 11); ripple(this.at.x, this.at.z, 1.1, 0.7); c.splash(this.at.x, this.at.z, 6); }
      } else if (this.state === 'wait') {
        f.position.set(this.at.x, SURFACE + Math.sin(t * 2.4) * 0.02, this.at.z);
        if (Math.random() < dt * 0.4) ripple(this.at.x, this.at.z, 0.5, 0.35);
        if (this.t > this.wait) { this.state = 'bite'; this.t = 0; c.sfx('tick'); c.splash(this.at.x, this.at.z, 10); ripple(this.at.x, this.at.z, 1, 0.8); }
      } else if (this.state === 'bite') {
        f.position.set(this.at.x + Math.sin(t * 40) * 0.03, SURFACE - 0.13 + Math.sin(t * 25) * 0.04, this.at.z);
        if (this.t > 1.6) this.stop('It got away.');
      }
      if (this.state) string(this.me, this.rod);
    }
    for (const [p, n] of this.npc) {
      if (n.bite > 0) {
        n.bite -= dt; n.tk.float.position.y = SURFACE - 0.12 + Math.sin(t * 25) * 0.04;
        if (n.bite <= 0) { ripple(n.x, n.z, 1.4, 0.8); c.splash(n.x, n.z, 12); if (c.npcCatch) c.npcCatch(p, Math.random() < 0.65); n.next = rnd(10, 26); }
      } else {
        n.tk.float.position.y = SURFACE + Math.sin(t * 2.2 + n.x) * 0.02;
        if ((n.next -= dt) <= 0) { n.bite = rnd(0.6, 1.2); ripple(n.x, n.z, 0.9, 0.6); }
        else if (Math.random() < dt * 0.25) ripple(n.x, n.z, 0.45, 0.3);
      }
      if (p.fig.group.visible) string(n.tk, n.rod);
      n.tk.float.visible = n.tk.line.visible = p.fig.group.visible;
    }
  }
}
