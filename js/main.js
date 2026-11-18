// Boot and the frame loop: ties the world, the people, the player and the HUD
// together, and runs targeting and spell casting.
import * as THREE from 'three';
import * as G from './game.js';
import * as UI from './ui.js';
import { buildWorld, spots, mapShapes, POI, inGreen } from './world.js';
import { Mobs } from './mobs.js';
import { Dungeon } from './dungeon.js';
import { DUN } from './world.js';
import { makeFigure, animate, makePlate } from './figure.js';
import { People } from './people.js';
import { Player } from './player.js';
import { makeLook } from './look.js';
import { Sparkles } from './fx.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
const world = buildWorld(scene);
const player = new Player(camera, canvas, world.blockers);
const me = makeFigure('Healer', 7); scene.add(me.group);
const fx = new Sparkles(scene), orbAt = new THREE.Vector3();
// Steady sparkle: embers over fires, motes drifting from the portals, the fountain's light.
fx.source(9, 1.3, -90, 14, { color: 0xff8a2a, spread: 0.25, up: 1.6, jitter: 0.25, life: 1.3 });
fx.source(0, 5.6, 0, 6, { color: 0xfff2a8, spread: 0.6, up: 0.3, jitter: 0.3, life: 1.6 });
for (const [k, c] of [['dungeon', 0xff8a3a], ['raid', 0xc07aff], ['pvp', 0xff4a5a]]) fx.source(POI[k].px, 3.4, POI[k].pz, 12, { color: c, spread: 2.2, up: 0.35, jitter: 0.35, life: 1.4 });
const burst = (t, color, n, up = 2.2) => fx.emit(t.x, 0.6, t.z, { n, color, spread: 0.55, up, jitter: 0.5, life: 1.2 });
// Pim the quartermaster stands behind the red stall.
const VX = 15, VZ = -12.9, vendor = makeFigure('Vendor', 3);
vendor.group.position.set(VX, 0, VZ); vendor.group.rotation.y = Math.atan2(-VX, -VZ); scene.add(vendor.group);
{ const pl = makePlate('Pim', '<Quartermaster>', '#ffd24a'); vendor.group.add(pl.sprite); }
mapShapes.push({ t: 'c', x: VX, z: VZ, r: 1.6, c: '#ffd24a' });
// Warden Hale hands out the quests at the Greenhollow camp.
const warden = makeFigure('Warden', 5);
warden.group.position.set(POI.warden.x, 0, POI.warden.z); warden.group.rotation.y = -2.2; scene.add(warden.group);
{ const pl = makePlate('Warden Hale', '<Quests>', '#ffd24a'); warden.group.add(pl.sprite); }
spots.push({ x: POI.warden.x - 1.5, z: POI.warden.z - 1.5, r: 2.4, msg: 'Warden Hale looks at your staff. "No quests for you, healer. Just keep them alive out there."' });
spots.push({ x: 12.4, z: -10.7, r: 2.2, msg: 'Pim the Quartermaster sells gear and bigger bags. Click or tap Pim to trade.' });

let S = G.load() || G.newState('');
let mobs, dungeon, zoneNow = 'hub';
// The healer as a unit, so F1 or a click on your own frame targets yourself.
const meUnit = { isMe: true, name: '', cls: 'Healer', level: 1, hp: 100, maxHp: 100, x: 0, z: 0, hots: [], dots: [], ward: null, dead: false, faded: 0, lastHit: -99 };
let drinking = 0, wardLock = new WeakMap(), ghost = false, corpse = null, cds = {};

