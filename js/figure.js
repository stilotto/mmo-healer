// Blocky people: one model per calling, a walk cycle, and the name plate that
// floats over each head.
import * as THREE from 'three';

export const CLASSES = {
  Knight:  { color: '#c79c6e', tunic: 0x8a8f99, hat: 'helm', weapon: 'sword' },
  Ranger:  { color: '#abd473', tunic: 0x4f7a3a, hat: 'hood', weapon: 'bow' },
  Mage:    { color: '#69ccf0', tunic: 0x3b5fc0, hat: 'cone', weapon: 'staff' },
  Rogue:   { color: '#fff569', tunic: 0x3a3340, hat: 'hood', weapon: 'dagger' },
  Warlock: { color: '#9482c9', tunic: 0x5a2f7a, hat: 'cone', weapon: 'staff' },
  Druid:   { color: '#ff7d0a', tunic: 0x7a5a2f, hat: 'none', weapon: 'staff' },
  Brawler: { color: '#00ff96', tunic: 0xa33a2a, hat: 'none', weapon: 'none' },
  Vendor:  { color: '#ffd24a', tunic: 0x8a6a2a, hat: 'none', weapon: 'none' },
  Healer:  { color: '#ffffff', tunic: 0xf2ead2, hat: 'hood', weapon: 'staff' },
};
const SKIN = [0xf1c9a5, 0xd9a577, 0xa8703f, 0x6e4526, 0x9fc98a, 0xb9a8d8];
const HAIR = [0x2a1b10, 0x6b4a22, 0xd8b45a, 0xb23a1a, 0xdddddd, 0x1a1a22];

const mats = {};
const mat = c => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const G = {
  body: box(0.56, 0.7, 0.32), head: box(0.36, 0.36, 0.36), leg: box(0.22, 0.7, 0.24), arm: box(0.18, 0.62, 0.2),
  skirt: box(0.6, 0.5, 0.36), hair: box(0.4, 0.14, 0.4), helm: box(0.42, 0.3, 0.42), hood: box(0.44, 0.42, 0.42),
  cone: new THREE.ConeGeometry(0.3, 0.6, 6), brim: new THREE.CylinderGeometry(0.42, 0.42, 0.04, 8),
  sword: box(0.07, 0.9, 0.12), staff: box(0.07, 1.7, 0.07), dagger: box(0.05, 0.4, 0.08), orb: new THREE.SphereGeometry(0.13, 8, 6),
  shield: box(0.08, 0.5, 0.42), hit: new THREE.CylinderGeometry(0.55, 0.55, 2.1, 6),
  shadow: new THREE.CircleGeometry(0.55, 12),
};
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const orbMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });

