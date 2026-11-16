// The other "players": they wander the hub, duel, train, come back hurt from
// dungeons and raids, and catch airships. None of them asked for a healer.
import { makeFigure, animate, makePlate, CLASSES } from './figure.js';
import { POI, collide } from './world.js';
import { npcMaxHp } from './game.js';

const NAMES = ('Brannoc Mirelle Stabbsworth Healzplz Moonwhisk Critney Pwnsalot Sneakums Frostbiscuit Dotsanddots Grumbar Elowen ' +
  'Kazrik Thistle Oatmeal Nightsoup Arrowynn Shieldon Fizzlewick Bonk Smashley Vexa Dorn Quillon Embera Tobblin Muffinblade ' +
  'Sapsworth Zugmar Lilybrook Hexabelle Rustyn Corvash Pemberly Ironwhisk Glimmerfen Oxbane Snackrifice Aggrotha Manabun ' +
  'Lootgoblin Afkevin Rezplox Kitebert Pullmore Wipesalot Nerfbat Gankrid Tavish Ysolde Marrow Juniper Halvard Sable Orrin ' +
  'Fenna Dask Wren Bigdam Tinycrit Oomagain Stunlock Pocketsand Cheddar Vandrel Isska').split(' ');
const GUILDS = ['Wipe Club', 'Lantern Guard', 'Casual Fridays', 'Loot Council', 'The Unhealed', 'Dps Is A Role', '', '', ''];
const KINDS = ['Knight', 'Ranger', 'Mage', 'Rogue', 'Warlock', 'Druid', 'Brawler'];
const GENERAL = ['LF healer for Emberdeep, have tank and 3 dps', 'WTS 20 copper bars, cheap', 'is the Greenhollow gate bugged or just closed?',
  'LFM Shattered Spire, need heals!!', 'anyone want to duel?', 'where is the bank', 'it is right behind you', 'WTB bigger bags',
  'need 1 healer then we go', 'when is the next airship', 'ding!', 'gratz', 'selling portals, oh wait they are free', 'any healers on?',
  'LF guild, casual, I bring snacks', 'who keeps healing people in the duelling ring', 'that healer is not even in our party lol',
  'Bloodsand Pit queue is 40 minutes', 'tank LFG, will not pull the whole room this time', 'can someone explain what spirit does'];
const HURT = ['could use a heal', 'ow', 'anyone got a bandage?', 'need heals', 'low hp, brb'];
const THANKS = ['ty!', 'thanks!', 'oh nice, thx', 'ty healer', 'where did that heal come from?', 'cheers', 'you are the best', '<3', 'thx, who are you?'];
const PARTY = { dungeon: ['ugh, that last boss', 'we wiped twice', 'who pulled?', 'repair bill is going to hurt'],
  raid: ['one percent wipe. ONE percent.', 'healers went oom again', 'same time tomorrow'], pvp: ['they had three healers', 'gg', 'I got jumped at the flag'] };
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];

