// The Bloodsand Pit: a battleground behind the red portal. Sunward (gold, the
// south end) and Duskward (crimson, the north end), six a side, try to steal
// each other's flag and carry it home. First to three captures, or the most
// in eight minutes, wins. The fallen rise at their base after a while unless
// someone revives them first. Nobody asked for a healer here either, and both
// sides watch whom you heal: heal one side and the other sends hunters after
// you; the side you favour may send someone to guard you.
import * as THREE from 'three';
import { makePlate } from './figure.js';
import { PIT, label } from './world.js';
import * as TX from './textures.js';

const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
export const TEAMS = {
  sun: { name: 'Sunward', color: '#ffc040', hex: 0xffc040, foe: 'dusk' },
  dusk: { name: 'Duskward', color: '#ff4a5a', hex: 0xd83040, foe: 'sun' },
};
export const CAPS = 3, MATCH = 480, RESPAWN = 12;
const SAY = {
  start: ['get their flag!', 'two on D, rest go', 'I will carry, cover me', 'gl hf'],
  hunt: ['someone kill that healer', 'the healer is with them, get it', 'focus the healer!!', 'why is a random healer helping THEM'],
  love: ['that healer is with us!', 'protect the healer', 'ty healer, we got you', 'healer on our side, nice'],
  cap: ['CAPPED', 'one more!', 'that is a cap', 'ez'], lost: ['they capped...', 'D, where was D?', 'get it back!'],
  win: ['gg', 'easy', 'well played', 'gg, thanks healer'], lose: ['gg', 'they had a healer', 'rematch', 'next time'],
};
const sandC = 0xf0dcb0;

export function buildPit(scene, blockers) {
  const L = c => new THREE.MeshLambertMaterial({ color: c });
  const [x0, z0, x1, z1] = PIT.rects[0], cx = (x0 + x1) / 2;
  const t = TX.dirt(); t.repeat.set(8, 18);
  const f = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 12, 0.1, z1 - z0 + 12), new THREE.MeshLambertMaterial({ color: sandC, map: t })); f.position.set(cx, -0.05, 0); scene.add(f);
  const g2 = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 8), L(0xa08a60)); g2.position.set(x1 + 4, -0.05, 0); scene.add(g2);
  // High walls with tiers of benches (the crowd) behind them.
  const stone = new THREE.MeshLambertMaterial({ color: 0xb89a70, map: TX.stone() });
  const wall = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), stone); m.position.set(x, 1.6, z); m.userData.flat = true; scene.add(m); blockers.push(m); };
  wall(x0 - 1, 0, 2, z1 - z0 + 4); wall(cx, z0 - 1, x1 - x0 + 4, 2); wall(cx, z1 + 1, x1 - x0 + 4, 2);
  wall(x1 + 1, (z1 + 4) / 2 + 1, 2, z1 - 4 + 2); wall(x1 + 1, (z0 - 4) / 2 - 1, 2, -z0 - 4 + 2);
  for (let i = 0; i < 3; i++) {
    for (const [x, z, w, d] of [[x0 - 4 - i * 3, 0, 3, z1 - z0 + 10], [cx, z0 - 4 - i * 3, x1 - x0 + 10, 3], [cx, z1 + 4 + i * 3, x1 - x0 + 10, 3]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), stone); b.position.set(x, 3.6 + i * 1.4, z); b.userData.flat = true; scene.add(b);
    }
  }
  // Sand dunes and bones for cover-looking clutter along the sides.
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, z = -44 + i * 9.5, r = rnd(1.2, 2.2);
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), L(0xc8a870)); d.scale.y = 0.45; d.position.set(cx + side * rnd(18, 23), 0, z); scene.add(d);
  }
  // A base at each end: a ring of stones, banners and the flag stand.
  const flags = {}, banners = [];
  for (const k in TEAMS) {
    const T = TEAMS[k], b = PIT.bases[k], col = new THREE.MeshLambertMaterial({ color: T.hex, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(5, 6, 32), new THREE.MeshLambertMaterial({ color: T.hex })); ring.rotation.x = -Math.PI / 2; ring.position.set(b.x, 0.03, b.z); ring.userData.flat = true; scene.add(ring);
    for (const x of [-10, 10]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), L(0x5a4028)); pole.position.set(b.x + x, 3.5, b.z + Math.sign(b.z) * 4); scene.add(pole);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3), col); cloth.position.set(b.x + x + 0.85, 5.2, b.z + Math.sign(b.z) * 4); scene.add(cloth); banners.push(cloth);
    }
    const lb = label(T.name, 'Base', 2.6); lb.position.set(b.x, 8, b.z + Math.sign(b.z) * 5); scene.add(lb);
    // The flag: a pole with a cloth, moved about by the controller.
    const fg = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), L(0xe8e0d0)); pole.position.y = 1.6; fg.add(pole);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85), new THREE.MeshLambertMaterial({ color: T.hex, emissive: T.hex, emissiveIntensity: 0.25, side: THREE.DoubleSide })); cl.position.set(0.68, 2.7, 0); fg.add(cl);
    fg.position.set(b.x, 0, b.z); scene.add(fg); flags[k] = { group: fg, cloth: cl };
  }
  const p = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.25, 8, 20), new THREE.MeshBasicMaterial({ color: 0x6ab8ff })); p.position.set(PIT.exits[0].x, 2.2, 0); p.rotation.y = Math.PI / 2; scene.add(p);
  const c = new THREE.Mesh(new THREE.CircleGeometry(1.7, 18), new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })); c.position.copy(p.position); c.rotation.y = Math.PI / 2; scene.add(c);
  const lb = label('Lanternrest', 'Way out', 1.6); lb.position.set(PIT.exits[0].x, 4.6, 0); scene.add(lb);
  return { flags, update(dt, t) { p.rotation.z += dt; for (const b of banners) b.rotation.y = Math.sin(t * 1.3 + b.position.x) * 0.25; for (const k in flags) flags[k].cloth.rotation.y = Math.sin(t * 3 + (k === 'sun' ? 0 : 2)) * 0.3; } };
}

