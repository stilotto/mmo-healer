// The Shattered Spire: a raid behind the purple portal. Twenty people (two
// tanks, two healers who run out of mana, sixteen damage dealers) climb to two
// bosses: the Shardwarden, whose Shard Storm hits everyone and whose Splinters
// bleed, and the Hollow Regent, whose Hollow Pulse hits everyone, whose Wither
// curses, who calls Shades and enrages at the end. Like Emberdeep, each visit
// is a fresh raid, and nobody asked for a healer.
import * as THREE from 'three';
import { makeMob, animateMob, makePlate, makeFigure, animate } from './figure.js';
import { RAID, collide, label } from './world.js';
import * as TX from './textures.js';
import { BANDS, bandLevel } from './game.js';

const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
export const RAID_LEVEL = 5;            // the level the healer needs to go in
const RANGED = ['Mage', 'Warlock', 'Ranger'];
const SAY = {
  gather: ['ok raid, listen up. no healers again, so do not stand in stuff', 'two healers, twenty people, what could go wrong', 'buff up, we go in 10', 'tanks, who is main?'],
  noticed: ['who is that healer? not on my list', 'we have a third healer?? where from', 'whoever is healing: marry me', 'raid lead here, the random healer stays'],
  oom: ['OOM!!', 'out of mana, sorry', 'I am dry', 'oom, drinking... oh wait, combat'],
  boss1: ['Shardwarden. spread a bit, kill it fast', 'storm hits everyone, heal through it', 'pull in 3'],
  boss2: ['the Regent. kill the Shades when they come', 'last one, everything you have', 'no wiping, my repair bill'],
  rest: ['nice! drink up', 'one down', 'rez the dead please', 'loot?'], rez: ['rez?', 'can I get a rez', 'any rez...'],
  win: ['GG RAID', 'first kill of the week!', 'who was that healer?', 'screenshot!!'],
  wipe: ['WIPE IT', 'run back', 'we needed more heals', 'ok that was the tanks dying'],
};
const KINDS = {
  shard: { name: 'The Shardwarden', boss: 1, model: 'golem', speed: 2.6, reach: 4, size: 2.2 },
  regent: { name: 'The Hollow Regent', boss: 2, model: 'regent', speed: 3, reach: 3.6, size: 1.8 },
  shade: { name: 'Hollow Shade', model: 'wolf', opt: { c: 0x2a1a3a, d: 0x9a6aff, scale: 1.15 }, speed: 5.5, reach: 1.9, size: 0 },
};

