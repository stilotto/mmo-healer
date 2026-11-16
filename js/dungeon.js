// Emberdeep: an instance behind the orange portal. A party of five is running
// it without a healer. Each visit is a fresh run: three rooms of trash and
// Cinderjaw at the end. The controller here walks the party from pull to pull.
import * as THREE from 'three';
import { makeMob, animateMob, makePlate } from './figure.js';
import { DUN, DX, collide, label } from './world.js';

const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const KINDS = {
  cslime: { name: 'Cinder Slime', model: 'slime', opt: { c: 0xff8a3a, glow: 0x7a2a00 }, hp: 2.6, dmg: 0.95, speed: 3 },
  hound: { name: 'Ash Hound', model: 'wolf', opt: { c: 0x3a3436, d: 0x8a2a1a }, hp: 3, dmg: 1.25, speed: 5 },
  boss: { name: 'Cinderjaw', model: 'wolf', opt: { c: 0x5a1a12, d: 0xff7a2a, scale: 2.8 }, hp: 34, dmg: 2.7, speed: 4.5, elite: true, boss: true },
};
const SAY = {
  gather: ['ok no healer, pull slow', 'we can do this without heals. probably', 'everyone eat first', 'I have 3 bandages. total.'],
  noticed: ['wait, who is healing us?', 'there is a healer in here??', 'did someone invite a healer?', 'do NOT kick the healer', 'random heals, I love it'],
  rest: ['mana break', 'sec, eating', 'that went fine', 'ow ow ow'], rez: ['rez pls?', 'anyone have a rez... no. right.', 'healer! over here!'],
  boss: ['big dog. tank it facing away', 'pop everything', 'do not stand in the breath'], win: ['gg!', 'WE DID IT', 'first try (not first try)', 'thanks mystery healer'],
  wipe: ['wipe it', 'run back...', 'we really need a healer', 'my repair bill'],
};

export function buildDungeon(scene, blockers) {
  const L = c => new THREE.MeshLambertMaterial({ color: c });
  const floorM = L(0x4a3f3a), wallM = L(0x2e2624);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x080404 })); under.rotation.x = -Math.PI / 2; under.position.set(DX + 15, -0.2, -45); scene.add(under);
  for (const [x0, z0, x1, z1] of DUN.rects) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, z1 - z0), floorM); f.position.set((x0 + x1) / 2, -0.05, (z0 + z1) / 2); scene.add(f);
  }
  const walk = (x, z) => DUN.rects.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  const segs = [];
  for (let x = DX - 30; x < DX + 60; x += 2) for (let z = -104; z < 10; z += 2) {
    const cx = x + 1, cz = z + 1; if (!walk(cx, cz)) continue;
    if (!walk(cx + 2, cz)) segs.push([x + 2, cz, 0]); if (!walk(cx - 2, cz)) segs.push([x, cz, 0]);
    if (!walk(cx, cz + 2)) segs.push([cx, z + 2, 1]); if (!walk(cx, cz - 2)) segs.push([cx, z, 1]);
  }
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 8, 2.05), wallM, segs.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
  segs.forEach(([x, z, turn], i) => { Q.setFromAxisAngle(V.set(0, 1, 0), turn ? Math.PI / 2 : 0); M.compose(new THREE.Vector3(x, 4, z), Q, ONE); walls.setMatrixAt(i, M); });
  scene.add(walls); blockers.push(walls);
  const glow = new THREE.MeshBasicMaterial({ color: 0xff8a30 }), fires = [];
  for (const [x0, z0, x1, z1] of DUN.rects) {
    if (x1 - x0 < 14 || z1 - z0 < 14) continue;
    for (const [x, z] of [[x0 + 1.5, z0 + 1.5], [x1 - 1.5, z0 + 1.5], [x0 + 1.5, z1 - 1.5], [x1 - 1.5, z1 - 1.5]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.35, 1.3, 7), wallM); b.position.set(x, 0.65, z); scene.add(b);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 6), glow); f.position.set(x, 1.9, z); scene.add(f); fires.push(f);
    }
  }
  const lava = new THREE.MeshBasicMaterial({ color: 0xff5a1a });
  for (const [x, z, w, d, r] of [[-20, -72, 9, 0.7, 0.4], [-2, -96, 11, 0.8, -0.3], [-22, -96, 7, 0.6, 0.9], [4, -72, 6, 0.6, -0.8], [46, -90, 8, 0.5, 0.5], [2, -46, 6, 0.4, 1.1]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), lava); m.position.set(DX + x, 0.02, z); m.rotation.y = r; scene.add(m);
  }
  const spin = [];
  for (const e of DUN.exits) {
    const p = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.25, 8, 20), new THREE.MeshBasicMaterial({ color: 0x6ab8ff })); p.position.set(e.x, 2.2, e.z); p.rotation.y = e.z > 0 ? 0 : Math.PI / 2; scene.add(p); spin.push(p);
    const c = new THREE.Mesh(new THREE.CircleGeometry(1.7, 18), new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })); c.position.copy(p.position); c.rotation.y = p.rotation.y; scene.add(c);
    const lb = label('Lanternrest', 'Way out', 2.2); lb.position.set(e.x, 5.2, e.z); scene.add(lb);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; scene.add(ring);
  return { ring, update(dt, t) { for (const f of fires) f.scale.y = 1 + Math.sin(t * 12 + f.position.x) * 0.2; for (const p of spin) p.rotation.z += dt; } };
}

