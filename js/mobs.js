// The monsters of Greenhollow: they graze around their camp, fight whoever
// attacks them, sometimes jump a passer-by, and come back a while after dying.
// They ignore the healer.
import { makeMob, animateMob, makePlate, MOBS } from './figure.js';
import { CAMPS, collide, WALL_R } from './world.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class Mobs {
  constructor(scene, ctx) {
    this.scene = scene; this.ctx = ctx; this.list = [];
    for (const c of CAMPS) for (let i = 0; i < c.n; i++) this.spawn(c);
  }
  spawn(camp, old) {
    const def = MOBS[camp.kind], level = Math.max(1, this.ctx.S.level + Math.floor(rnd(-1, 2)) + (def.elite ? 1 : 0));
    const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * camp.r;
    const m = old || { camp, kind: camp.kind, def, fig: makeMob(camp.kind) };
    if (m.plate) { m.fig.group.remove(m.plate.sprite); m.plate.sprite.material.map.dispose(); }
    m.plate = makePlate(def.name, (def.elite ? 'Elite · ' : '') + 'Level ' + level, def.elite ? '#ffb040' : '#ff6a5a');
    m.plate.sprite.position.y = def.elite ? 3.6 : 2; m.fig.group.add(m.plate.sprite);
    Object.assign(m, { name: def.name, level, maxHp: Math.round((40 + 18 * level) * def.hp), dmg: (6 + 2.5 * level) * def.dmg, x: camp.x + Math.sin(a) * d, z: camp.z + Math.cos(a) * d,
      yaw: a, state: 'idle', wait: rnd(1, 6), dest: null, foe: null, attackers: new Set(), swing: 1, deadT: 0, look: 1, grow: 0 });
    m.hp = m.maxHp; collide(m, 0.6);
    if (!old) { this.scene.add(m.fig.group); this.list.push(m); }
    return m;
  }
  // A person hits a monster. Returns true if that killed it.
  hurt(m, dmg, by) {
    if (m.state === 'dead') return true;
    m.attackers.add(by); if (!m.foe || m.foe.dead || m.foe.gone) m.foe = by; m.state = 'fight';
    m.hp -= dmg; this.ctx.float(m, String(dmg), 'hit');
    if (m.hp <= 0) { m.hp = 0; m.state = 'dead'; m.deadT = rnd(20, 30); m.foe = null; m.attackers.clear(); if (this.ctx.killed) this.ctx.killed(m); return true; }
    return false;
  }
  update(dt, t) {
    const eye = this.ctx.eye(), folk = this.ctx.people.list;
    for (const m of this.list) {
      const g = m.fig.group;
      g.visible = Math.hypot(m.x - eye.x, m.z - eye.z) < 150;
      if (m.grow < 1) m.grow = Math.min(1, m.grow + dt * 2);
      let anim = 'idle';
      if (m.state === 'dead') {
        m.deadT -= dt; anim = 'dead';
        g.scale.setScalar(m.deadT < 16 ? 0.01 : 1);          // the body lies a few seconds, then is gone
        if (m.deadT <= 0) this.spawn(m.camp, m);
        animateMob(m.fig, anim, t); g.position.set(m.x, 0, m.z); m.plate.sprite.visible = false; continue;
      }
      m.plate.sprite.visible = true; g.scale.setScalar(Math.max(0.01, m.grow));
      if (m.state === 'fight') {
        let f = m.foe;
        if (!f || f.dead || f.gone || Math.hypot(f.x - m.camp.x, f.z - m.camp.z) > m.camp.r + 45 || Math.hypot(f.x, f.z) < WALL_R + 4) {   // the town is safe
          m.attackers.delete(f); f = m.foe = [...m.attackers].find(a => !a.dead && !a.gone) || null;
          if (!f) { m.state = 'idle'; m.wait = 1; m.attackers.clear(); }
        }
        if (f) {
          const dx = f.x - m.x, dz = f.z - m.z, d = Math.hypot(dx, dz);
          m.yaw = Math.atan2(dx, dz);
          if (d > 1.9) { m.x += dx / d * m.def.speed * dt; m.z += dz / d * m.def.speed * dt; collide(m, 0.5); anim = 'walk'; }
          else {
            anim = 'attack';
            if ((m.swing -= dt) <= 0) { m.swing = rnd(1.5, 2.1); this.ctx.people.hurt(f, Math.round(m.dmg * rnd(0.8, 1.25)), m); }
          }
        }
      } else {
        if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25 * dt);
        if (m.dest) {
          const dx = m.dest.x - m.x, dz = m.dest.z - m.z, d = Math.hypot(dx, dz);
          if (d < 0.4) m.dest = null; else { m.x += dx / d * 1.3 * dt; m.z += dz / d * 1.3 * dt; collide(m, 0.5); m.yaw = Math.atan2(dx, dz); anim = 'walk'; }
        } else if ((m.wait -= dt) <= 0) {
          m.wait = rnd(3, 9); const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * m.camp.r;
          m.dest = { x: m.camp.x + Math.sin(a) * d, z: m.camp.z + Math.cos(a) * d };
        }
        if ((m.look -= dt) <= 0) {        // now and then, jump someone who wanders close
          m.look = 1;
          if (Math.random() < 0.12) {
            const me = this.ctx.me, v = folk.find(p => p.zone === 'green' && !p.dead && !p.fading && Math.hypot(p.x - m.x, p.z - m.z) < 7)
              || (!me.dead && !(me.faded > 0) && Math.hypot(me.x - m.x, me.z - m.z) < 7 ? me : null);     // the healer is fair game too
            if (v) { m.foe = v; m.attackers.add(v); m.state = 'fight'; if (v === me) this.ctx.aggroed(m); }
          }
        }
      }
      animateMob(m.fig, anim, t); g.position.set(m.x, 0, m.z); g.rotation.y = m.yaw;
      m.plate.draw(m.hp / m.maxHp, false);
    }
  }
}