// Crystal and stone, open to a dusk sky, with floating shards about the edges.
export function buildRaid(scene, blockers) {
  const ft = TX.stone(), wt = TX.stone(); wt.repeat.set(0.5, 1);
  const wallM = new THREE.MeshLambertMaterial({ color: 0x7a6a8a, map: wt });
  for (const [x0, z0, x1, z1] of RAID.rects) {
    const t = ft.clone(); t.repeat.set((x1 - x0) / 5, (z1 - z0) / 5); t.needsUpdate = true;
    const f = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, z1 - z0), new THREE.MeshLambertMaterial({ color: 0x9a90aa, map: t })); f.position.set((x0 + x1) / 2, -0.05, (z0 + z1) / 2); scene.add(f);
  }
  // A drop below the spire: a sea of cloud far underneath.
  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: 0x8a6aa0 })); cloud.rotation.x = -Math.PI / 2; cloud.position.set(RAID.start.x, -60, -80); scene.add(cloud);
  const walk = (x, z) => RAID.rects.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  const segs = [];
  for (let x = RAID.start.x - 30; x < RAID.start.x + 30; x += 2) for (let z = -168; z < 12; z += 2) {
    const cx = x + 1, cz = z + 1; if (!walk(cx, cz)) continue;
    if (!walk(cx + 2, cz)) segs.push([x + 2, cz, 0]); if (!walk(cx - 2, cz)) segs.push([x, cz, 0]);
    if (!walk(cx, cz + 2)) segs.push([cx, z + 2, 1]); if (!walk(cx, cz - 2)) segs.push([cx, z, 1]);
  }
  // Low parapets (you can see the sky over them), one instanced mesh.
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 1.6, 2.05), wallM, segs.length), M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), V = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
  segs.forEach(([x, z, turn], i) => { Qn.setFromAxisAngle(V.set(0, 1, 0), turn ? Math.PI / 2 : 0); M.compose(new THREE.Vector3(x, 0.8, z), Qn, ONE); walls.setMatrixAt(i, M); });
  scene.add(walls);
  // Broken pillars and floating crystals around the two terraces.
  const crystalM = new THREE.MeshLambertMaterial({ color: 0xb08aff, emissive: 0x4a2a8a, flatShading: true });
  const floaters = [];
  for (const [cx, cz, r] of [[0, -63, 26], [0, -141, 30]]) {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.2, x = RAID.start.x + cx + Math.sin(a) * (r + 1.5), z = cz + Math.cos(a) * (r - 2);
      if (Math.abs(x - RAID.start.x) < 6) continue;
      const h = 4 + (i % 3) * 2.5, p = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, h, 8), wallM); p.position.set(x, h / 2, z); scene.add(p); blockers.push(p);
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.9 + (i % 2) * 0.5), crystalM); c.position.set(x, h + 2.2, z); c.userData.y = h + 2.2; scene.add(c); floaters.push(c);
    }
  }
  const spin = [];
  for (const e of RAID.exits) {
    const p = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.25, 8, 20), new THREE.MeshBasicMaterial({ color: 0x6ab8ff })); p.position.set(e.x, 2.2, e.z); scene.add(p); spin.push(p);
    const c = new THREE.Mesh(new THREE.CircleGeometry(1.7, 18), new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })); c.position.copy(p.position); scene.add(c);
    const lb = label('Lanternrest', 'Way out', 1.6); lb.position.set(e.x, 4.6, e.z); scene.add(lb);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xc08aff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; scene.add(ring);
  return { ring, portals: spin, update(dt, t) { for (const p of spin) p.rotation.z += dt; for (const c of floaters) { c.rotation.y += dt * 0.6; c.position.y = c.userData.y + Math.sin(t + c.position.x) * 0.4; } } };
}

// The two bosses. The Shardwarden is a hovering crystal giant; the Regent a
// towering hollow king in a crown.
function makeGolem() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const m = new THREE.MeshLambertMaterial({ color: 0x9a7ae0, emissive: 0x3a1a7a, flatShading: true }), dark = new THREE.MeshLambertMaterial({ color: 0x5a4a7a, flatShading: true });
  const part = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); body.add(o); return o; };
  part(new THREE.OctahedronGeometry(1.6), m, 0, 3.4, 0, 1.1, 1.5, 0.9);
  part(new THREE.OctahedronGeometry(0.7), m, 0, 5.9, 0.1);
  part(new THREE.DodecahedronGeometry(0.9), dark, 0, 1.4, 0, 1, 0.7, 1);
  const armL = part(new THREE.OctahedronGeometry(0.8), m, -2.1, 3.6, 0.3, 0.7, 1.8, 0.7), armR = part(new THREE.OctahedronGeometry(0.8), m, 2.1, 3.6, 0.3, 0.7, 1.8, 0.7);
  for (const x of [-0.25, 0.25]) part(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), x, 6, 0.65);
  const orbit = new THREE.Group(); orbit.position.y = 3.4; body.add(orbit);
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), m); const a = i / 6 * Math.PI * 2; s.position.set(Math.sin(a) * 3, Math.sin(i) * 0.8, Math.cos(a) * 3); orbit.add(s); }
  return { group: g, body, armL, armR, orbit, phase: 0 };
}
function animGolem(f, mode, t, casting) {
  const b = f.body; b.position.set(0, 0.3 + Math.sin(t * 1.4) * 0.25, 0); b.rotation.set(0, 0, 0);
  f.orbit.rotation.y += casting ? 0.12 : 0.015;
  f.armL.rotation.x = f.armR.rotation.x = 0;
  if (mode === 'dead') { b.rotation.z = 1.2; b.position.y = -1; return; }
  if (mode === 'attack') { const k = (t * 0.9) % 1; f.armR.rotation.x = k < 0.3 ? -k * 4 : -1.2 * (1 - (k - 0.3) / 0.7); b.position.z = k < 0.3 ? k : 0.3 * (1 - (k - 0.3) / 0.7); }
  if (casting) { f.armL.rotation.x = f.armR.rotation.x = -2.2; }
}
function makeRegent() {
  const f = makeFigure('Warlock', 913); f.body.scale.setScalar(2.7);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.16, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xe0b040, emissive: 0x4a3008, side: THREE.DoubleSide }));
  crown.position.y = 0.26; f.sockets.head.add(crown);
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), crown.material); const a = i / 6 * Math.PI * 2; s.position.set(Math.sin(a) * 0.29, 0.4, Math.cos(a) * 0.29); f.sockets.head.add(s); }
  f.group.traverse(o => { if (o.isMesh && o.material && o.material.vertexColors) { o.material = o.material.clone(); o.material.color = new THREE.Color(0x8a7aa8); o.material.emissive = new THREE.Color(0x1a0a2a); } });
  return f;
}