export class Pit {
  constructor(scene, ctx) { this.scene = scene; this.ctx = ctx; this.party = []; this.mobs = []; this.active = false; this.art = buildPit(scene, ctx.world.blockers); }
  enter() { this.active = true; this.start(); }
  leave() { this.active = false; this.clear(); }
  clear() { for (const p of this.party) if (!p.gone) this.ctx.people.remove(p); this.party = []; }
  start() {
    this.clear();
    const folk = this.ctx.people;
    const roles = ['guard', 'runner', 'runner', 'fighter', 'fighter', 'fighter'];
    for (const k in TEAMS) {
      const T = TEAMS[k], b = PIT.bases[k];
      roles.forEach((role, i) => {
        const p = folk.spawn(b.x + (i - 2.5) * 1.6, b.z + Math.sign(b.z) * 2, 1);
        p.zone = 'pvp'; folk.relevel(p, 'pvp'); p.wait = 1e9; p.team = k; p.role = role; p.focus = role === 'runner'; p.yaw = b.z > 0 ? Math.PI : 0; p.pvpK = 0.7;
        if (['Mage', 'Warlock', 'Ranger', 'Druid'].includes(p.cls)) p.reach = rnd(7, 9);
        // Team colours over their heads instead of the guild.
        p.fig.group.remove(p.plate.sprite); p.plate.sprite.material.map.dispose();
        p.plate = makePlate(p.name, '<' + T.name + '>', T.color); p.fig.group.add(p.plate.sprite);
        this.party.push(p);
      });
    }
    this.flag = { sun: { at: 'home', x: PIT.bases.sun.x, z: PIT.bases.sun.z, by: null }, dusk: { at: 'home', x: PIT.bases.dusk.x, z: PIT.bases.dusk.z, by: null } };
    this.score = { sun: 0, dusk: 0 }; this.hate = { sun: 0, dusk: 0 }; this.given = { sun: 0, dusk: 0 };
    Object.assign(this, { phase: 'prep', timer: 15, t: MATCH, think: 0, result: null, hunters: { sun: 0, dusk: 0 } });
    this.ctx.chat('c-sys', 'The Bloodsand Pit: Sunward against Duskward. Bring the other side\'s flag home to your own. First to 3 captures, or the most in 8 minutes.');
    this.teamSay('sun', 'start');
  }
  team(k) { return this.party.filter(p => p.team === k && !p.gone); }
  alive() { return this.party.filter(p => !p.dead && !p.gone); }
  tank() { return null; }
  teamSay(k, key, who) { const a = this.team(k).filter(p => !p.dead); if (a.length) this.ctx.chat('c-party', `[${TEAMS[k].name}] ${(who || pick(a)).name}: ${pick(SAY[key])}`); }
  // For the frames: Sunward then Duskward.
  frameList() { return [...this.team('sun'), ...this.team('dusk')]; }