export function makeFigure(cls, seed = Math.random() * 1000) {
  const c = CLASSES[cls], r = n => { seed = (seed * 9301 + 49297) % 233280; return Math.floor(seed / 233280 * n); };
  const skin = mat(SKIN[r(SKIN.length)]), tunic = mat(c.tunic), dark = mat(0x2b2622);
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const add = (geo, m, x, y, z, parent = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  add(G.body, tunic, 0, 1.08, 0);
  const robe = c.weapon === 'staff';
  if (robe) add(G.skirt, tunic, 0, 0.55, 0);
  const head = add(G.head, skin, 0, 1.62, 0);
  if (c.hat === 'helm') add(G.helm, mat(0xaab0bb), 0, 1.7, 0);
  else if (c.hat === 'hood') add(G.hood, tunic, 0, 1.65, -0.04);
  else { add(G.hair, mat(HAIR[r(HAIR.length)]), 0, 1.84, 0); }
  if (c.hat === 'cone') { add(G.brim, tunic, 0, 1.82, 0); add(G.cone, tunic, 0, 2.12, 0); }
  const limb = (geo, m, x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); const o = new THREE.Mesh(geo, m); o.position.y = -geo.parameters.height / 2; p.add(o); body.add(p); return p; };
  const legL = limb(G.leg, robe ? tunic : dark, -0.15, 0.72), legR = limb(G.leg, robe ? tunic : dark, 0.15, 0.72);
  const armL = limb(G.arm, tunic, -0.38, 1.4), armR = limb(G.arm, tunic, 0.38, 1.4);
  if (c.weapon === 'sword') { add(G.sword, mat(0xd8dde6), 0, -0.6, 0.35, armR).rotation.x = Math.PI / 2; add(G.shield, mat(0x7a2a22), -0.12, -0.35, 0, armL); }
  if (c.weapon === 'staff') { add(G.staff, mat(0x6b4a22), 0, -0.3, 0.12, armR); add(G.orb, cls === 'Healer' ? orbMat : mat(c.tunic), 0, 0.62, 0.12, armR); }
  if (c.weapon === 'dagger') { add(G.dagger, mat(0xd8dde6), 0, -0.62, 0.2, armR).rotation.x = Math.PI / 2; add(G.dagger, mat(0xd8dde6), 0, -0.62, 0.2, armL).rotation.x = Math.PI / 2; }
  if (c.weapon === 'bow') { const b = add(new THREE.TorusGeometry(0.45, 0.03, 4, 10, Math.PI), mat(0x6b4a22), 0, 1.15, -0.2); b.rotation.z = -Math.PI / 2; b.rotation.y = Math.PI / 2; }
  const sh = new THREE.Mesh(G.shadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; g.add(sh);
  const hit = new THREE.Mesh(G.hit, hitMat); hit.position.y = 1.05; g.add(hit);
  const s = 0.94 + r(14) / 100; body.scale.setScalar(s);
  return { group: g, body, head, legL, legR, armL, armR, hit, phase: r(100) / 10 };
}

// mode: idle | walk | attack | cast | cheer
export function animate(f, mode, t, k = 1) {
  const p = t + f.phase;
  let l = 0, aL = 0, aR = 0, y = 0, lean = 0;
  if (mode === 'walk') { l = Math.sin(p * 9 * k) * 0.7; aL = l * 0.7; aR = -l * 0.7; y = Math.abs(Math.cos(p * 9 * k)) * 0.04; }
  else if (mode === 'attack') { const s = (p * 1.6) % 1; aR = s < 0.3 ? -2.4 * (s / 0.3) : -2.4 * (1 - (s - 0.3) / 0.7); aL = -0.4; lean = 0.1; l = 0.15; }
  else if (mode === 'cast') { aL = aR = -1.9 + Math.sin(p * 10) * 0.12; }
  else if (mode === 'cheer') { aL = aR = -2.9; y = Math.abs(Math.sin(p * 8)) * 0.35; }
  else { aL = Math.sin(p * 1.5) * 0.05; aR = -aL; y = Math.sin(p * 1.5) * 0.008; }
  f.legL.rotation.x = l; f.legR.rotation.x = -l;
  f.armL.rotation.x = aL; f.armR.rotation.x = aR;
  f.body.position.y = y; f.body.rotation.x = lean;
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Name and health bar over a head. draw(frac) repaints only when it changes.
export function makePlate(name, sub, color) {
  const W = 256, H = 72;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(3.4, 3.4 * H / W, 1); sp.position.y = 2.75; sp.renderOrder = 5;
  let last = -1, lastSel = null;
  const draw = (frac, sel) => {
    const q = Math.round(frac * 50);
    if (q === last && sel === lastSel) return;
    last = q; lastSel = sel;
    x.clearRect(0, 0, W, H);
    x.textAlign = 'center'; x.lineJoin = 'round';
    x.font = 'bold 24px sans-serif'; x.lineWidth = 5; x.strokeStyle = '#000';
    x.strokeText(name, W / 2, 24); x.fillStyle = sel ? '#fff' : color; x.fillText(name, W / 2, 24);
    if (sub) { x.font = '16px sans-serif'; x.lineWidth = 4; x.strokeText(sub, W / 2, 44); x.fillStyle = '#b8e0b0'; x.fillText(sub, W / 2, 44); }
    if (frac < 0.995 || sel) {
      x.fillStyle = '#000'; x.fillRect(48, 52, 160, 16);
      x.fillStyle = frac < 0.35 ? '#d83a2a' : frac < 0.7 ? '#d8b52a' : '#3fbf4a'; x.fillRect(50, 54, 156 * frac, 12);
      if (sel) { x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(47, 51, 162, 18); }
    }
    tex.needsUpdate = true;
  };
  draw(1, false);
  return { sprite: sp, draw };
}