export class Raid {
  constructor(scene, ctx) { this.scene = scene; this.ctx = ctx; this.mobs = []; this.party = []; this.active = false; this.art = buildRaid(scene, ctx.world.blockers); }
  enter() { this.active = true; this.start(); }
  leave() { this.active = false; this.clear(); }
  clear() {
    for (const m of this.mobs) this.dropMob(m);
    for (const p of this.party) if (!p.gone) this.ctx.people.remove(p);
    this.mobs = []; this.party = [];
  }
  dropMob(m) { this.scene.remove(m.fig.group); m.plate.sprite.material.map.dispose(); }
  spawnMob(kind, x, z, level) {
    const def = KINDS[kind], fig = def.model === 'golem' ? makeGolem() : def.model === 'regent' ? makeRegent() : makeMob(def.model, def.opt);
    const m = { owner: this, def, kind, name: def.name, level, x, z, yaw: 0, state: 'idle', foe: null, attackers: new Set(), swing: 1, deadT: 0, fig, cast: null, castAt: rnd(8, 12), dotAt: rnd(6, 9) };
    m.plate = makePlate(def.name, (def.boss ? 'Raid boss · ' : '') + 'Level ' + level, def.boss ? '#ffb040' : '#ff6a5a');
    m.plate.sprite.position.y = def.boss ? (def.model === 'golem' ? 7.6 : 7.2) : 2.2; if (def.boss) m.plate.sprite.scale.multiplyScalar(1.4);
    fig.group.add(m.plate.sprite); fig.group.position.set(x, 0, z); this.scene.add(fig.group); this.mobs.push(m);
    return m;
  }
  start() {
    this.clear();
    const S = this.ctx.S, folk = this.ctx.people, booked = (this.ctx.booked && this.ctx.booked()) || [];
    // Twenty: two Knights to tank, two Druids to heal, and sixteen more. People who signed up on the board come first.
    const roles = ['Knight', 'Knight', 'Druid', 'Druid', ...Array.from({ length: 16 }, () => pick(['Mage', 'Warlock', 'Ranger', 'Rogue', 'Brawler', 'Ranger', 'Mage', 'Rogue']))];
    const named = new Map(); for (const b of booked) { const i = roles.findIndex((r, j) => r === b.cls && !named.has(j)); if (i >= 0) named.set(i, b.name); }
    this.party = roles.map((k, i) => {
      const off = { x: (i % 5 - 2) * 1.5, z: Math.floor(i / 5) * 1.5 };
      const p = folk.spawn(RAID.start.x + off.x, RAID.start.z - 3 + off.z, 1, k, named.get(i));
      p.zone = 'raid'; folk.relevel(p, 'raid'); p.wait = 1e9; p.yaw = Math.PI; p.off = off;
      if (i < 2) { p.tank = i === 0 ? 'main' : 'off'; p.armor = 0.55; p.maxHp = Math.round(p.maxHp * 1.6); p.hp = p.maxHp; }
      if (k === 'Druid' && i < 4) { p.healer = true; p.mana = 100; p.healAt = rnd(1, 2.5); p.off = { x: (i - 2.5) * 4, z: 9 }; }
      else if (RANGED.includes(k)) { p.reach = rnd(8, 12); p.off.z += 5; }
      return p;
    });
    // Damage the raid can do in a second, to size the bosses' health to a two to three minute fight.
    const dps = this.party.filter(p => !p.tank && !p.healer).reduce((a, p) => a + (11 + 4.5 * p.level) / 1.6, 0);
    const top = BANDS.raid[1];
    this.mobs = [];
    const b1 = this.spawnMob('shard', RAID.way[2].x, RAID.way[2].z, top + 2), b2 = this.spawnMob('regent', RAID.way[5].x, RAID.way[5].z, top + 2);
    b1.maxHp = b1.hp = Math.round(dps * 105); b2.maxHp = b2.hp = Math.round(dps * 130);
    for (const b of [b1, b2]) { b.yaw = 0; b.dmg = 1; }
    Object.assign(this, { phase: 'gather', timer: 9, boss: 0, seen: false, asked: false, won: false, oomSaid: false, adds: 0, killed: 0 });
    this.say('gather');
  }
  say(key, who) {
    const alive = this.alive(); if (!alive.length) return;
    this.ctx.chat('c-party', `[Raid] ${(who || pick(alive)).name}: ${pick(SAY[key])}`);
  }
  alive() { return this.party.filter(p => !p.dead && !p.gone); }
  tank() { const a = this.alive(); return a.find(p => p.tank === 'main') || a.find(p => p.tank) || null; }
  offTank() { return this.alive().find(p => p.tank === 'off') || null; }
  bossMob() { return this.mobs.find(m => m.def.boss === this.boss + 1); }
  noticed() { if (!this.seen) { this.seen = true; this.ctx.later(1.2, () => this.active && this.say('noticed')); } }
  bossInfo() {
    const b = this.bossMob();
    if (!this.active || !b || b.state !== 'fight') return null;
    return { name: b.name, hp: b.hp, maxHp: b.maxHp, casting: b.cast ? { name: b.cast.name, k: 1 - b.cast.t / b.cast.dur } : null };
  }