export class People {
  constructor(scene, ctx) {
    this.scene = scene; this.ctx = ctx; this.list = []; this.used = new Set();
    this.duelT = 6; this.portalT = 10; this.chatT = 5; this.t = 0;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * 6.283, d = rnd(8, 45);
      const p = this.spawn(Math.sin(a) * d, Math.cos(a) * d, Math.random() < 0.3 ? rnd(0.3, 0.85) : 1);
      collide(p, 0.5);
    }
  }

  spawn(x, z, frac = 1) {
    let name; do { name = pick(NAMES); } while (this.used.has(name) && this.used.size < NAMES.length);
    this.used.add(name);
    const cls = pick(KINDS), level = Math.max(1, this.ctx.S.level + Math.floor(rnd(-1, 3)));
    const guild = pick(GUILDS);
    const fig = makeFigure(cls), plate = makePlate(name, guild ? '<' + guild + '>' : '', CLASSES[cls].color);
    fig.group.add(plate.sprite);
    const maxHp = npcMaxHp(level);
    const p = { name, cls, level, guild, maxHp, hp: Math.max(1, Math.round(maxHp * frac)), x, z, yaw: Math.random() * 6, fig, plate,
      state: 'idle', wait: rnd(0.5, 4), dest: null, hots: [], duel: null, hurtAt: this.t, anim: 'idle', animT: 0, grow: 0, thankAt: 0, gone: false };
    fig.group.position.set(x, 0, z); fig.group.scale.setScalar(0.01); fig.hit.userData.person = p;
    this.scene.add(fig.group); this.list.push(p);
    return p;
  }

  remove(p) { p.gone = true; this.used.delete(p.name); this.scene.remove(p.fig.group); p.plate.sprite.material.map.dispose(); this.list.splice(this.list.indexOf(p), 1); }

  free() { return this.list.filter(p => !p.duel && !p.leaving && p.grow >= 1); }

  say(p, text, kind = 'say') { this.ctx.chat(kind === 'gen' ? 'c-gen' : 'c-say', kind === 'gen' ? `[General] ${p.name}: ${text}` : `${p.name} says: ${text}`); }

  arrive(key, n, hurt) {
    const o = POI[key], out = [];
    for (let i = 0; i < n; i++) {
      const p = this.spawn(o.x + rnd(-1.5, 1.5), o.z + rnd(-1.5, 1.5), hurt ? rnd(0.12, 0.75) : (Math.random() < 0.5 ? rnd(0.5, 0.9) : 1));
      p.wait = rnd(1, 4) + i * 0.4; out.push(p);
    }
    return out;
  }
  depart(n) {
    const f = this.free().filter(p => p.hp > p.maxHp * 0.6);
    for (let i = 0; i < n && f.length; i++) {
      const p = f.splice(Math.floor(Math.random() * f.length), 1)[0];
      p.leaving = pick(['dock', 'dungeon', 'raid', 'pvp']); this.go(p, POI[p.leaving], 0.6);
    }
  }

  go(p, o, j = 2) { p.dest = { x: o.x + rnd(-j, j), z: o.z + rnd(-j, j), face: o.fx !== undefined ? o : null }; p.state = 'walk'; p.stuck = 0; }

  think(p) {
    const r = Math.random();
    p.train = false;
    if (r < 0.2) this.go(p, POI.fountain, 5);
    else if (r < 0.4) this.go(p, pick(POI.stalls), 1);
    else if (r < 0.7) this.go(p, POI[pick(['inn', 'bank', 'auction', 'guild', 'dock', 'gate'])], 2.5);
    else if (r < 0.82) { this.go(p, pick(POI.dummies), 0.2); p.train = true; }
    else if (r < 0.9) this.go(p, { x: rnd(-13, 13), z: 40 + pick([-12, 12]) }, 1);
    else this.go(p, { x: rnd(-35, 35), z: rnd(-35, 35) }, 0);
  }

  startDuel() {
    const f = this.free().filter(p => p.hp > p.maxHp * 0.7);
    if (f.length < 2 || this.list.filter(p => p.duel).length >= 4) return;
    const a = f.splice(Math.floor(Math.random() * f.length), 1)[0], b = pick(f), ang = Math.random() * 6.283;
    const off = rnd(-4, 4), ox = Math.cos(ang) * off, oz = Math.sin(ang) * off;
    [a, b].forEach((p, i) => {
      const s = i ? -1 : 1;
      p.duel = { foe: i ? a : b, ready: false, swing: rnd(0.5, 1.5), t: 0, healed: false };
      p.dest = { x: POI.ring.x + ox + Math.sin(ang) * 1.1 * s, z: POI.ring.z + oz + Math.cos(ang) * 1.1 * s }; p.state = 'walk'; p.stuck = 0;
    });
  }
  endDuel(w, l, draw) {
    this.ctx.chat('c-sys', draw ? `${w.name} and ${l.name} call their duel a draw.` : `${w.name} has defeated ${l.name} in a duel.`);
    for (const p of [w, l]) { p.duel = null; p.state = 'idle'; p.wait = rnd(3, 7); p.anim = 'idle'; }
    if (!draw) { w.anim = 'cheer'; w.animT = 2; if (Math.random() < 0.5) this.say(l, pick(['gg', 'rematch', 'lag', 'I was not ready'])); }
  }

  // Healing from the player. Returns the effective amount.
  heal(p, amount, crit, quiet) {
    const eff = Math.min(amount, p.maxHp - p.hp);
    p.hp += eff;
    this.ctx.float(p, '+' + amount, crit ? 'crit' : '');
    if (eff > 0) {
      if (p.duel && !p.duel.healed) { p.duel.healed = true; if (Math.random() < 0.7) this.say(p.duel.foe, pick(['hey! no outside heals!', 'who is healing ' + p.name + '??', 'that is cheating', 'ref!'])); }
      if (!p.duel && this.t > p.thankAt && (p.hp >= p.maxHp || eff > p.maxHp * 0.3) && !quiet) {
        p.thankAt = this.t + 15; p.anim = 'cheer'; p.animT = 1.3;
        if (Math.random() < 0.75) this.say(p, pick(THANKS));
      }
    }
    return eff;
  }

  update(dt, t) {
    this.t = t;
    const ctx = this.ctx, ship = ctx.world.ship;
    if ((this.duelT -= dt) <= 0) { this.duelT = rnd(7, 16); this.startDuel(); }
    if ((this.portalT -= dt) <= 0) {
      this.portalT = rnd(16, 28);
      const key = pick(['dungeon', 'dungeon', 'raid', 'pvp']), n = key === 'raid' ? 3 + Math.floor(rnd(0, 4)) : 1 + Math.floor(rnd(0, 4));
      if (this.list.length < 34) {
        const g = this.arrive(key, n, true);
        ctx.chat('c-sys', n > 1 ? `A battered party of ${n} stumbles out of the ${key === 'pvp' ? 'Bloodsand Pit' : key === 'raid' ? 'Shattered Spire' : 'Emberdeep'} portal.` : `${g[0].name} limps out of a portal.`);
        setTimeout(() => { if (!g[0].gone) this.say(g[0], pick(PARTY[key])); }, 2500);
      }
      if (this.list.length > 22) this.depart(n);
    }
    if (ship.arrived) { if (this.list.length < 34) this.arrive('dock', 3 + Math.floor(rnd(0, 3)), false); this.depart(3); ctx.chat('c-sys', 'An airship ties up at the Skydock.'); }
    if ((this.chatT -= dt) <= 0) { this.chatT = rnd(5, 12); const f = this.free(); if (f.length) this.say(pick(f), pick(GENERAL), 'gen'); }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.fading) { p.grow -= dt * 3; if (p.grow <= 0) { this.remove(p); continue; } }
      else if (p.grow < 1) p.grow = Math.min(1, p.grow + dt * 2.5);
      p.fig.group.scale.setScalar(Math.max(0.01, p.grow));

      for (let h = p.hots.length - 1; h >= 0; h--) {
        const hot = p.hots[h];
        if ((hot.t -= dt) <= 0) { hot.t += hot.every; hot.left--; ctx.onHot(p, hot.tick); if (hot.left <= 0) p.hots.splice(h, 1); }
      }
      if (!p.duel && t - p.hurtAt > 25 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.003 * dt);

      let anim = 'idle';
      if (p.state === 'walk') {
        const dx = p.dest.x - p.x, dz = p.dest.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.5 || p.stuck > 3) {
          if (p.leaving) p.fading = true;
          else if (p.duel) { p.duel.ready = true; p.state = 'duel'; if (p.duel.foe.duel && p.duel.foe.duel.ready) ctx.chat('c-sys', `${p.duel.foe.name} has challenged ${p.name} to a duel.`); }
          else { p.state = 'idle'; p.wait = p.train ? rnd(8, 18) : rnd(4, 14); if (p.dest.face) p.yaw = Math.atan2(p.dest.face.fx - p.x, p.dest.face.fz - p.z); }
        } else {
          const sp = (p.hp < p.maxHp * 0.4 ? 3.2 : 5.5) * dt, ox = p.x, oz = p.z;
          p.x += dx / d * sp; p.z += dz / d * sp; collide(p, 0.5);
          if (Math.hypot(p.x - ox, p.z - oz) < sp * 0.3) p.stuck += dt;
          const want = Math.atan2(p.x - ox, p.z - oz); let da = want - p.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); p.yaw += da * Math.min(1, dt * 10);
          anim = 'walk';
        }
      } else if (p.state === 'duel') {
        const d = p.duel, f = d.foe;
        p.yaw = Math.atan2(f.x - p.x, f.z - p.z);
        if (d.ready && f.duel && f.duel.ready) {
          anim = 'attack'; d.t += dt;
          if ((d.swing -= dt) <= 0) {
            d.swing = rnd(1.1, 1.9);
            const dmg = Math.min(f.hp - 1, Math.round(f.maxHp * rnd(0.06, 0.13)));
            f.hp -= dmg; f.hurtAt = t; ctx.float(f, '-' + dmg, 'dmg'); ctx.hit(f);
            if (f.hp <= f.maxHp * 0.12) this.endDuel(p, f, false);
            else if (d.t > 75) this.endDuel(p, f, true);
          }
        }
      } else {
        if (p.train) anim = 'attack';
        if ((p.wait -= dt) <= 0) {
          if (p.hp < p.maxHp * 0.5 && Math.random() < 0.3) { this.say(p, pick(HURT)); p.wait = rnd(5, 10); }
          else this.think(p);
        }
      }
      if (p.animT > 0) { p.animT -= dt; anim = p.anim; }
      animate(p.fig, anim, t, anim === 'walk' && p.hp < p.maxHp * 0.4 ? 0.6 : 1);
      p.fig.group.position.set(p.x, 0, p.z); p.fig.group.rotation.y = p.yaw;
      p.plate.draw(p.hp / p.maxHp, ctx.target() === p);
    }
  }
}
