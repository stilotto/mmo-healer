// The other "players". In town (zone 'hub') they wander, duel, train, come
// back hurt from dungeons and catch airships. Out in Greenhollow (zone
// 'green') they take quests from the warden, hunt monsters, rest, and die if
// nobody heals them. None of them asked for a healer.
import { makeFigure, animate, makePlate, CLASSES } from './figure.js';
import { POI, CAMPS, collide } from './world.js';
import { npcMaxHp } from './game.js';

const NAMES = ('Brannoc Mirelle Stabbsworth Healzplz Moonwhisk Critney Pwnsalot Sneakums Frostbiscuit Dotsanddots Grumbar Elowen ' +
  'Kazrik Thistle Oatmeal Nightsoup Arrowynn Shieldon Fizzlewick Bonk Smashley Vexa Dorn Quillon Embera Tobblin Muffinblade ' +
  'Sapsworth Zugmar Lilybrook Hexabelle Rustyn Corvash Pemberly Ironwhisk Glimmerfen Oxbane Snackrifice Aggrotha Manabun ' +
  'Lootgoblin Afkevin Rezplox Kitebert Pullmore Wipesalot Nerfbat Gankrid Tavish Ysolde Marrow Juniper Halvard Sable Orrin ' +
  'Fenna Dask Wren Bigdam Tinycrit Oomagain Stunlock Pocketsand Cheddar Vandrel Isska Bramblewick Tuggle Noobert Questlove ' +
  'Faceroll Mossbeard Petal Grindolf Yarrow Skiptext Hobnail Clickmore Dewdrop Runsalot Farmhand').split(' ');
const GUILDS = ['Wipe Club', 'Lantern Guard', 'Casual Fridays', 'Loot Council', 'The Unhealed', 'Dps Is A Role', '', '', ''];
const KINDS = ['Knight', 'Ranger', 'Mage', 'Rogue', 'Warlock', 'Druid', 'Brawler'];
const GENERAL = ['LF healer for Emberdeep, have tank and 3 dps', 'WTS 20 copper bars, cheap', 'anyone questing in Greenhollow?',
  'LFM Shattered Spire, need heals!!', 'anyone want to duel?', 'where is the bank', 'it is right behind you', 'WTB bigger bags',
  'need 1 healer then we go', 'when is the next airship', 'ding!', 'gratz', 'selling portals, oh wait they are free', 'any healers on?',
  'LF guild, casual, I bring snacks', 'who keeps healing people in the duelling ring', 'that healer is not even in our party lol',
  'Bloodsand Pit queue is 40 minutes', 'tank LFG, will not pull the whole room this time', 'can someone explain what spirit does'];
const ZONECHAT = ['where do I find Bristle Boars', 'south of the farm', 'Old Tusk is up, need 3 more', 'do NOT solo Old Tusk', 'these wolves hit hard',
  'anyone else getting random heals out here?', 'boar tusks will not drop for me', 'is there a graveyard closer than town', 'LFG Old Tusk', 'slimes give terrible xp'];
const HURT = ['could use a heal', 'ow', 'anyone got a bandage?', 'need heals', 'low hp, brb'];
const THANKS = ['ty!', 'thanks!', 'oh nice, thx', 'ty healer', 'where did that heal come from?', 'cheers', 'you are the best', '<3', 'thx, who are you?'];
const SAVED = ['that heal saved me', 'omg ty', 'clutch heal!', 'I was dead for sure. ty', 'marry me, healer'];
const REZ = ['you rezzed me?? who ARE you', 'ty for the rez!', 'best. healer. ever.', 'saved me the corpse run, thanks', 'a rez out here? legend'];
const PARTY = { dungeon: ['ugh, that last boss', 'we wiped twice', 'who pulled?', 'repair bill is going to hurt'],
  raid: ['one percent wipe. ONE percent.', 'healers went oom again', 'same time tomorrow'], pvp: ['they had three healers', 'gg', 'I got jumped at the flag'] };
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const GREEN_POP = 14;