// Threat. Healing someone a monster is fighting adds to that monster's
// threat on you; past a share of its health it turns on you. In Emberdeep
// the tank taunts it back a few seconds later.
const allMobs = () => zoneNow === 'dungeon' ? dungeon.mobs : mobs.list;
function addThreat(unit, amt) {
  if (!amt || meUnit.dead || meUnit.faded > 0) return;
  const tanked = zoneNow === 'dungeon' && dungeon.tank() && !dungeon.tank().dead;
  for (const m of allMobs()) {
    if (m.state !== 'fight' || m.foe === meUnit || !(m.foe === unit || m.attackers.has(unit))) continue;
    m.ht = (m.ht || 0) + amt * G.THREAT_PER_HEAL;
    if (m.ht > m.maxHp * (tanked ? G.THREAT_TANKED : G.THREAT_SOLO)) { m.foe = meUnit; m.attackers.add(meUnit); aggroed(m); if (tanked) m.tauntAt = T + G.TAUNT_BACK; }
  }
}
function aggroed(m) { UI.float(m, '!', 'dmg big'); if (!meUnit.lastAggro || T - meUnit.lastAggro > 6) { meUnit.lastAggro = T; UI.chat('c-yell', `${m.name} turns on you!`); UI.sfx('err'); } }
function hurtMe(dmg, by, big) {
  if (meUnit.dead) return;
  if (meUnit.ward) { const soak = Math.min(meUnit.ward.amt, dmg); meUnit.ward.amt -= soak; dmg -= soak; if (meUnit.ward.amt <= 0) meUnit.ward = null; if (!dmg) return UI.float(meUnit, 'Absorbed', 'xp'); }
  meUnit.hp -= dmg; meUnit.lastHit = T; drinking = 0; UI.float(meUnit, '-' + dmg, big ? 'dmg big' : 'dmg');
  if (meUnit.hp <= 0) die(by);
}
function die(by) {
  meUnit.hp = 0; meUnit.dead = true; meUnit.hots = []; meUnit.dots = []; meUnit.ward = null; casting = null; drinking = 0;
  corpse = { x: player.x, z: player.z, zone: zoneNow };
  for (const m of [...mobs.list, ...dungeon.mobs]) { m.attackers.delete(meUnit); if (m.foe === meUnit) m.foe = null; m.ht = 0; }
  UI.chat('c-yell', `You have been slain by ${by.name}.`); UI.sfx('err'); UI.death('dead');
}
function release() {         // become a ghost at the nearest safe spot and run back
  if (!meUnit.dead || ghost) return;
  ghost = true; player.speedMul = 1.35; target = null;
  const g = corpse.zone === 'dungeon' ? DUN.start : corpse.zone === 'green' ? POI.camp : POI.fountain;
  player.x = g.x; player.z = g.z + (corpse.zone === 'hub' ? 0 : 2);
  setGhost(true); UI.death('ghost'); UI.chat('c-sys', 'You are a spirit. Run back to your body, marked by a pillar of light, to return to life.');
}
function returnToLife() {
  if (!ghost || Math.hypot(corpse.x - player.x, corpse.z - player.z) > 6) return;
  ghost = false; meUnit.dead = false; player.speedMul = 1; setGhost(false); UI.death(null);
  const st = G.stats(S); meUnit.hp = Math.round(meUnit.maxHp * 0.5); S.mana = Math.max(S.mana, st.maxMana * 0.5); meUnit.faded = 4;
  burst(meUnit, 0xfff2a8, 40, 3); UI.sfx('level'); corpse = null;
}
const ghostMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.4, color: 0x9ad8ff, depthWrite: false });
const meMats = new Map();
function setGhost(on) { me.group.traverse(o => { if (!o.isMesh || o === me.hit) return; if (!meMats.has(o)) meMats.set(o, o.material); o.material = on && o.material.vertexColors ? ghostMat : meMats.get(o); }); }
const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 30, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
pillar.visible = false; scene.add(pillar);
const ZONE_NAME = { hub: 'Lanternrest', green: 'Greenhollow', dungeon: 'Emberdeep' };
let people, target = null, casting = null, gcd = 0, gcdMax = 1, started = false, tabSeen = new Set(), tabAt = 0, lastSpot = null, saveT = 0, frame = 0;