  hurt(m, dmg, by) {
    if (m.state === 'dead') return true;
    if (m.state === 'idle') this.pull(m, by);
    m.attackers.add(by); m.hp -= dmg; this.ctx.float(m, String(dmg), 'hit');
    if (m.hp <= 0) { m.hp = 0; m.state = 'dead'; m.deadT = 8; m.cast = null; if (m.def.boss) this.bossDown(m); return true; }
    if (m.kind === 'regent') {
      for (const at of [0.66, 0.33]) if (m.hp < m.maxHp * at && this.adds < (at === 0.66 ? 1 : 2)) { this.adds++; this.callShades(m); }
      if (!m.mad && m.hp < m.maxHp * 0.15) { m.mad = true; this.ctx.chat('c-yell', 'The Hollow Regent: "Then let the Spire fall with me!"'); this.ctx.warn('The Regent enrages!'); }
    }
    if (m.kind === 'shard' && !m.mad && m.hp < m.maxHp * 0.3) { m.mad = true; this.ctx.chat('c-yell', 'The Shardwarden fractures and moves faster!'); }
    return false;
  }
  pull(m, who) { if (m.state !== 'idle') return; m.state = 'fight'; m.foe = this.tank() || who; m.swing = rnd(0.8, 1.6); }
  callShades(m) {
    this.ctx.chat('c-yell', 'The Hollow Regent calls his Shades!'); this.ctx.warn('Shades!');
    for (let i = 0; i < 3; i++) {
      const a = rnd(0, 6.283), s = this.spawnMob('shade', m.x + Math.sin(a) * 14, m.z + Math.cos(a) * 12, BANDS.raid[1]);
      s.maxHp = s.hp = Math.round(m.maxHp * 0.035); s.state = 'fight';
      const v = this.alive().filter(p => !p.tank); s.foe = v.length ? pick(v) : this.tank();
    }
  }