export class People {
  constructor(scene, ctx) {
    this.scene = scene; this.ctx = ctx; this.list = []; this.used = new Set();
    this.duelT = 6; this.portalT = 10; this.chatT = 5; this.popT = 4; this.t = 0;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * 6.283, d = rnd(8, 45);
      const p = this.spawn(Math.sin(a) * d, Math.cos(a) * d, Math.random() < 0.3 ? rnd(0.3, 0.85) : 1);
      collide(p, 0.5);
    }
    for (let i = 0; i < GREEN_POP; i++) {
      const c = pick(CAMPS.filter(c => c.kind !== 'tusk')), a = Math.random() * 6.283;
      const p = this.spawn(c.x + Math.sin(a) * (c.r + 6), c.z + Math.cos(a) * (c.r + 6), rnd(0.45, 1));
      p.zone = 'green'; p.quest = { need: 3 + Math.floor(rnd(0, 3)), done: Math.floor(rnd(0, 3)) }; collide(p, 0.5);
    }
  }

  spawn(x, z, frac = 1, kind) {
    let name; do { name = pick(NAMES); } while (this.used.has(name) && this.used.size < NAMES.length);
    this.used.add(name);
    const cls = kind || pick(KINDS), level = Math.max(1, this.ctx.S.level + Math.floor(rnd(-1, 3)));
    const guild = pick(GUILDS);
    const fig = makeFigure(cls), plate = makePlate(name, guild ? '<' + guild + '>' : '', CLASSES[cls].color);
    fig.group.add(plate.sprite);
    const maxHp = npcMaxHp(level);
    const p = { name, cls, level, guild, maxHp, hp: Math.max(1, Math.round(maxHp * frac)), x, z, yaw: Math.random() * 6, fig, plate, zone: 'hub',
      state: 'idle', wait: rnd(0.5, 4), dest: null, path: null, hots: [], duel: null, mob: null, quest: null, hurtAt: this.t, anim: 'idle', animT: 0,
      grow: 0, thankAt: 0, gone: false, dead: false, swing: 1 };
    fig.group.position.set(x, 0, z); fig.group.scale.setScalar(0.01); fig.hit.userData.person = p;
    this.scene.add(fig.group); this.list.push(p);
    return p;
  }

  remove(p) { p.gone = true; this.used.delete(p.name); this.scene.remove(p.fig.group); p.plate.sprite.material.map.dispose(); this.list.splice(this.list.indexOf(p), 1); }

  hub() { return this.list.filter(p => p.zone === 'hub' && !p.fading); }
  green() { return this.list.filter(p => p.zone === 'green' && !p.fading); }
  free() { return this.list.filter(p => p.zone === 'hub' && !p.duel && !p.leaving && !p.path && p.grow >= 1 && !p.fading); }
  near(p) { const e = this.ctx.eye(); return Math.hypot(p.x - e.x, p.z - e.z) < 60; }

  say(p, text, kind = 'say') {
    if (kind === 'say' && !this.near(p)) return;      // you only hear /say close by
    this.ctx.chat(kind === 'gen' ? 'c-gen' : 'c-say', kind === 'gen' ? `[${p.zone === 'green' ? 'Greenhollow' : 'General'}] ${p.name}: ${text}` : `${p.name} says: ${text}`);
  }

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

  go(p, o, j = 2) { p.dest = { x: o.x + rnd(-j, j), z: o.z + rnd(-j, j), face: o.fx !== undefined ? o : null }; p.state = 'walk'; p.stuck = 0; p.resting = false; }
  // Walk through the gate, one way or the other.
  through(p, toGreen) {
    const a = POI.gateIn, b = POI.gateOut;
    p.path = toGreen ? [{ x: b.x, z: b.z }, { x: POI.camp.x + rnd(-3, 3), z: POI.camp.z + rnd(-2, 2) }] : [{ x: a.x, z: a.z }, { x: rnd(-8, 8), z: rnd(-44, -30) }];
    this.go(p, toGreen ? a : b, 0.8); p.mob = null;
  }

  think(p) {
    const r = Math.random();
    p.train = false;
    if (r < 0.07 && p.hp > p.maxHp * 0.7 && this.green().length < GREEN_POP + 3) { this.through(p, true); if (Math.random() < 0.4) this.say(p, pick(['off to Greenhollow', 'time to grind boars', 'brb questing'])); }
    else if (r < 0.24) this.go(p, POI.fountain, 5);
    else if (r < 0.42) this.go(p, pick(POI.stalls), 1);
    else if (r < 0.7) this.go(p, POI[pick(['inn', 'bank', 'auction', 'guild', 'dock', 'gate'])], 2.5);
    else if (r < 0.82) { this.go(p, pick(POI.dummies), 0.2); p.train = true; }
    else if (r < 0.9) this.go(p, { x: rnd(-13, 13), z: 40 + pick([-12, 12]) }, 1);
    else this.go(p, { x: rnd(-35, 35), z: rnd(-35, 35) }, 0);
  }

  // Out in the zone: rest, take or hand in a quest, or pick something to fight.
  thinkGreen(p) {
    const mobs = this.ctx.mobs.list;
    if (p.hp < p.maxHp * 0.45 && Math.random() < 0.85) { p.resting = true; p.state = 'idle'; p.wait = rnd(7, 12); return; }
    p.resting = false;
    if (!p.quest) { p.turnIn = false; this.go(p, POI.camp, 2.5); p.atCamp = true; return; }
    if (p.quest.done >= p.quest.need) { p.turnIn = true; this.go(p, POI.camp, 2.5); p.atCamp = true; return; }
    let c = mobs.filter(m => m.state !== 'dead' && m.attackers.size < (m.def.elite ? 4 : 2) && (!m.def.elite || m.attackers.size > 0 || Math.random() < 0.15));
    const busy = c.filter(m => m.attackers.size > 0);
    if (busy.length && Math.random() < 0.3) c = busy;
    c.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const m = c[Math.floor(Math.random() * Math.min(4, c.length))];
    if (!m) { this.go(p, POI.camp, 6); return; }
    p.mob = m; p.state = 'hunt'; p.stuck = 0;
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
    if (this.near(w)) this.ctx.chat('c-sys', draw ? `${w.name} and ${l.name} call their duel a draw.` : `${w.name} has defeated ${l.name} in a duel.`);
    for (const p of [w, l]) { p.duel = null; p.state = 'idle'; p.wait = rnd(3, 7); p.anim = 'idle'; }
    if (!draw) { w.anim = 'cheer'; w.animT = 2; if (Math.random() < 0.5) this.say(l, pick(['gg', 'rematch', 'lag', 'I was not ready'])); }
  }

  // A monster hits a person.
  hurt(p, dmg, by) {
    if (p.dead || p.fading) return;
    dmg = Math.max(1, Math.round(dmg * (p.armor || 1)));
    p.hp -= dmg; p.hurtAt = this.t; p.resting = false; this.ctx.float(p, '-' + dmg, 'dmg');
    if (p.hp <= 0) return this.kill(p, by);
    if (p.state !== 'hunt' || !p.mob || p.mob.state === 'dead') { p.mob = by; p.state = 'hunt'; p.path = null; p.stuck = 0; }
    if (p.hp < p.maxHp * 0.25 && !p.cried && this.near(p)) { p.cried = true; this.say(p, pick(['HELP', 'heals!!', 'I am going down', 'so dead'])); }
  }
  kill(p, by) {
    p.hp = 0; p.dead = true; p.state = 'dead'; p.deadT = 80; p.hots = []; p.mob = null; p.path = null; p.cried = false;
    if (p.zone === 'dungeon') p.deadT = 1e9;
    if (this.ctx.zone() === p.zone) this.ctx.chat('c-yell', `${p.name} has been slain by ${by.name}.`);
  }
  revive(p) {
    p.dead = false; p.hp = Math.round(p.maxHp * 0.35); p.state = 'idle'; p.wait = 4; p.hurtAt = this.t; p.resting = false;
    p.anim = 'cheer'; p.animT = 2; this.say(p, pick(REZ));
  }

  // Healing from the player. Returns the effective amount.
  heal(p, amount, crit, quiet) {
    if (p.dead) return 0;
    const low = p.hp < p.maxHp * 0.3, eff = Math.min(amount, p.maxHp - p.hp);
    p.hp += eff;
    this.ctx.float(p, '+' + amount, crit ? 'crit' : '');
    if (eff > 0) {
      if (p.zone === 'dungeon') this.ctx.dungeon.noticed(p);
      if (p.duel && !p.duel.healed) { p.duel.healed = true; if (Math.random() < 0.7) this.say(p.duel.foe, pick(['hey! no outside heals!', 'who is healing ' + p.name + '??', 'that is cheating', 'ref!'])); }
      if (!p.duel && this.t > p.thankAt && (p.hp >= p.maxHp || eff > p.maxHp * 0.3) && !quiet) {
        p.thankAt = this.t + 15;
        if (p.state !== 'hunt') { p.anim = 'cheer'; p.animT = 1.3; }
        if (Math.random() < 0.75) this.say(p, pick(low && p.state === 'hunt' ? SAVED : THANKS));
      }
    }
    return eff;
  }

  update(dt, t) {
    this.t = t;
    const ctx = this.ctx, ship = ctx.world.ship, eye = ctx.eye(), hubN = this.hub().length;
    if ((this.duelT -= dt) <= 0) { this.duelT = rnd(7, 16); this.startDuel(); }
    if ((this.portalT -= dt) <= 0) {
      this.portalT = rnd(16, 28);
      const key = pick(['dungeon', 'dungeon', 'raid', 'pvp']), n = key === 'raid' ? 3 + Math.floor(rnd(0, 4)) : 1 + Math.floor(rnd(0, 4));
      if (hubN < 32) {
        const g = this.arrive(key, n, true);
        if (this.near(g[0])) ctx.chat('c-sys', n > 1 ? `A battered party of ${n} stumbles out of the ${key === 'pvp' ? 'Bloodsand Pit' : key === 'raid' ? 'Shattered Spire' : 'Emberdeep'} portal.` : `${g[0].name} limps out of a portal.`);
        setTimeout(() => { if (!g[0].gone) this.say(g[0], pick(PARTY[key])); }, 2500);
      }
      if (hubN > 22) this.depart(n);
    }
    if (ship.arrived) { if (hubN < 32) this.arrive('dock', 3 + Math.floor(rnd(0, 3)), false); this.depart(3); if (Math.hypot(eye.x, eye.z) < 70) ctx.chat('c-sys', 'An airship ties up at the Skydock.'); }
    if ((this.chatT -= dt) <= 0) {
      this.chatT = rnd(5, 12);
      const here = ctx.zone(), f = here === 'green' ? this.green().filter(p => !p.dead) : this.free();
      if (f.length) this.say(pick(f), pick(here === 'green' ? ZONECHAT : GENERAL), 'gen');
    }
    if ((this.popT -= dt) <= 0) {       // keep Greenhollow busy: new faces walk out of the gate
      this.popT = rnd(8, 14);
      if (this.green().length < GREEN_POP) { const p = this.spawn(POI.gateOut.x + rnd(-1, 1), POI.gateOut.z - 2, 1); p.zone = 'green'; }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i], g = p.fig.group;
      if (p.fading) { p.grow -= dt * 3; if (p.grow <= 0) { this.remove(p); continue; } }
      else if (p.grow < 1) p.grow = Math.min(1, p.grow + dt * 2.5);
      g.scale.setScalar(Math.max(0.01, p.grow));
      g.visible = Math.hypot(p.x - eye.x, p.z - eye.z) < 150;

      if (p.dead) {
        if ((p.deadT -= dt) <= 0 && !p.fading) { p.fading = true; if (this.near(p)) ctx.chat('c-sys', `${p.name} releases their spirit.`); }
        animate(p.fig, 'dead', t); g.position.set(p.x, 0, p.z); p.plate.draw(0, ctx.target() === p, true); continue;
      }
      for (let h = p.hots.length - 1; h >= 0; h--) {
        const hot = p.hots[h];
        if ((hot.t -= dt) <= 0) { hot.t += hot.every; hot.left--; ctx.onHot(p, hot.tick); if (hot.left <= 0) p.hots.splice(h, 1); }
      }
      if (p.resting) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.05 * dt);
      else if (!p.duel && p.state !== 'hunt' && t - p.hurtAt > 25 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.003 * dt);
      if (p.zone === 'hub' && p.z < -66) p.zone = 'green'; else if (p.zone === 'green' && p.z > -58) { p.zone = 'hub'; p.quest = null; }

      let anim = 'idle';
      if (p.state === 'walk') {
        const dx = p.dest.x - p.x, dz = p.dest.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.6 || p.stuck > 3) {
          if (p.path && p.path.length) { p.dest = p.path.shift(); p.stuck = 0; if (!p.path.length) p.path = null; }
          else if (p.leaving) p.fading = true;
          else if (p.duel) { p.duel.ready = true; p.state = 'duel'; if (p.duel.foe.duel && p.duel.foe.duel.ready && this.near(p)) ctx.chat('c-sys', `${p.duel.foe.name} has challenged ${p.name} to a duel.`); }
          else {
            p.state = 'idle'; p.wait = p.train ? rnd(8, 18) : rnd(4, 14); if (p.dest.face) p.yaw = Math.atan2(p.dest.face.fx - p.x, p.dest.face.fz - p.z);
            if (p.zone === 'green' && p.atCamp) {
              p.atCamp = false; p.wait = rnd(2, 5); p.yaw = Math.atan2(POI.warden.x - p.x, POI.warden.z - p.z);
              if (p.turnIn) {
                p.anim = 'cheer'; p.animT = 1.5; p.quest = null;
                if (Math.random() < 0.3) { p.level++; p.maxHp = npcMaxHp(p.level); p.hp = p.maxHp; this.say(p, 'ding!'); }
                if (Math.random() < 0.3) { p.goHome = true; }
              } else p.quest = { need: 3 + Math.floor(rnd(0, 3)), done: 0 };
            }
          }
        } else {
          const sp = (p.hp < p.maxHp * 0.4 ? 3.2 : 5.5) * dt, ox = p.x, oz = p.z;
          p.x += dx / d * sp; p.z += dz / d * sp; collide(p, 0.5);
          if (Math.hypot(p.x - ox, p.z - oz) < sp * 0.3) p.stuck += dt;
          const want = Math.atan2(p.x - ox, p.z - oz); let da = want - p.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); p.yaw += da * Math.min(1, dt * 10);
          anim = 'walk';
        }
      } else if (p.state === 'hunt') {
        const m = p.mob;
        if (!m || m.state === 'dead') { p.state = 'idle'; p.wait = rnd(1.5, 3.5); p.mob = null; }
        else {
          const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
          p.yaw = Math.atan2(dx, dz);
          if (d > 1.9) { const sp = 5.5 * dt; p.x += dx / d * sp; p.z += dz / d * sp; collide(p, 0.5); anim = 'walk'; }
          else {
            anim = 'attack';
            if ((p.swing -= dt) <= 0) {
              p.swing = rnd(1.3, 1.9);
              if ((m.owner || ctx.mobs).hurt(m, Math.round((11 + 4.5 * p.level) * rnd(0.8, 1.25)), p)) {
                for (const q of this.list) if (q.mob === m && q.quest) q.quest.done++;
                p.cried = false;
              }
            }
          }
        }
      } else if (p.state === 'duel') {
        const d = p.duel, f = d.foe;
        p.yaw = Math.atan2(f.x - p.x, f.z - p.z);
        if (d.ready && f.duel && f.duel.ready) {
          anim = 'attack'; d.t += dt;
          if ((d.swing -= dt) <= 0) {
            d.swing = rnd(1.1, 1.9);
            const dmg = Math.min(f.hp - 1, Math.round(f.maxHp * rnd(0.06, 0.13)));
            f.hp -= dmg; f.hurtAt = t; ctx.float(f, '-' + dmg, 'dmg');
            if (f.hp <= f.maxHp * 0.12) this.endDuel(p, f, false);
            else if (d.t > 75) this.endDuel(p, f, true);
          }
        }
      } else {
        if (p.train) anim = 'attack';
        if (p.resting) anim = 'sit';
        if ((p.wait -= dt) <= 0) {
          if (p.zone === 'dungeon') p.wait = 1e9;
          else if (p.zone === 'green') { if (p.goHome) { p.goHome = false; this.through(p, false); } else this.thinkGreen(p); }
          else if (p.hp < p.maxHp * 0.5 && Math.random() < 0.3) { this.say(p, pick(HURT)); p.wait = rnd(5, 10); }
          else this.think(p);
        }
      }
      if (p.animT > 0) { p.animT -= dt; anim = p.anim; }
      if (g.visible) animate(p.fig, anim, t, anim === 'walk' && p.hp < p.maxHp * 0.4 ? 0.6 : 1);
      g.position.set(p.x, 0, p.z); g.rotation.y = p.yaw;
      p.plate.draw(p.hp / p.maxHp, ctx.target() === p, false);
    }
  }
}