export class Dungeon {
  constructor(scene, ctx) { this.scene = scene; this.ctx = ctx; this.mobs = []; this.party = []; this.active = false; this.art = buildDungeon(scene, ctx.world.blockers); }

  enter() { this.active = true; this.start(); }
  leave() { this.active = false; this.clear(); }
  clear() {
    for (const m of this.mobs) { this.scene.remove(m.fig.group); m.plate.sprite.material.map.dispose(); }
    for (const p of this.party) if (!p.gone) this.ctx.people.remove(p);
    this.mobs = []; this.party = [];
  }
  start() {
    this.clear();
    const S = this.ctx.S, folk = this.ctx.people;
    DUN.rooms.forEach((room, ri) => {
      const c = DUN.way[room.way];
      room.mobs.forEach((k, i) => {
        const def = KINDS[k], level = Math.max(1, S.level + (def.boss ? 2 : Math.floor(rnd(0, 2)))), fig = makeMob(def.model, def.opt);
        const a = i / room.mobs.length * 6.283 + ri, d = def.boss ? 0 : 4.5;
        const m = { owner: this, def, name: def.name, level, room: ri, x: c.x + Math.sin(a) * d - (def.boss ? 6 : 0), z: c.z + Math.cos(a) * d, yaw: def.boss ? Math.PI / 2 : a + Math.PI,
          maxHp: Math.round((40 + 18 * level) * def.hp), dmg: (6 + 2.5 * level) * def.dmg, state: 'idle', foe: null, attackers: new Set(), swing: 1, deadT: 0, fig, mad: false };
        m.hp = m.maxHp;
        m.plate = makePlate(def.name, (def.boss ? 'Boss · ' : '') + 'Level ' + level, def.boss ? '#ffb040' : '#ff6a5a'); m.plate.sprite.position.y = def.boss ? 4.6 : 2.1; fig.group.add(m.plate.sprite);
        fig.group.position.set(m.x, 0, m.z); fig.group.rotation.y = m.yaw; this.scene.add(fig.group); this.mobs.push(m);
      });
    });
    const kinds = ['Knight', pick(['Mage', 'Warlock']), pick(['Rogue', 'Brawler']), 'Ranger', pick(['Mage', 'Rogue', 'Druid'])];
    this.party = kinds.map((k, i) => {
      const p = folk.spawn(DUN.start.x + (i - 2) * 1.6, -4.5 - (i % 2) * 1.6, 1, k);
      p.zone = 'dungeon'; p.wait = 1e9; p.yaw = Math.PI; p.off = { x: (i - 2) * 1.1, z: (i % 2) * 1.4 };
      if (!i) { p.tank = true; p.armor = 0.55; p.maxHp = Math.round(p.maxHp * 1.6); p.hp = p.maxHp; }
      return p;
    });
    Object.assign(this, { phase: 'gather', timer: 7, room: 0, seen: false, breath: 0, breathAt: 0, asked: false, won: false });
    this.party_say('gather');
  }
  party_say(key, who) {
    const alive = this.party.filter(p => !p.dead && !p.gone); if (!alive.length) return;
    this.ctx.chat('c-party', `[Party] ${(who || pick(alive)).name}: ${pick(SAY[key])}`);
  }
  noticed(p) { if (!this.seen) { this.seen = true; setTimeout(() => this.active && this.party_say('noticed'), 1200); } }
  alive() { return this.party.filter(p => !p.dead && !p.gone); }
  tank() { const a = this.alive(); return a.find(p => p.tank) || a[0]; }
  roomMobs() { return this.mobs.filter(m => m.room === this.room && m.state !== 'dead'); }