  // The healer healed someone: their foes take note (a full bar of healing is 1).
  healed(p, amt) {
    if (!p.team || !amt) return;
    const k = amt / p.maxHp; this.given[p.team] += k;
    this.hate[TEAMS[p.team].foe] += k; this.hate[p.team] -= k * 0.5;
  }
  // How each side sees you, for the scoreboard.
  standing(k) { const h = this.hate[k]; return h > 1 ? 'hunting you' : h < -1 ? 'on your side' : h > 0.3 ? 'watching you' : ''; }
  died(p, by) {
    p.respawnAt = this.t - RESPAWN;
    if (this.flag) for (const k in this.flag) { const f = this.flag[k]; if (f.by === p) { f.by = null; f.at = 'dropped'; f.x = p.x; f.z = p.z; this.news(`${p.name} drops the ${TEAMS[k].name} flag!`); } }
    if (by && by.isMe === undefined && Math.random() < 0.08) this.ctx.chat('c-party', `[${TEAMS[by.team] ? TEAMS[by.team].name : 'Pit'}] ${by.name}: ${pick(['got one', 'down', 'next', 'too easy'])}`);
  }
  news(text) { this.ctx.chat('c-yell', text); }

  update(dt, t) {
    this.art.update(dt, t);
    if (!this.active) return;
    const ctx = this.ctx, me = ctx.me, folk = ctx.people;
    // Flags follow their carriers, or stand where they are.
    for (const k in this.flag) {
      const f = this.flag[k], g = this.art.flags[k].group;
      if (f.by) { f.x = f.by.x; f.z = f.by.z; g.position.set(f.x, 1.2, f.z); g.scale.setScalar(0.8); }
      else { g.position.set(f.x, 0, f.z); g.scale.setScalar(1); }
    }
    if (this.phase === 'end') { if ((this.timer -= dt) < 0) { ctx.chat('c-sys', 'A new match forms in the Bloodsand Pit.'); this.start(); } return; }
    if (this.phase === 'prep') {
      if ((this.timer -= dt) <= 0) { this.phase = 'play'; this.news('The gates open! Capture the flag!'); ctx.warn('Fight!'); this.teamSay('dusk', 'start'); }
      return;
    }
    this.t -= dt;
    for (const k in this.hate) this.hate[k] *= Math.pow(0.985, dt);     // tempers cool slowly
    // The fallen rise at their base.
    for (const p of this.party) if (p.dead && !p.gone && p.respawnAt !== undefined && this.t < p.respawnAt) {
      const b = PIT.bases[p.team]; p.x = b.x + rnd(-3, 3); p.z = b.z + Math.sign(b.z) * 3; Object.assign(p, { dead: false, hp: p.maxHp, state: 'idle', wait: 1e9, mob: null, dots: [], respawnAt: undefined, anim: 'idle', animT: 0 });
    }
    // Pick-ups, returns and captures.
    for (const p of this.alive()) {
      const own = this.flag[p.team], foe = this.flag[TEAMS[p.team].foe], foeK = TEAMS[p.team].foe;
      if (!foe.by && foe.at !== 'cap' && Math.hypot(p.x - foe.x, p.z - foe.z) < 1.8) { foe.by = p; foe.at = 'carried'; this.news(`${p.name} has taken the ${TEAMS[foeK].name} flag!`); }
      if (own.at === 'dropped' && Math.hypot(p.x - own.x, p.z - own.z) < 1.8) { own.at = 'home'; own.x = PIT.bases[p.team].x; own.z = PIT.bases[p.team].z; this.news(`${p.name} returns the ${TEAMS[p.team].name} flag.`); }
      const home = PIT.bases[p.team];
      if (foe.by === p && own.at === 'home' && Math.hypot(p.x - home.x, p.z - home.z) < 3) {
        this.score[p.team]++; foe.by = null; foe.at = 'home'; foe.x = PIT.bases[foeK].x; foe.z = PIT.bases[foeK].z;
        this.news(`${p.name} captures the ${TEAMS[foeK].name} flag! ${TEAMS.sun.name} ${this.score.sun}, ${TEAMS.dusk.name} ${this.score.dusk}.`);
        this.teamSay(p.team, 'cap'); this.teamSay(foeK, 'lost'); ctx.sfx('level');
        if (this.score[p.team] >= CAPS) return this.end(p.team);
      }
    }
    if (this.t <= 0) return this.end(this.score.sun === this.score.dusk ? null : this.score.sun > this.score.dusk ? 'sun' : 'dusk');
    // Hunters and guards, from how each side sees you.
    for (const k in TEAMS) {
      const want = me.dead || me.faded > 0 ? 0 : this.hate[k] > 4 ? 3 : this.hate[k] > 2.5 ? 2 : this.hate[k] > 1 ? 1 : 0;
      if (want > this.hunters[k]) { this.teamSay(k, 'hunt'); ctx.warn(`${TEAMS[k].name} is hunting you!`); }
      if (this.hate[k] < -1 && this.hunters[k] >= 0 && !this.loved?.[k]) { this.loved = { ...(this.loved || {}), [k]: true }; this.teamSay(k, 'love'); }
      this.hunters[k] = want;
    }
    if ((this.think -= dt) > 0) return;
    this.think = 0.5;
    for (const k in TEAMS) this.orders(k);
  }