  // Raid-wide spells: a cast bar on the boss frame, then everyone takes a share of their health.
  bossTick(m, dt, alive) {
    const ctx = this.ctx, folk = ctx.people, me = ctx.me;
    if (m.cast) {
      if ((m.cast.t -= dt) <= 0) {
        const share = m.cast.share, r = this.art.ring; r.position.set(m.x, 0.08, m.z); r.scale.setScalar(2); r.material.opacity = 0.9;
        for (const p of alive) folk.hurt(p, Math.round(p.maxHp * share / (p.armor || 1)), m);
        if (!me.dead && Math.hypot(me.x - m.x, me.z - m.z) < 50) folk.hurt(me, Math.round(me.maxHp * share), m);
        ctx.boom(m.x, m.z); m.cast = null;
      }
    } else if ((m.castAt -= dt) <= 0) {
      const shard = m.kind === 'shard';
      m.castAt = shard ? rnd(15, 19) : rnd(13, 16);
      m.cast = { name: shard ? 'Shard Storm' : 'Hollow Pulse', t: 2.5, dur: 2.5, share: shard ? 0.14 : 0.17 };
      ctx.chat('c-yell', shard ? 'The Shardwarden gathers a storm of shards...' : 'The Hollow Regent draws the light out of the room...'); ctx.warn(m.cast.name + '!');
    }
    if ((m.dotAt -= dt) <= 0) {          // Splinter or Wither on a few people: Cleanse takes it off
      m.dotAt = m.kind === 'shard' ? rnd(11, 14) : rnd(12, 15);
      const id = m.kind === 'shard' ? 'splinter' : 'wither', v = alive.filter(p => !p.tank).sort(() => Math.random() - 0.5).slice(0, m.kind === 'shard' ? 3 : 2);
      if (!me.dead && Math.random() < 0.25 && Math.hypot(me.x - m.x, me.z - m.z) < 40) v.push(me);
      for (const p of v) { p.dots = (p.dots || []).filter(d => d.id !== id); p.dots.push({ id, tick: Math.max(2, Math.round(p.maxHp * (id === 'wither' ? 0.045 : 0.03))), left: 8, every: 1.5, t: 1.5, by: m }); }
      if (v.length) ctx.chat('c-yell', `${m.kind === 'shard' ? 'Splinters bite into' : 'The Regent withers'} ${v.map(p => p.isMe ? 'you' : p.name).join(', ')}.`);
    }
  }