  hurt(m, dmg, by) {
    if (m.state === 'dead') return true;
    this.aggro(m.room, by); m.attackers.add(by);
    m.hp -= dmg; this.ctx.float(m, '-' + dmg, 'dmg');
    if (m.def.boss && !m.mad && m.hp < m.maxHp * 0.25) { m.mad = true; m.dmg *= 1.3; this.ctx.chat('c-yell', 'Cinderjaw goes into a frenzy!'); }
    if (m.hp <= 0) { m.hp = 0; m.state = 'dead'; m.deadT = 6; return true; }
    return false;
  }
  aggro(room, who) { for (const m of this.mobs) if (m.room === room && m.state === 'idle') { m.state = 'fight'; m.foe = this.tank() || who; m.swing = rnd(0.6, 1.6); } }

  send(points) {
    for (const p of this.alive()) {
      p.resting = false; p.mob = null;
      p.path = points.slice(1).map(w => ({ x: w.x + p.off.x, z: w.z + p.off.z })); if (!p.path.length) p.path = null;
      p.dest = { x: points[0].x + p.off.x, z: points[0].z + p.off.z }; p.state = 'walk'; p.stuck = 0;
    }
  }

  update(dt, t) {
    this.art.update(dt, t);
    if (!this.active) return;
    const ctx = this.ctx, folk = ctx.people, alive = this.alive(), room = DUN.rooms[this.room];
    this.timer -= dt;

    // Monsters
    for (const m of this.mobs) {
      const g = m.fig.group; let anim = 'idle';
      if (m.state === 'dead') { m.deadT -= dt; g.scale.setScalar(m.deadT < 0 ? 0.01 : 1); m.plate.sprite.visible = false; animateMob(m.fig, 'dead', t); continue; }
      if (m.state === 'idle') { if (alive.some(p => Math.hypot(p.x - m.x, p.z - m.z) < (m.def.boss ? 13 : 9))) this.aggro(m.room, this.tank()); }
      else {
        let f = m.foe;
        if (!f || f.dead || f.gone) f = m.foe = this.tank() || null;
        if (!f) { m.state = 'idle'; m.hp = m.maxHp; m.attackers.clear(); }
        else {
          const dx = f.x - m.x, dz = f.z - m.z, d = Math.hypot(dx, dz), reach = m.def.boss ? 3.4 : 1.9;
          m.yaw = Math.atan2(dx, dz);
          if (d > reach) { m.x += dx / d * m.def.speed * dt; m.z += dz / d * m.def.speed * dt; collide(m, 0.6); anim = 'walk'; }
          else {
            anim = 'attack';
            if ((m.swing -= dt) <= 0) {
              m.swing = rnd(1.5, 2.1); folk.hurt(f, Math.round(m.dmg * rnd(0.8, 1.25)), m);
              if (Math.random() < 0.12) { const o = alive.filter(p => p !== f); if (o.length) m.foe = pick(o); }   // someone pulled aggro
              else if (Math.random() < 0.5) m.foe = this.tank();
            }
          }
          if (m.def.boss) this.bossBreath(m, dt, alive);
        }
      }
      animateMob(m.fig, anim, t); g.position.set(m.x, 0, m.z); g.rotation.y = m.yaw; m.plate.draw(m.hp / m.maxHp, false);
    }
    const ring = this.art.ring;
    if (ring.material.opacity > 0) { ring.material.opacity = Math.max(0, ring.material.opacity - dt * 0.9); ring.scale.setScalar(ring.scale.x + dt * 26); }

    // The party
    if (this.phase === 'done') return;
    if (this.phase === 'wipe') {
      if (this.timer < 6) for (const p of this.party) if (!p.gone) p.fading = true;
      if (this.timer < 0) { ctx.chat('c-sys', 'A new party forms at the entrance of Emberdeep.'); this.start(); }
      return;
    }
    if (!alive.length && this.phase !== 'gather') {
      this.phase = 'wipe'; this.timer = 14; ctx.chat('c-yell', 'The party has wiped.');
      for (const m of this.mobs) if (m.state === 'fight') { m.state = 'idle'; m.hp = m.maxHp; m.attackers.clear(); m.mad = false; }
      return;
    }
    const mobs = this.roomMobs();
    if (this.phase === 'gather') { if (this.timer < 0) { this.phase = 'move'; this.timer = 30; this.send([DUN.way[room.way - 1]]); } }
    else if (this.phase === 'move') {
      const s = DUN.way[room.way - 1];
      if (mobs.some(m => m.state === 'fight')) this.phase = 'fight';
      else if (this.timer < 0 || alive.every(p => p.state === 'idle' && Math.hypot(p.x - s.x, p.z - s.z) < 5)) {
        this.phase = 'pull'; this.timer = 1.6; if (mobs[0] && mobs[0].def.boss) this.party_say('boss');
        const tk = this.tank(); tk.mob = mobs[0]; tk.state = 'hunt'; tk.path = null;
      }
    }
    else if (this.phase === 'pull') { if (this.timer < 0 || mobs.some(m => m.state === 'fight')) this.phase = 'fight'; }
    else if (this.phase === 'fight') {
      if (!mobs.length) {
        if (room.mobs[0] === 'boss') return this.victory();
        this.phase = 'rest'; this.timer = 0; this.asked = false; this.party_say('rest');
        for (const p of alive) { p.mob = null; p.state = 'idle'; p.resting = true; }
      } else for (const p of alive) if (p.state !== 'hunt' || !p.mob || p.mob.state === 'dead') {
        p.mob = (p.tank ? mobs.find(m => m.foe !== p) : null) || pick(mobs); p.state = 'hunt'; p.path = null; p.resting = false;
      }
    }
    else if (this.phase === 'rest') {
      const t2 = -this.timer, dead = this.party.some(p => p.dead && !p.gone);
      if (dead && !this.asked && t2 > 4) { this.asked = true; this.party_say('rez'); }
      const ready = alive.every(p => p.hp > p.maxHp * 0.75);
      if ((ready && t2 > 4 && (!dead || t2 > 16)) || t2 > 22) {
        this.room++; this.phase = 'move'; this.timer = 40;
        this.send([DUN.way[DUN.rooms[this.room - 1].way], DUN.way[DUN.rooms[this.room].way - 1]]);
      }
    }
  }

