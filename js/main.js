// Boot and the frame loop: ties the world, the people, the player and the HUD
// together, and runs targeting and spell casting.
import * as THREE from 'three';
import * as G from './game.js';
import * as UI from './ui.js';
import { buildWorld, spots } from './world.js';
import { makeFigure, animate } from './figure.js';
import { People } from './people.js';
import { Player } from './player.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
const world = buildWorld(scene);
const player = new Player(camera, canvas, world.blockers);
const me = makeFigure('Healer', 7); scene.add(me.group);

let S = G.load() || G.newState('');
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

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const v3 = new THREE.Vector3();
function project(pos, up) {
  v3.set(pos.x, up, pos.z).project(camera);
  if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) return null;
  return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight };
}
const distTo = p => Math.hypot(p.x - player.x, p.z - player.z);

function setTarget(p) { target = p; }
function tabTarget() {
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
  const hit = ray.intersectObjects(people.list.map(p => p.fig.hit), false)[0];
  setTarget(hit ? hit.object.userData.person : null);
};
player.onKey = e => {
  if (e.code === 'Tab') tabTarget();
  else if (e.code === 'Digit1' || e.code === 'Numpad1') cast(0);
  else if (e.code === 'Digit2' || e.code === 'Numpad2') cast(1);
  else if (e.code === 'KeyB' || e.code === 'KeyC') UI.toggleBag();
  else if (e.code === 'Escape') { if (casting) { casting = null; UI.err('Interrupted'); } else setTarget(null); }
};

function cast(i) {
  const sp = G.SPELLS[i];
  if (casting || gcd > 0) return UI.err('Not ready yet');
  if (!target) return UI.err('You have no target');
  if (distTo(target) > sp.range) return UI.err('Out of range');
  if (S.mana < sp.mana) return UI.err('Not enough mana');
  if (sp.cast && player.moving) return UI.err("Can't do that while moving");
  gcd = gcdMax = G.gcdTime(S);
  if (sp.cast) { casting = { spell: sp, target, t: 0, dur: G.castTime(S, sp) }; UI.sfx('cast'); }
  else land(sp, target);
}
function land(sp, t) {
  S.mana -= sp.mana;
  const h = G.healAmount(S, sp);
  if (sp.id === 'mend') { beam(t); UI.sfx('heal'); earn(people.heal(t, h.amount, h.crit), t); }
  else { t.hots = t.hots.filter(x => x.id !== sp.id); t.hots.push({ id: sp.id, tick: h.tick, left: h.ticks, every: h.every, t: h.every }); beam(t, 0x7dffa0); UI.sfx('heal'); }
}
function earn(eff, t) {
  const r = G.reward(S, eff, t);
  if (r.xp) UI.float(t, '+' + r.xp + ' xp', 'xp');
  if (r.levels) {
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
    S, world, chat: UI.chat, target: () => target, hit() {},
    float: (p, text, cls) => UI.float(p, text, cls),
    onHot: (p, amt) => { UI.sfx('tick'); earn(people.heal(p, amt, false, true), p); },
  });
  UI.init(S, { cast, tab: tabTarget, view: () => player.toggleView(), changed: () => G.save(S) });
  player.enabled = true; G.save(S);
  window.game = { S, people, player, cast, tabTarget, G, get target() { return target; }, set target(p) { target = p; } };
}
const nameBox = document.getElementById('cname'); nameBox.value = S.name || '';
document.getElementById('enter').onclick = () => start(nameBox.value.trim().slice(0, 12));
nameBox.addEventListener('keydown', e => { if (e.key === 'Enter') start(nameBox.value.trim().slice(0, 12)); });
if (new URLSearchParams(location.search).has('go')) start('Tester');

const clock = new THREE.Clock(); let T = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta()); T += dt; frame++;
  world.update(dt, T);
  if (!started) {   // slow orbit behind the title
    camera.position.set(Math.sin(T * 0.08) * 46, 16, Math.cos(T * 0.08) * 46); camera.lookAt(0, 4, 0);
    renderer.render(scene, camera); return;
  }
  player.update(dt);
  people.update(dt, T);
  const st = G.stats(S);
  S.mana = Math.min(st.maxMana, S.mana + st.regen * dt);
  if (gcd > 0) gcd -= dt;
  if (target && (target.gone || target.fading)) target = null;
  if (casting) {
    casting.t += dt;
    if (player.moving) { casting = null; gcd = 0; UI.err('Interrupted'); }
    else if (casting.target.gone) casting = null;
    else if (casting.t >= casting.dur) { const c = casting; casting = null; land(c.spell, c.target); }
  }
  me.group.position.set(player.x, player.y, player.z); me.group.rotation.y = player.yaw; me.group.visible = !player.firstPerson;
  animate(me, casting ? 'cast' : player.speed ? 'walk' : 'idle', T, player.back ? 0.7 : 1.15);

  ring.visible = !!target;
  if (target) { ring.position.set(target.x, 0.06, target.z); ring.scale.setScalar(1 + Math.sin(T * 5) * 0.06); }
  for (const b of beams) if (b.t > 0) {
    b.t -= dt; b.m.position.set(b.p.x, 2, b.p.z); b.m.material.opacity = Math.max(0, b.t / 0.7) * 0.5; b.m.rotation.y += dt * 3;
    b.m.scale.set(1 + (0.7 - b.t) * 0.5, 1, 1 + (0.7 - b.t) * 0.5); if (b.t <= 0) b.m.visible = false;
  }

  const sp = spots.find(s => Math.hypot(s.x - player.x, s.z - player.z) < s.r + 0.6) || null;
  if (sp !== lastSpot) { lastSpot = sp; if (sp) UI.chat('c-sys', sp.msg); }
  UI.hint(sp ? sp.msg : S.healed > 150 ? '' : !target ? 'Find someone hurt and press Tab to target them' :
    target.hp >= target.maxHp ? `${target.name} is at full health. Tab to someone hurt (red or yellow bar)` : 'Press 1 to cast Mend (stand still), or 2 for Renew');

  UI.update(dt, { stats: st, target, dist: target ? distTo(target) : 0, casting, gcd, gcdMax, project });
  if (frame % 4 === 0) UI.drawMap(player, player.yaw, people.list, target);
  if ((saveT += dt) > 15) { saveT = 0; G.save(S); }
  renderer.render(scene, camera);
}
tick();
