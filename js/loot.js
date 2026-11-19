// Loot that matters (sprint 8): drops lie in the world with a beam in their
// rarity's colour until the healer walks over them, and Emberdeep parties
// roll Need or Greed on what the monsters leave, a roll the healer can crash.
import * as THREE from 'three';
import * as G from './game.js';
import { rec, mood } from './memory.js';

const pick = a => a[Math.floor(Math.random() * a.length)], rnd = (a, b) => a + Math.random() * (b - a);
const COL = [0xdddddd, 0x1eff00, 0x4a90ff, 0xc060ff], UCOL = 0xffa030;
const BEAM_H = [0, 5, 10, 24];
const sackGeo = new THREE.SphereGeometry(0.32, 10, 8), knotGeo = new THREE.ConeGeometry(0.14, 0.24, 8), beamGeo = new THREE.CylinderGeometry(0.42, 0.42, 1, 12, 1, true);
const sackMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });

export class Loot {
  constructor(scene, ctx) { Object.assign(this, { scene, ctx, drops: [], roll: null, queue: [], t: 0, fullAt: 0 }); this.ui(); }

  // An item lying on the ground at x, z.
  drop(x, z, it) {
    const g = new THREE.Group(), c = it.unique ? UCOL : COL[it.q];
    const sack = new THREE.Mesh(sackGeo, sackMat); sack.scale.set(1, 0.8, 1); sack.position.y = 0.26; g.add(sack);
    const knot = new THREE.Mesh(knotGeo, new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.5) })); knot.position.y = 0.6; g.add(knot);
    const h = it.unique ? 30 : BEAM_H[it.q];
    if (h) {
      const b = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      b.scale.set(it.q >= 3 ? 1.5 : 1, h, it.q >= 3 ? 1.5 : 1); b.position.y = h / 2; g.add(b); g.userData.beam = b;
    }
    g.position.set(x + rnd(-0.6, 0.6), 0, z + rnd(-0.6, 0.6)); this.scene.add(g);
    const d = { it, g, x: g.position.x, z: g.position.z, life: 300, age: 0 }; this.drops.push(d);
    if (it.q >= 2) this.ctx.sfx(it.q >= 3 ? 'level' : 'loot');
    return d;
  }
  remove(d) { this.scene.remove(d.g); this.drops.splice(this.drops.indexOf(d), 1); }

  update(dt, t) {
    this.t = t;
    const me = this.ctx.me, ghost = this.ctx.ghost();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.age += dt;
      if (d.age > d.life) { this.remove(d); continue; }
      d.g.children[1].rotation.y += dt * 2; d.g.children[0].position.y = 0.26 + Math.sin(t * 3 + d.x) * 0.04;
      const b = d.g.userData.beam; if (b) b.material.opacity = 0.24 + Math.sin(t * 2.4 + d.z) * 0.08;
      if (d.it.q >= 1 && Math.random() < dt * (d.it.q + 1) * 2 && Math.hypot(d.x - me.x, d.z - me.z) < 60) this.ctx.spark(d.x, d.z, d.it.unique ? UCOL : COL[d.it.q]);
      if (me.dead || ghost || Math.hypot(d.x - me.x, d.z - me.z) > 1.7) continue;
      if (!this.ctx.take(d.it)) { if (t > this.fullAt) { this.fullAt = t + 3; this.ctx.err('Your bag is full'); } continue; }
      this.remove(d);
    }
    this.rollUpdate(dt);
  }

  // --- Need or Greed ---
  // A party rolls on an item. The healer is not in the party, but nothing
  // stops them clicking Need.
  startRoll(it, party, from) {
    if (!party.length) return;
    this.queue.push({ it, party: party.slice(), from });
    if (!this.roll) this.next();
  }
  next() {
    const r = this.queue.shift(); this.roll = r || null; if (!r) { this.box.style.display = 'none'; return; }
    Object.assign(r, { t: 0, dur: 14, mine: null, picks: new Map() });
    for (const p of r.party) {
      const r0 = Math.random(), need = r.it.unique ? 0.6 : 0.3;
      r.picks.set(p, { kind: r0 < need ? 'need' : r0 < need + 0.5 ? 'greed' : 'pass', at: rnd(1, 7) });
    }
    this.ctx.chatHtml('c-loot', `${r.from} drops ${this.ctx.link(r.it)}. The party rolls Need or Greed.`);
    this.box.style.display = 'block';
    this.box.querySelector('.n').innerHTML = this.ctx.link(r.it);
    this.box.querySelector('.n').onpointerenter = e => this.ctx.tip(r.it, e); this.box.querySelector('.n').onpointerleave = () => this.ctx.tip();
    for (const b of this.box.querySelectorAll('button')) b.disabled = false;
    this.ctx.sfx('loot');
  }
  choose(kind) {
    const r = this.roll; if (!r) return this.ctx.chat('c-sys', 'There is nothing to roll on.');
    if (r.mine) return;
    r.mine = kind; for (const b of this.box.querySelectorAll('button')) b.disabled = true;
    this.ctx.chatHtml('c-loot', `You have selected ${kind === 'need' ? 'Need' : kind === 'greed' ? 'Greed' : 'Pass'} for: ${this.ctx.link(r.it)}`);
    if (kind !== 'pass') {
      const seen = r.party.filter(p => !p.dead && !p.gone);
      if (seen.length && Math.random() < 0.7) { const p = pick(seen); this.ctx.later(0.9, () => this.ctx.chat('c-party', `[Party] ${p.name}: ${pick(kind === 'need' ? ['wait, the healer is rolling?', 'you are not even in the party', 'can they DO that?', 'uh. need??'] : ['lol the healer is greeding', 'is the healer rolling on our loot', 'fair enough I guess'])}`)); }
    }
    if ([...r.picks.values()].every(c => c.at <= r.t)) r.t = Math.max(r.t, r.dur - 1);
  }
  rollUpdate(dt) {
    const r = this.roll; if (!r) return;
    r.t += dt;
    for (const [p, c] of r.picks) if (!c.said && c.at <= r.t) { c.said = true; if (c.kind !== 'pass' && Math.random() < 0.4) this.ctx.chatHtml('c-loot', `${p.name} has selected ${c.kind === 'need' ? 'Need' : 'Greed'} for: ${this.ctx.link(r.it)}`); }
    this.bar.style.width = Math.max(0, 1 - r.t / r.dur) * 100 + '%';
    const allIn = r.mine && [...r.picks.values()].every(c => c.said);
    if (r.t >= r.dur || allIn) this.finish(r);
  }
  finish(r) {
    const rolls = [];
    for (const [p, c] of r.picks) if (c.kind !== 'pass') rolls.push({ p, kind: c.kind, n: 1 + Math.floor(Math.random() * 100) });
    if (r.mine && r.mine !== 'pass') rolls.push({ me: true, kind: r.mine, n: 1 + Math.floor(Math.random() * 100) });
    const pool = rolls.some(x => x.kind === 'need') ? rolls.filter(x => x.kind === 'need') : rolls;
    for (const x of pool) this.ctx.chatHtml('c-loot', `${x.kind === 'need' ? 'Need' : 'Greed'} roll - ${x.n} for ${this.ctx.link(r.it)} by ${x.me ? 'you' : x.p.name}`);
    const win = pool.sort((a, b) => b.n - a.n)[0];
    if (!win) this.ctx.chatHtml('c-loot', `Everyone passed on ${this.ctx.link(r.it)}.`);
    else if (!win.me) {
      this.ctx.chatHtml('c-loot', `${win.p.name} won: ${this.ctx.link(r.it)}`);
      if (!win.p.dead && !win.p.gone) { win.p.anim = 'cheer'; win.p.animT = 2; }
    } else {
      this.ctx.chatHtml('c-loot', `You won: ${this.ctx.link(r.it)}`);
      this.drop(this.ctx.me.x, this.ctx.me.z, r.it);
      this.crashed(r, win);
    }
    this.next();
  }
  // The party has opinions about a healer who just won their loot.
  crashed(r, win) {
    const S = this.ctx.S, losers = () => [...r.picks].filter(([p, c]) => c.kind === 'need' && p.who).map(([p]) => p);
    const sore = win.kind === 'need' ? losers() : [];
    for (const p of sore) { const k = rec(S, p.who.name); k.n = (k.n || 0) + 1; }
    const alive = r.party.filter(p => !p.dead && !p.gone); if (!alive.length) return;
    const p = sore.find(p => !p.dead && !p.gone) || pick(alive), m = p.who ? mood(rec(S, p.who.name)) : 'stranger';
    const lines = win.kind === 'greed' ? ['fine, the healer can have it', 'greed win, fair', 'lol ok'] :
      m === 'friend' ? ['honestly? you earned it', 'ok that is fair, you carried us', 'take it, you kept us alive'] :
      p.who && p.who.temper === 'entitled' ? ['NINJA', 'reported', 'that was MY upgrade'] : ['did the healer just need on that?', 'you are not even in the party!', 'ninja healer, wow', 'ok who invited the healer. oh right, nobody'];
    this.ctx.later(1.5, () => this.ctx.chat('c-party', `[Party] ${p.name}: ${pick(lines)}`));
  }

  ui() {
    const b = this.box = document.getElementById('roll');
    this.bar = b.querySelector('.tm i');
    b.querySelectorAll('button').forEach(x => x.onclick = () => this.choose(x.dataset.k));
  }
}