  bossBreath(m, dt, alive) {
    const ctx = this.ctx;
    if (this.breath > 0) {
      if ((this.breath -= dt) <= 0) {
        const r = this.art.ring; r.position.x = m.x; r.position.z = m.z; r.scale.setScalar(2); r.material.opacity = 0.9;
        for (const p of alive) ctx.people.hurt(p, Math.round(p.maxHp * 0.2 / (p.armor || 1)), m);   // a fifth of everyone's health, armour or not
      }
    } else if ((this.breathAt -= dt) <= 0) { this.breathAt = rnd(11, 15); this.breath = 2.2; ctx.chat('c-yell', 'Cinderjaw draws a deep, glowing breath...'); ctx.warn('Flame Breath!'); }
  }

  victory() {
    this.phase = 'done'; this.won = true;
    this.ctx.chat('c-sys', 'Cinderjaw has been defeated!');
    for (const p of this.alive()) { p.mob = null; p.state = 'idle'; p.anim = 'cheer'; p.animT = 4; }
    this.party_say('win'); setTimeout(() => this.active && this.party_say('win'), 2500);
    this.ctx.bossLoot(this.seen);
    setTimeout(() => { if (this.active && this.won) { for (const p of this.party) if (!p.gone) p.fading = true; this.ctx.chat('c-sys', 'The party hearths out. Leave by a portal; Emberdeep resets when you come back.'); } }, 14000);
  }
}