const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 28), new THREE.MeshBasicMaterial({ color: 0x4dff5a, transparent: true, opacity: 0.9, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
const beams = [];
const beamGeo = new THREE.CylinderGeometry(0.85, 0.85, 4, 14, 1, true);
function beam(p, color = 0xfff2a8) {
  let b = beams.find(b => b.t <= 0);
  if (!b) { b = { m: new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), t: 0 }; scene.add(b.m); beams.push(b); }
  b.t = 0.7; b.p = p; b.m.material.color.set(color); b.m.visible = true;
}

const look = makeLook(new URLSearchParams(location.search).get('look'), { scene, renderer, camera, world });
function resize() { look.resize(innerWidth, innerHeight); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const v3 = new THREE.Vector3(), _w = new THREE.Vector3();
function project(pos, up) {
  v3.set(pos.x, up, pos.z).project(camera);
  if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) return null;
  return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight, d: camera.position.distanceTo(_w.set(pos.x, up, pos.z)) };
}
const distTo = p => Math.hypot(p.x - player.x, p.z - player.z);

function setTarget(p) { target = p; }
const tabBack = [];
function hurtTarget() {
  const c = people.list.filter(p => p.grow >= 1 && !p.fading && p.hp < p.maxHp && distTo(p) < 45).sort((p, q) => (p.dead ? 2 : p.hp / p.maxHp) - (q.dead ? 2 : q.hp / q.maxHp));
  if (!c.length) return UI.err('No one nearby is hurt');
  setTarget(c[0]);    // the living first; the dead only when nobody else needs you
}
function tabTarget(back) {
  if (back === true) { let p; while ((p = tabBack.pop()) && (p.gone || p.fading)); if (p) setTarget(p); return; }
  if (target) { tabBack.push(target); if (tabBack.length > 20) tabBack.shift(); }
  const now = performance.now(); if (now - tabAt > 4000) tabSeen.clear(); tabAt = now;
  const a = player.yaw + player.camOff, fx = Math.sin(a), fz = Math.cos(a);
  let c = people.list.filter(p => p.grow >= 1 && !p.fading && distTo(p) < 45);
  const front = c.filter(p => (p.x - player.x) * fx + (p.z - player.z) * fz > 0);
  if (front.length) c = front;
  if (!c.length) return UI.err('No one nearby');
  let pool = c.filter(p => !tabSeen.has(p) && p !== target);
  if (!pool.length) { tabSeen.clear(); pool = c.filter(p => p !== target); if (!pool.length) pool = c; }
  pool.sort((p, q) => distTo(p) - distTo(q));
  tabSeen.add(pool[0]); setTarget(pool[0]);
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
player.onClick = (x, y) => {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([vendor.hit, ...people.list.map(p => p.fig.hit)], false)[0];
  if (hit && hit.object === vendor.hit) {
    if (Math.hypot(VX - player.x, VZ - player.z) > 9) return UI.err('Too far away');
    UI.openShop(); UI.chat('c-say', 'Pim says: Copper for cloth. Everything is blessed, probably.'); return;
  }
  setTarget(hit ? hit.object.userData.person : null);
};
player.onKey = e => {
  const fk = /^F([1-6])$/.exec(e.code);
  if (fk) { e.preventDefault(); if (fk[1] === '1') setTarget(meUnit); else pickFrame(+fk[1] - 2); return; }
  if (e.code === 'Tab') tabTarget(e.shiftKey);
  else if (e.code === 'KeyZ') toggleDrink();
  else if (e.code === 'Digit4' || e.code === 'Numpad4') cast(3);
  else if (e.code === 'Digit5' || e.code === 'Numpad5') cast(4);
  else if (e.code === 'Digit6' || e.code === 'Numpad6') cast(5);
  else if (e.code === 'KeyF') hurtTarget();
  else if (e.code === 'KeyX') toggleLook();
  else if (e.code === 'Digit1' || e.code === 'Numpad1') cast(0);
  else if (e.code === 'Digit2' || e.code === 'Numpad2') cast(1);
  else if (e.code === 'Digit3' || e.code === 'Numpad3') cast(2);
  else if (e.code === 'KeyB' || e.code === 'KeyC') UI.toggleBag();
  else if (e.code === 'Escape') { if (performance.now() - player.unlockAt < 400) return; if (casting) { casting = null; UI.err('Interrupted'); } else setTarget(null); }
};

function toggleLook() { S.look = !S.look; player.setLook(S.look); UI.setLook(S.look, player.locked); G.save(S); UI.chat('c-sys', S.look ? 'Mouse-look on: the mouse steers, A and D strafe. Esc frees the cursor; click the world to steer again.' : 'Mouse-look off: hold the right button to steer.'); }
player.onLock = locked => { if (started) UI.setLook(S.look, locked); };

const inCombat = () => !meUnit.dead && allMobs().some(m => m.state === 'fight' && m.foe === meUnit);
function pickFrame(i) { const u = UI.frameUnits()[i]; if (u) setTarget(u); }
function toggleDrink() {
  if (drinking) { drinking = 0; return; }
  if (meUnit.dead) return UI.err('You are dead');
  if (inCombat()) return UI.err("Can't drink in combat");
  if (casting || player.moving) return UI.err("Can't do that right now");
  drinking = 0.001;
}
function cast(i) {
  const sp = G.SPELLS[i];
  if (!G.knows(S, sp)) return UI.err(`${sp.name} is learned at level ${sp.lvl}`);
  if (meUnit.dead) return UI.err(ghost ? 'You are a spirit' : 'You are dead');
  if (casting || gcd > 0) return UI.err('Not ready yet');
  if ((cds[sp.id] || 0) > T) return UI.err(`${sp.name} is not ready yet`);
  if (sp.self) { if (S.mana < sp.mana) return UI.err('Not enough mana'); drinking = 0; gcd = gcdMax = G.gcdTime(S); return land(sp, meUnit); }
  if (!target) return UI.err('You have no target');
  if (sp.id === 'ward' && (wardLock.get(target) || 0) > T) return UI.err('That target was warded too recently');
  if (sp.id === 'revive' && !target.dead) return UI.err('Target is not dead');
  if (sp.id !== 'revive' && target.dead) return UI.err('Target is dead. Press 3 to Revive');
  if (distTo(target) > sp.range) return UI.err('Out of range');
  if (S.mana < sp.mana) return UI.err('Not enough mana');
  if (sp.cast && player.moving) return UI.err("Can't do that while moving");
  drinking = 0;
  gcd = gcdMax = G.gcdTime(S);
  if (sp.cast) { casting = { spell: sp, target, t: 0, dur: G.castTime(S, sp) }; UI.sfx('cast'); }
  else land(sp, target);
}
function land(sp, t) {
  if (sp.id === 'fade') {
    S.mana -= sp.mana; cds.fade = T + sp.cd; meUnit.faded = 3;
    for (const m of [...mobs.list, ...dungeon.mobs]) { m.ht = 0; m.attackers.delete(meUnit); if (m.foe === meUnit) m.foe = [...m.attackers].find(a => !a.dead && !a.gone) || (zoneNow === 'dungeon' ? dungeon.tank() : null) || null; }
    fx.emit(player.x, 1, player.z, { n: 30, color: 0x9ab0ff, spread: 0.6, up: 0.6, jitter: 1.4, life: 1 }); UI.sfx('equip'); return;
  }
  if ((sp.id === 'revive') !== !!t.dead || t.fading) return UI.err(t.dead ? 'Target is dead' : 'Target is not dead');
  if (S.mana < sp.mana) return UI.err('Not enough mana');
  S.mana -= sp.mana;
  if (sp.id === 'revive') {
    people.revive(t); beam(t, 0xffd76a); burst(t, 0xffd76a, 50, 3.2); fx.emit(t.x, 0.3, t.z, { n: 30, color: 0xfff2a8, spread: 1.2, up: 0.4, jitter: 2.4, life: 0.9 }); UI.sfx('level'); UI.chat('c-heal', `You bring ${t.name} back to life.`);
    UI.float(t, 'Revived', 'crit'); earn(t.maxHp, t); return;
  }
  const h = G.healAmount(S, sp);
  if (t.isMe) {           // healing yourself: no thanks, no experience
    if (h.amount) { const e = Math.min(h.amount, t.maxHp - t.hp); t.hp += e; UI.float(t, '+' + h.amount, h.crit ? 'crit' : ''); beam(t); burst(t, 0xa8ff8a, 20); UI.sfx('heal'); }
    else if (h.absorb) { t.ward = { amt: h.absorb, t: G.WARD_TIME }; wardLock.set(t, T + G.WARD_LOCK); beam(t, 0x9ac8ff); UI.sfx('heal'); }
    else { t.hots = t.hots.filter(x => x.id !== sp.id); t.hots.push({ id: sp.id, tick: h.tick, left: h.ticks, every: h.every, t: h.every }); beam(t, 0x7dffa0); UI.sfx('heal'); }
    return;
  }
  if (sp.id === 'ward') {
    t.ward = { amt: h.absorb, t: G.WARD_TIME }; wardLock.set(t, T + G.WARD_LOCK);
    beam(t, 0x9ac8ff); burst(t, 0xb8d8ff, 22); UI.sfx('heal'); UI.float(t, 'Ward', 'xp');
    if (t.zone === 'dungeon') dungeon.noticed(t);
    addThreat(t, h.absorb * 0.5);
    return;
  }
  if (sp.id === 'flash') { beam(t, 0xfff2a8); burst(t, 0xfff2a8, 20, 3); UI.sfx('heal'); const e = people.heal(t, h.amount, h.crit); addThreat(t, e); earn(e, t); return; }
  if (sp.id === 'mend') { beam(t); burst(t, 0xa8ff8a, 26); burst(t, 0xfff2a8, 10, 3); UI.sfx('heal'); const e = people.heal(t, h.amount, h.crit); addThreat(t, e); earn(e, t); }
  else { t.hots = t.hots.filter(x => x.id !== sp.id); t.hots.push({ id: sp.id, tick: h.tick, left: h.ticks, every: h.every, t: h.every }); beam(t, 0x7dffa0); burst(t, 0x7dffc0, 18); UI.sfx('heal'); }
}
function earn(eff, t) {
  const r = G.reward(S, eff, t);
  if (r.xp) UI.float(t, '+' + r.xp + ' xp', 'xp');
  if (r.levels) {
    for (const sp of G.SPELLS) if (sp.lvl && sp.lvl <= S.level && sp.lvl > S.level - r.levels) setTimeout(() => { UI.toast('New spell: ' + sp.name); UI.chat('c-heal', `You have learned ${sp.name}. Press ${sp.key}. ${sp.desc}`); }, 2800);
    S.mana = G.stats(S).maxMana; UI.toast('Level ' + S.level + '!'); UI.sfx('level'); UI.chat('c-sys', `Ding! You are now level ${S.level}.`);
    setTimeout(() => { const f = people.free(); if (f.length) people.say(f[0], 'gratz'); }, 1500);
  }
  if (r.item) {
    const kept = G.addItem(S, r.item);
    UI.chatHtml('c-loot', `${t.name} tosses you ${UI.itemLink(r.item)}${kept ? '' : ' (bag full: sold)'}`);
    UI.toast(r.item.name, G.RARITY_COLOR[r.item.q]); UI.sfx('loot');
  } else if (r.coins) { S.coins += r.coins; UI.chat('c-loot', `${t.name} tips you ${r.coins} copper.`); }
  if (r.item || r.coins || r.levels) { UI.drawBag(); G.save(S); }
}

function start(name) {
  if (started) return; started = true;
  if (name) S.name = name; if (!S.name) S.name = 'Healer';
  S.mana = G.stats(S).maxMana;
  people = new People(scene, {
    S, world, chat: UI.chat, target: () => target, eye: () => player, zone: () => zoneNow,
    float: (p, text, cls) => UI.float(p, text, cls),
    onHot: (p, amt) => { UI.sfx('tick'); fx.emit(p.x, 0.8, p.z, { n: 5, color: 0x7dffc0, spread: 0.45, up: 1.6, life: 0.9 }); const e = people.heal(p, amt, false, true); addThreat(p, e); earn(e, p); }, hurtMe,
  });
  mobs = new Mobs(scene, { S, people, me: meUnit, aggroed, eye: () => player, float: (p, text, cls) => UI.float(p, text, cls) });
  people.ctx.mobs = mobs;
  dungeon = new Dungeon(scene, { S, people, world, me: meUnit, aggroed, boom: (x, z) => fx.emit(x, 0.6, z, { n: 40, color: 0xff7a2a, spread: 0.8, up: 1.4, jitter: 3, life: 0.8 }), chat: UI.chat, float: (p, text, cls) => UI.float(p, text, cls), warn: text => { UI.toast(text, '#ff7a2a'); UI.sfx('err'); },
    bossLoot(helped) {
      const xp = Math.round(G.xpNeed(S.level) * 0.4); S.xp += xp; UI.chat('c-heal', `You gain ${xp} experience for the fall of Cinderjaw.`);
      const drops = [G.rollItem(S.level + 2, null, 2)]; if (Math.random() < 0.4) drops.push(G.rollItem(S.level + 1, null, 1));
      for (const it of drops) { const kept = G.addItem(S, it); UI.chatHtml('c-loot', `While the party argues over loot, you pocket ${UI.itemLink(it)}${kept ? '' : ' (bag full: sold)'}`); }
      UI.toast(drops[0].name, G.RARITY_COLOR[drops[0].q]); UI.sfx('loot');
      S.bosses = (S.bosses || 0) + 1; earn(0.0001, { maxHp: 1e9, level: S.level, name: '' }); UI.drawBag(); G.save(S);
    } });
  for (const f of dungeon.art.fires) fx.source(f.position.x, f.position.y + 0.4, f.position.z, 8, { color: 0xff7a2a, spread: 0.2, up: 1.5, jitter: 0.2, life: 1.1 }, 40);
  for (const p of dungeon.art.portals) fx.source(p.position.x, 2.2, p.position.z, 8, { color: 0x8ad0ff, spread: 1.2, up: 0.3, jitter: 0.3, life: 1.3 }, 40);
  people.ctx.dungeon = dungeon;
  UI.init(S, { cast, release, returnToLife, drink: toggleDrink, self: () => setTarget(meUnit), pick: pickFrame, tab: () => tabTarget(), hurt: hurtTarget, view: () => player.toggleView(), look: toggleLook, changed: () => G.save(S),
    panel: open => { if (open) player.free(); else if (S.look) player.lock(); } });
  player.look = !!S.look; UI.setLook(player.look, false);
  player.enabled = true; G.save(S);
  look.onLower = n => UI.chat('c-sys', ['', 'Graphics: soft glow turned off to keep things smooth.', 'Graphics: shadows turned off to keep things smooth.', 'Graphics: resolution lowered to keep things smooth.'][n]);
  window.game = { me: meUnit, get corpse() { return corpse; }, get casting() { return casting; }, S, people, mobs, dungeon, player, DUN, scene, renderer, cast, tabTarget, hurtTarget, toggleLook, UI, G, get target() { return target; }, set target(p) { target = p; } };
}
const nameBox = document.getElementById('cname'); nameBox.value = S.name || '';
document.getElementById('enter').onclick = () => start(nameBox.value.trim().slice(0, 12));
nameBox.addEventListener('keydown', e => { if (e.key === 'Enter') start(nameBox.value.trim().slice(0, 12)); });
if (new URLSearchParams(location.search).has('go')) start('Tester');

const clock = new THREE.Clock(); let T = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  if (!started) {   // slow orbit behind the title
    T += dt; world.update(dt, T);
    camera.position.set(Math.sin(T * 0.08) * 46, 16, Math.cos(T * 0.08) * 46); camera.lookAt(0, 4, 0);
    look.render(); return;
  }
  for (let i = 0; i < SPEED; i++) step(dt);   // ?speed=N runs the world faster, for tests
  look.update(dt, player);
  fx.update(dt, player);
  look.render();
}
const SPEED = Math.max(1, Math.min(20, +new URLSearchParams(location.search).get('speed') || 1));
function step(dt) {
  T += dt; frame++;
  world.update(dt, T);
  player.update(dt);
  { const st0 = G.stats(S); meUnit.name = S.name; meUnit.level = S.level; meUnit.x = player.x; meUnit.z = player.z;
    if (meUnit.maxHp !== st0.maxHp) { meUnit.hp = meUnit.maxHp = st0.maxHp; }
    for (let h = meUnit.hots.length - 1; h >= 0; h--) { const o = meUnit.hots[h]; if ((o.t -= dt) <= 0) { o.t += o.every; o.left--; meUnit.hp = Math.min(meUnit.maxHp, meUnit.hp + o.tick); UI.float(meUnit, '+' + o.tick, ''); if (o.left <= 0) meUnit.hots.splice(h, 1); } }
    if (meUnit.ward && (meUnit.ward.t -= dt) <= 0) meUnit.ward = null; }
  if (meUnit.faded > 0) meUnit.faded -= dt;
  if (meUnit.dead && !ghost && corpse) { player.x = corpse.x; player.z = corpse.z; }     // lying where you fell
  pillar.visible = !!(ghost && corpse); if (pillar.visible) { pillar.position.set(corpse.x, 15, corpse.z); }
  if (ghost && corpse) UI.death(Math.hypot(corpse.x - player.x, corpse.z - player.z) < 6 ? 'body' : 'ghost');
  if (!meUnit.dead && !inCombat() && T - meUnit.lastHit > 5 && meUnit.hp < meUnit.maxHp) meUnit.hp = Math.min(meUnit.maxHp, meUnit.hp + meUnit.maxHp * (drinking > 1 ? 0.06 : 0.02) * dt);
  if (drinking && (player.moving || casting)) drinking = 0;
  if (drinking) drinking += dt;
  people.update(dt, T);
  mobs.update(dt, T);
  dungeon.update(dt, T);
  // Portals: into Emberdeep from town, and back out again.
  if (zoneNow === 'hub' && Math.hypot(POI.dungeon.px - player.x, POI.dungeon.pz - player.z) < 2.2) {
    player.x = DUN.start.x; player.z = DUN.start.z; player.yaw = Math.PI; player.camOff = 0; target = null; casting = null; dungeon.enter();
    if (!S.seenDungeon) { S.seenDungeon = true; UI.chat('c-sys', 'A party is running Emberdeep without a healer. Follow them and keep them alive. Nobody will stop you.'); }
  } else if (zoneNow === 'dungeon' && DUN.exits.some(e => Math.hypot(e.x - player.x, e.z - player.z) < 2)) {
    player.x = POI.dungeon.x + 3; player.z = POI.dungeon.z; player.yaw = Math.PI / 2; player.camOff = 0; target = null; casting = null; dungeon.leave();
  }
  const z = player.x > 500 ? 'dungeon' : inGreen(player) ? 'green' : 'hub';
  if (z !== zoneNow) { zoneNow = z; UI.zone(ZONE_NAME[z]); world.mood(z === 'dungeon'); look.mood(z === 'dungeon'); if (z === 'green' && !S.seenGreen) { S.seenGreen = true; UI.chat('c-sys', 'People out here can die. Press 3 to Revive the fallen (5 second cast).'); } }
  const st = G.stats(S);
  S.mana = Math.min(st.maxMana, S.mana + (st.regen + (drinking > 1 ? st.maxMana * 0.08 : 0)) * dt);   // drinking: about 12 s from empty
  if (gcd > 0) gcd -= dt;
  if (target && (target.gone || target.fading)) target = null;
  if (casting && !player.firstPerson) {   // light gathers at the staff while casting
    me.sockets.handR.localToWorld(orbAt.set(0, 1.26, 0.06));
    fx.emit(orbAt.x, orbAt.y, orbAt.z, { n: 1, color: casting.spell.id === 'revive' ? 0xffd76a : 0xd8ffb0, spread: 0.35, up: 0.6, jitter: 0.4, life: 0.6 });
  }
  if (casting) {
    casting.t += dt;
    if (player.moving) { casting = null; gcd = 0; UI.err('Interrupted'); }
    else if (casting.target.gone || casting.target.fading) casting = null;
    else if (casting.t >= casting.dur) { const c = casting; casting = null; land(c.spell, c.target); }
  }
  me.group.position.set(player.x, player.y + (ghost ? 0.3 + Math.sin(T * 2) * 0.1 : 0), player.z); me.group.rotation.y = player.yaw; me.group.visible = !player.firstPerson;
  animate(me, meUnit.dead && !ghost ? 'dead' : casting ? 'cast' : drinking ? 'sit' : player.speed ? 'walk' : 'idle', T, player.back ? 0.7 : 1.15);

  ring.visible = !!target;
  if (target) { ring.position.set(target.x, 0.06, target.z); ring.scale.setScalar(1 + Math.sin(T * 5) * 0.06); }
  for (const b of beams) if (b.t > 0) {
    b.t -= dt; b.m.position.set(b.p.x, 2, b.p.z); b.m.material.opacity = Math.max(0, b.t / 0.7) * 0.5; b.m.rotation.y += dt * 3;
    b.m.scale.set(1 + (0.7 - b.t) * 0.5, 1, 1 + (0.7 - b.t) * 0.5); if (b.t <= 0) b.m.visible = false;
  }

  animate(vendor, 'idle', T); animate(warden, 'idle', T);
  if (UI.isShopOpen() && Math.hypot(VX - player.x, VZ - player.z) > 11) UI.closeShop();
  const sp = spots.find(s => Math.hypot(s.x - player.x, s.z - player.z) < s.r + 0.6) || null;
  if (sp !== lastSpot) { lastSpot = sp; if (sp) UI.chat('c-sys', sp.msg); }
  UI.hint(sp ? sp.msg : S.healed > 150 ? '' : !target ? 'Find someone hurt and press Tab to target them' :
    target.dead ? 'Press 3 to Revive (stand still)' : target.hp >= target.maxHp ? `${target.name} is at full health. Tab to someone hurt (red or yellow bar)` : 'Press 1 to cast Mend (stand still), or 2 for Renew');

  const inDun = zoneNow === 'dungeon' && dungeon.active;
  let list;
  if (inDun) list = dungeon.party.filter(p => !p.gone);
  else list = people.list.filter(p => p.grow >= 1 && !p.fading && (p.dead || p.hp < p.maxHp) && distTo(p) < 40)
    .sort((a, b) => (a.dead ? 1.5 : a.hp / a.maxHp) - (b.dead ? 1.5 : b.hp / b.maxHp));
  UI.update(dt, { stats: st, combat: inCombat(), cds, T, target, dist: target ? distTo(target) : 0, casting, gcd, gcdMax, project, dt, me: meUnit, drinking, list, party: inDun, distOf: distTo,
    boss: inDun ? dungeon.bossInfo() : null });
  if (frame % 4 === 0) UI.drawMap(player, player.yaw, people.list, target, corpse, zoneNow === 'dungeon' ? dungeon.mobs : mobs.list);
  if ((saveT += dt) > 15) { saveT = 0; G.save(S); }
}
tick();