  update(dt, t) {
    this.art.update(dt, t); this.clock = t;
    if (!this.active) return;
    const ctx = this.ctx, folk = ctx.people, me = ctx.me, alive = this.alive();
    this.timer -= dt;

    for (const m of this.mobs) {
      const g = m.fig.group, def = m.def; let anim = 'idle';
      if (m.state === 'dead') {
        m.deadT -= dt; m.plate.sprite.visible = false;
        if (!def.boss) g.scale.setScalar(m.deadT < 0 ? 0.01 : 1);
        this.animMob(m, 'dead', t); continue;
      }
      if (m.state === 'idle') {
        if (def.boss && def.boss === this.boss + 1 && (this.phase === 'fight' || this.phase === 'pull') && alive.some(p => Math.hypot(p.x - m.x, p.z - m.z) < 14)) this.pull(m, this.tank());
        else if (def.boss && !me.dead && !(me.faded > 0) && Math.hypot(me.x - m.x, me.z - m.z) < 9) { this.pull(m, me); m.foe = me; ctx.aggroed(m); }
      } else {
        if (m.foe === me && m.tauntAt && t > m.tauntAt) { const tk = def.boss ? this.tank() : this.offTank() || this.tank(); if (tk) { m.foe = tk; m.ht = 0; m.tauntAt = 0; if (Math.random() < 0.6) ctx.chat('c-party', `[Raid] ${tk.name}: ${pick(['got it', 'taunted', 'on me', 'sorry healer'])}`); } }
        let f = m.foe;
        if (!f || f.dead || f.gone) f = m.foe = def.boss ? this.tank() : pick(alive.filter(p => !p.tank)) || this.tank();
        if (!f) { m.state = 'idle'; m.hp = m.maxHp; m.attackers.clear(); m.cast = null; }
        else {
          const dx = f.x - m.x, dz = f.z - m.z, d = Math.hypot(dx, dz);
          if (!m.cast) m.yaw = Math.atan2(dx, dz);
          if (d > def.reach + 0.3 && !m.cast) { m.x += dx / d * def.speed * dt; m.z += dz / d * def.speed * dt; collide(m, 0.6); anim = 'walk'; }
          else if (!m.cast) {
            anim = 'attack';
            if ((m.swing -= dt) <= 0) {
              m.swing = rnd(1.6, 2.0) * (m.mad && m.kind === 'shard' ? 0.7 : 1);
              const crush = f.tank && Math.random() < 0.15;
              // Tuned to the tank: a boss swing takes about a tenth of a tank; Shades nibble at whoever they chase.
              const base = f.isMe ? f.maxHp * (def.boss ? 0.3 : 0.08) : def.boss ? f.maxHp * (m.kind === 'regent' ? 0.1 : 0.085) / (f.armor || 1) : f.maxHp * 0.07 / (f.armor || 1);
              folk.hurt(f, Math.round(base * rnd(0.85, 1.15) * (crush ? 1.8 : 1) * (m.mad && m.kind === 'regent' ? 1.4 : 1)), m, crush);
            }
          }
          if (def.boss) this.bossTick(m, dt, alive);
          if (!def.boss) { const ot = this.offTank(); if (ot && f !== ot && Math.hypot(ot.x - m.x, ot.z - m.z) < 3) m.foe = ot; }    // the off-tank picks up Shades
        }
      }
      this.animMob(m, anim, t); g.position.set(m.x, 0, m.z); g.rotation.y = m.yaw; m.plate.draw(m.hp / m.maxHp, false);
    }
    const ring = this.art.ring;
    if (ring.material.opacity > 0) { ring.material.opacity = Math.max(0, ring.material.opacity - dt * 0.8); ring.scale.setScalar(ring.scale.x + dt * 34); }

    if (this.phase === 'done') return;
    if (this.phase === 'wipe') {
      if (this.timer < 6) for (const p of this.party) if (!p.gone) p.fading = true;
      if (this.timer < 0) { ctx.chat('c-sys', 'A new raid gathers at the foot of the Shattered Spire.'); this.start(); }
      return;
    }
    const tanks = alive.filter(p => p.tank);
    if (this.phase !== 'gather' && (alive.length <= 4 || (this.phase === 'fight' && !tanks.length))) return this.wipe();

    // The healers heal the tanks while their mana lasts.
    for (const p of alive) if (p.healer) {
      if (p.state === 'hunt') { p.state = 'idle'; p.mob = null; }
      p.mana = Math.min(100, p.mana + dt * (this.phase === 'fight' ? 0.4 : 4));
      if ((p.healAt -= dt) <= 0) {
        p.healAt = rnd(2.2, 2.8);
        const q = [...tanks, ...alive.filter(x => !x.tank)].filter(x => x.hp < x.maxHp * 0.92).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (q && p.mana >= 5 && Math.hypot(q.x - p.x, q.z - p.z) < 40) {
          p.mana -= 5; const amt = Math.round(q.maxHp * 0.05); q.hp = Math.min(q.maxHp, q.hp + amt); p.anim = 'cast'; p.animT = 1; p.yaw = Math.atan2(q.x - p.x, q.z - p.z);
          if (Math.hypot(q.x - me.x, q.z - me.z) < 40) ctx.float(q, '+' + amt, '');
        } else if (q && p.mana < 5 && !p.oom) { p.oom = true; this.say('oom', p); }
        if (p.mana > 40) p.oom = false;
      }
    }

    const room = RAID.bosses[this.boss], b = this.bossMob();
    if (this.phase === 'gather') { if (this.timer < 0) { this.phase = 'move'; this.timer = 40; this.send([RAID.way[room.edge]]); } }
    else if (this.phase === 'move') {
      const s = RAID.way[room.edge];
      if (b.state === 'fight') this.phase = 'fight';
      else if (this.timer < 0 || alive.every(p => p.state === 'idle' && Math.hypot(p.x - s.x - p.off.x, p.z - s.z - p.off.z) < 4)) {
        this.phase = 'pull'; this.timer = 2; this.say(this.boss ? 'boss2' : 'boss1');
        const tk = this.tank(); if (tk) { tk.mob = b; tk.state = 'hunt'; tk.path = null; }
      }
    }
    else if (this.phase === 'pull') { if (this.timer < 0 || b.state === 'fight') { this.phase = 'fight'; this.pull(b, this.tank()); } }
    else if (this.phase === 'fight') {
      const adds = this.mobs.filter(m => !m.def.boss && m.state !== 'dead');
      for (const p of alive) {
        if (p.healer) continue;
        const want = p.tank === 'main' ? b : p.tank === 'off' ? (adds.find(m => m.foe !== p) || adds[0] || b) : adds.length && !p.reach ? adds.sort((x, y) => Math.hypot(x.x - p.x, x.z - p.z) - Math.hypot(y.x - p.x, y.z - p.z))[0] : b;
        if (p.state !== 'hunt' || p.mob !== want) { p.mob = want; p.state = 'hunt'; p.path = null; p.resting = false; }
      }
    }
    else if (this.phase === 'rest') {
      const t2 = -this.timer, dead = this.party.some(p => p.dead && !p.gone);
      if (dead && !this.asked && t2 > 4) { this.asked = true; this.say('rez'); }
      if ((alive.every(p => p.hp > p.maxHp * 0.8) && t2 > 6 && (!dead || t2 > 18)) || t2 > 26) {
        this.phase = 'move'; this.timer = 45;
        this.send([RAID.way[3], RAID.way[RAID.bosses[1].edge]]);
      }
    }
  }
  animMob(m, mode, t) {
    if (m.def.model === 'golem') animGolem(m.fig, mode, t, !!m.cast);
    else if (m.def.model === 'regent') animate(m.fig, mode === 'dead' ? 'dead' : m.cast ? 'cast' : mode === 'attack' ? 'attack' : mode === 'walk' ? 'walk' : 'idle', t, 0.7);
    else animateMob(m.fig, mode, t);
  }
  send(points) {
    for (const p of this.alive()) {
      p.resting = false; p.mob = null;
      p.path = points.slice(1).map(w => ({ x: w.x + p.off.x, z: w.z + p.off.z })); if (!p.path.length) p.path = null;
      p.dest = { x: points[0].x + p.off.x, z: points[0].z + p.off.z }; p.state = 'walk'; p.stuck = 0;
    }
  }
  bossDown(m) {
    const ctx = this.ctx; this.killed++;
    for (const s of this.mobs) if (!s.def.boss && s.state !== 'dead') { s.state = 'dead'; s.deadT = 1; }
    ctx.chat('c-sys', `${m.name} has been defeated!`);
    for (const p of this.alive()) { p.mob = null; p.state = 'idle'; p.anim = 'cheer'; p.animT = 3; }
    if (ctx.bossLoot) ctx.bossLoot(m, this);
    if (m.kind === 'shard') { this.boss = 1; this.phase = 'rest'; this.timer = 0; this.asked = false; this.say('rest'); for (const p of this.alive()) p.resting = !p.healer; }
    else {
      this.phase = 'done'; this.won = true; this.say('win'); ctx.later(2.5, () => this.active && this.say('win'));
      if (ctx.runOver) ctx.runOver(true, this);
      ctx.later(20, () => { if (this.active && this.won) { for (const p of this.party) if (!p.gone) p.fading = true; ctx.chat('c-sys', 'The raid hearths out. Leave by a portal; the Spire resets when you come back.'); } });
    }
  }
  wipe() {
    const ctx = this.ctx;
    this.phase = 'wipe'; this.timer = 14; ctx.chat('c-yell', 'The raid has wiped.'); this.say('wipe');
    if (ctx.runOver) ctx.runOver(false, this);
    for (const m of this.mobs) {
      if (!m.def.boss) { m.state = 'dead'; m.deadT = 0; continue; }
      if (m.state === 'fight') { m.state = 'idle'; m.hp = m.maxHp; m.attackers.clear(); m.mad = false; m.cast = null; m.foe = null; const w = RAID.way[m.kind === 'shard' ? 2 : 5]; m.x = w.x; m.z = w.z; }
    }
  }
}