  // Each half second: who goes where. Runners go for the enemy flag (and
  // carry it home), the guard holds the base, fighters roam the middle and
  // chase carriers; some fighters become hunters of the healer, or guards.
  orders(k) {
    const me = this.ctx.me, T = TEAMS[k], foeK = T.foe, mine = this.team(k).filter(p => !p.dead), foes = this.team(foeK).filter(p => !p.dead);
    const base = PIT.bases[k], foeBase = PIT.bases[foeK], own = this.flag[k], foe = this.flag[foeK];
    const near = (p, r) => foes.filter(q => Math.hypot(q.x - p.x, q.z - p.z) < r).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    const fighters = mine.filter(p => p.role === 'fighter');
    const hunters = fighters.slice(0, this.hunters[k]);
    const guardMe = this.hate[k] < -1 && !me.dead ? fighters.find(p => !hunters.includes(p)) : null;
    const meHunters = this.party.filter(q => !q.dead && q.mob === me);
    for (const p of mine) {
      let goal = null, fight = null;
      if (foe.by === p) goal = base;                                      // carrying: run home, no fighting
      else if (hunters.includes(p)) fight = me;
      else if (p === guardMe) { fight = meHunters.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0] || null; if (!fight) goal = { x: me.x + 2, z: me.z + 2 }; }
      else if (p.role === 'runner') { goal = foe.by ? (foe.by === p ? base : { x: foe.by.x + rnd(-2, 2), z: foe.by.z + rnd(-2, 2) }) : foe; }
      else if (own.by && !own.by.dead) fight = own.by;                    // someone has our flag: chase them
      else if (own.at === 'dropped' && p.role !== 'runner') goal = own;   // ours is lying out there: return it
      else if (p.role === 'guard') { fight = near(base, 16); if (!fight) goal = { x: base.x + rnd(-3, 3), z: base.z - Math.sign(base.z) * 4 }; }
      else { fight = near(p, 14); if (!fight) goal = foe.by ? { x: foe.by.x + rnd(-3, 3), z: foe.by.z + rnd(-3, 3) } : { x: base.x + rnd(-14, 14), z: rnd(-15, 15) }; }
      if (fight) { if (p.mob !== fight || p.state !== 'hunt') { p.mob = fight; p.state = 'hunt'; p.path = null; } }
      else if (goal) {
        if (p.state === 'hunt' || p.state === 'idle' || !p.dest || Math.hypot(p.dest.x - goal.x, p.dest.z - goal.z) > 3) { p.mob = null; p.dest = { x: goal.x, z: goal.z }; p.state = 'walk'; p.stuck = 0; p.path = null; }
      }
    }
  }
  end(win) {
    const ctx = this.ctx; this.phase = 'end'; this.timer = 14; this.result = win;
    for (const p of this.alive()) { p.mob = null; p.state = 'idle'; if (p.team === win) { p.anim = 'cheer'; p.animT = 4; } }
    if (!win) { this.news(`The match is a draw, ${this.score.sun} to ${this.score.dusk}.`); }
    else { this.news(`${TEAMS[win].name} wins the Bloodsand Pit, ${this.score[win]} to ${this.score[TEAMS[win].foe]}!`); this.teamSay(win, 'win'); this.teamSay(TEAMS[win].foe, 'lose'); }
    if (ctx.matchOver) ctx.matchOver(win, this);
  }
  // For the scoreboard.
  board() {
    if (!this.active) return null;
    const fl = k => { const f = this.flag[k]; return f.by ? 'carried by ' + f.by.name : f.at === 'dropped' ? 'dropped' : 'home'; };
    return { score: this.score, t: this.phase === 'prep' ? MATCH : Math.max(0, this.t), prep: this.phase === 'prep' ? this.timer : 0, flags: { sun: fl('sun'), dusk: fl('dusk') },
      stand: { sun: this.standing('sun'), dusk: this.standing('dusk') }, end: this.phase === 'end' ? (this.result ? TEAMS[this.result].name + ' wins!' : 'Draw') : '' };
  }
}
