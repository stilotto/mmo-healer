// People and monsters: one model per calling, a walk cycle, and the name
// plate that floats over each head.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CLASSES = {
  Knight:  { color: '#c79c6e', tunic: 0x8a8f99, hat: 'helm', weapon: 'sword' },
  Ranger:  { color: '#abd473', tunic: 0x4f7a3a, hat: 'hood', weapon: 'bow' },
  Mage:    { color: '#69ccf0', tunic: 0x3b5fc0, hat: 'cone', weapon: 'staff' },
  Rogue:   { color: '#fff569', tunic: 0x3a3340, hat: 'hood', weapon: 'dagger' },
  Warlock: { color: '#9482c9', tunic: 0x5a2f7a, hat: 'cone', weapon: 'staff' },
  Druid:   { color: '#ff7d0a', tunic: 0x7a5a2f, hat: 'none', weapon: 'staff' },
  Brawler: { color: '#00ff96', tunic: 0xa33a2a, hat: 'none', weapon: 'none' },
  Warden:  { color: '#ffd24a', tunic: 0x2f6a4a, hat: 'helm', weapon: 'sword' },
  Vendor:  { color: '#ffd24a', tunic: 0x8a6a2a, hat: 'none', weapon: 'none' },
  Healer:  { color: '#ffffff', tunic: 0xf2ead2, hat: 'hood', weapon: 'staff' },
};
const SKIN = [0xf1c9a5, 0xe0b48a, 0xc68c5e, 0x8a5a36, 0xa8cf8f, 0xc4b4e0];
const HAIR = [0x2a1b10, 0x6b4a22, 0xe0b85a, 0xb8441e, 0xe8e2d8, 0x1a1a22, 0x8a3a6a];
const TRIM = { Knight: 0xd8b45a, Ranger: 0x8a6a3a, Mage: 0xe0c060, Rogue: 0x7a2a2a, Warlock: 0x2a1a3a, Druid: 0x4f7a2a, Brawler: 0xe0c060,
  Warden: 0xd8b45a, Vendor: 0xf2e2b8, Healer: 0xe0b84e };

const mats = {};
const mat = c => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const G = {
  orb: new THREE.SphereGeometry(0.13, 8, 6), shadow: new THREE.CircleGeometry(0.55, 12), hit: new THREE.CylinderGeometry(0.55, 0.55, 2.1, 6),
};
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false });
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const orbMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });

// People are built from simple rounded shapes merged into a few meshes, each
// coloured per vertex, so a whole figure is one material and six draw calls.
// Merged shapes are cached, so people who look alike share geometry.
const vmat = new THREE.MeshLambertMaterial({ vertexColors: true });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => _m.clone().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
function merge(parts) {
  return mergeGeometries(parts.map(([geo, col, m]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
    g.deleteAttribute('uv');
    const n = g.attributes.position.count, c = new Float32Array(n * 3); _c.set(col);
    for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  }));
}
// For other modules: merge [geometry, colour, matrix] parts into one mesh.
export const mergeParts = parts => new THREE.Mesh(merge(parts), vmat);
export { at, S as SHAPES };
const cache = new Map();
const cached = (key, make) => cache.get(key) || (cache.set(key, merge(make())), cache.get(key));
const S = {
  sph: (r, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h), cap: (r, len) => new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, len),
  cyl: (a, b, h, n = 10) => new THREE.CylinderGeometry(a, b, h, n), torus: () => new THREE.TorusGeometry(0.42, 0.025, 4, 12, Math.PI), cone: (r, h) => new THREE.ConeGeometry(r, h, 10), box,
};
const shade = (c, k) => _c.set(c).multiplyScalar(k).getHex();

export function makeFigure(cls, seed = Math.random() * 1000) {
  const c = CLASSES[cls], r = n => { seed = (seed * 9301 + 49297) % 233280; return Math.floor(seed / 233280 * n); };
  const si = r(SKIN.length), hi = r(HAIR.length), tv = r(3);
  const skin = SKIN[si], hair = HAIR[hi], tunic = shade(c.tunic, [0.9, 1, 1.1][tv]), trim = TRIM[cls] || 0xd8b45a;
  const robe = c.weapon === 'staff', pants = robe ? shade(tunic, 0.85) : cls === 'Knight' || cls === 'Warden' ? 0x6a6e78 : 0x4a3a2e;
  const boots = cls === 'Knight' || cls === 'Warden' ? 0x8a8e98 : 0x3a2a1e, sleeve = cls === 'Brawler' ? skin : tunic;
  const key = [cls, si, hi, tv].join();

  const torso = cached('t' + key, () => {
    const P = [
      [S.cyl(0.27, 0.24, 0.6), tunic, at(0, 1.06, 0)],
      [S.sph(0.27), tunic, at(0, 1.33, 0, 0, 0, 0, 1.3, 0.5, 0.95)],
      [S.cyl(0.255, 0.255, 0.08), trim, at(0, 0.8, 0)],
      [S.sph(0.25), skin, at(0, 1.67, 0, 0, 0, 0, 1, 1.06, 1)],
      [S.sph(0.034, 6, 4), 0x1a1410, at(-0.085, 1.69, 0.222)], [S.sph(0.034, 6, 4), 0x1a1410, at(0.085, 1.69, 0.222)],
      [S.sph(0.045, 6, 4), shade(skin, 0.92), at(0, 1.63, 0.245)],
    ];
    if (robe) P.push([S.cyl(0.27, 0.43, 0.72), tunic, at(0, 0.48, 0)], [S.cyl(0.43, 0.43, 0.05), trim, at(0, 0.14, 0)], [S.box(0.08, 0.6, 0.02), trim, at(0, 1.04, 0.255)]);
    if (cls === 'Knight' || cls === 'Warden') P.push([S.sph(0.17), 0x9aa0aa, at(-0.32, 1.4, 0, 0, 0, 0, 1, 0.7, 1)], [S.sph(0.17), 0x9aa0aa, at(0.32, 1.4, 0, 0, 0, 0, 1, 0.7, 1)], [S.box(0.3, 0.34, 0.05), trim, at(0, 1.08, 0.265)]);
    if (cls === 'Vendor') P.push([S.box(0.42, 0.62, 0.04), trim, at(0, 0.88, 0.25)]);
    if (cls === 'Ranger') P.push([S.cyl(0.08, 0.08, 0.6), 0x6b4a22, at(0.12, 1.2, -0.28, 0, 0, -0.35)], [S.torus(), 0x6b4a22, at(-0.05, 1.1, -0.3, 0, 0, 0.4)]);
    const hat = c.hat;
    if (hat === 'helm') P.push([S.cap(0.28, 1.5), 0xaab0bb, at(0, 1.68, 0)], [S.box(0.045, 0.2, 0.04), 0xaab0bb, at(0, 1.66, 0.27)], [S.cyl(0.29, 0.29, 0.05, 12), trim, at(0, 1.74, 0)]);
    else if (hat === 'hood') P.push([S.cap(0.3, 1.95), tunic, at(0, 1.66, -0.02, -0.55)], [S.sph(0.2), tunic, at(0, 1.5, -0.2, 0, 0, 0, 1.3, 0.7, 1)]);
    else P.push([S.cap(0.265, 1.2), hair, at(0, 1.69, -0.01, -0.3)]);
    if (hat === 'cone') P.push([S.cyl(0.44, 0.44, 0.035, 16), tunic, at(0, 1.86, 0)], [S.cone(0.26, 0.6), tunic, at(0.04, 2.15, -0.02, -0.12, 0, -0.18)], [S.cyl(0.27, 0.27, 0.07, 14), trim, at(0, 1.9, 0)]);
    if (cls === 'Brawler') P.push([S.cyl(0.27, 0.27, 0.06, 12), 0xc83a2a, at(0, 1.78, 0)]);
    return P;
  });
  const leg = cached('l' + key, () => [[S.cyl(0.1, 0.085, 0.62, 8), pants, at(0, -0.31, 0)], [S.sph(0.13, 8, 6), boots, at(0, -0.67, 0.05, 0, 0, 0, 0.85, 0.6, 1.25)]]);
  const arm = cached('a' + key, () => [[S.cyl(0.09, 0.075, 0.52, 8), sleeve, at(0, -0.26, 0)], [S.sph(0.11, 8, 6), sleeve, at(0, -0.02, 0)], [S.sph(0.09, 8, 6), skin, at(0, -0.56, 0)]]);

  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const head = new THREE.Group(); head.position.y = 1.67; body.add(head);
  body.add(new THREE.Mesh(torso, vmat));
  const limb = (geo, x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); p.add(new THREE.Mesh(geo, vmat)); body.add(p); return p; };
  const legL = limb(leg, -0.13, 0.76), legR = limb(leg, 0.13, 0.76), armL = limb(arm, -0.37, 1.33), armR = limb(arm, 0.37, 1.33);
  const handR = new THREE.Group(), handL = new THREE.Group(); handR.position.y = handL.position.y = -0.56; armR.add(handR); armL.add(handL);
  const w = c.weapon;
  if (w === 'sword') {
    handR.add(new THREE.Mesh(cached('sword', () => [[S.box(0.06, 0.03, 0.9), 0xdfe4ec, at(0, 0, 0.55)], [S.box(0.28, 0.05, 0.06), 0xd8b45a, at(0, 0, 0.1)], [S.cyl(0.03, 0.03, 0.16, 6), 0x5a3a22, at(0, 0, 0, Math.PI / 2)]]), vmat));
    handL.add(new THREE.Mesh(cached('shield' + tunic, () => [[S.cyl(0.32, 0.32, 0.06, 14), shade(c.tunic, 0.8), at(-0.06, 0.05, 0.05, 0, 0, Math.PI / 2)], [S.sph(0.08, 8, 6), 0xd8b45a, at(-0.1, 0.05, 0.05)]]), vmat));
  } else if (w === 'staff') {
    handR.add(new THREE.Mesh(cached('staff', () => [[S.cyl(0.035, 0.04, 1.75, 6), 0x7a5430, at(0, 0.3, 0.06)], [S.cyl(0.07, 0.05, 0.14, 6), 0xd8b45a, at(0, 1.12, 0.06)]]), vmat));
    const orb = new THREE.Mesh(G.orb, cls === 'Healer' ? orbMat : mat(shade(c.tunic, 1.4))); orb.position.set(0, 1.26, 0.06); handR.add(orb);
  } else if (w === 'dagger') {
    const d = cached('dagger', () => [[S.box(0.05, 0.025, 0.42), 0xdfe4ec, at(0, 0, 0.26)], [S.box(0.16, 0.04, 0.05), 0x8a6a3a, at(0, 0, 0.05)]]);
    handR.add(new THREE.Mesh(d, vmat)); handL.add(new THREE.Mesh(d, vmat));
  }
  const sh = new THREE.Mesh(G.shadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; g.add(sh);
  const hit = new THREE.Mesh(G.hit, hitMat); hit.position.y = 1.05; g.add(hit);
  const sc = 0.95 + r(10) / 100; body.scale.setScalar(sc);
  return { group: g, body, head, legL, legR, armL, armR, hit, sockets: { head, handR, handL }, phase: r(100) / 10 };
}

// mode: idle | walk | attack | cast | cheer | sit | dead | wave | bow | dance
export function animate(f, mode, t, k = 1) {
  const p = t + f.phase;
  let l = 0, aL = 0, aR = 0, y = 0, lean = 0, zR = 0, zL = 0, turn = 0;
  f.armL.rotation.z = f.armR.rotation.z = f.body.rotation.y = 0;
  if (mode === 'dead') { f.legL.rotation.x = f.legR.rotation.x = 0; f.armL.rotation.x = f.armR.rotation.x = -0.3; f.body.position.y = 0.22; f.body.rotation.x = -Math.PI / 2; return; }
  if (mode === 'sit') { f.legL.rotation.x = f.legR.rotation.x = -1.5; f.armL.rotation.x = f.armR.rotation.x = -0.5; f.body.position.y = -0.48; f.body.rotation.x = 0; return; }
  if (mode === 'walk') { l = Math.sin(p * 9 * k) * 0.7; aL = l * 0.7; aR = -l * 0.7; y = Math.abs(Math.cos(p * 9 * k)) * 0.04; }
  else if (mode === 'attack') { const s = (p * 1.6) % 1; aR = s < 0.3 ? -2.4 * (s / 0.3) : -2.4 * (1 - (s - 0.3) / 0.7); aL = -0.4; lean = 0.1; l = 0.15; }
  else if (mode === 'cast') { aL = aR = -1.9 + Math.sin(p * 10) * 0.12; }
  else if (mode === 'cheer') { aL = aR = -2.9; y = Math.abs(Math.sin(p * 8)) * 0.35; }
  else if (mode === 'wave') { aR = -2.7; zR = 0.25 + Math.sin(p * 11) * 0.35; aL = 0.05; }
  else if (mode === 'bow') { lean = 0.75; aL = aR = -0.35; }
  else if (mode === 'dance') { const b = Math.sin(p * 7); y = Math.abs(b) * 0.12; l = b * 0.35; aL = -1.6 - b * 0.9; aR = -1.6 + b * 0.9; zL = -0.3; zR = 0.3; turn = Math.sin(p * 1.7) * 0.6; }
  else { aL = Math.sin(p * 1.5) * 0.05; aR = -aL; y = Math.sin(p * 1.5) * 0.008; }
  f.legL.rotation.x = l; f.legR.rotation.x = -l;
  f.armL.rotation.x = aL; f.armR.rotation.x = aR;
  f.armL.rotation.z = zL; f.armR.rotation.z = zR;
  f.body.position.y = y; f.body.rotation.x = lean; f.body.rotation.y = turn;
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Name and health bar over a head. draw(frac) repaints only when it changes.
export function makePlate(name, sub, color) {
  const color0 = color, sub0 = sub;
  const W = 256, H = 72;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(3.4, 3.4 * H / W, 1); sp.position.y = 2.75; sp.renderOrder = 5;
  let last = -1, lastSel = null;
  const draw = (frac, sel, dead) => {
    const q = dead ? -2 : Math.round(frac * 50);
    if (q === last && sel === lastSel) return;
    last = q; lastSel = sel;
    if (dead) { color = '#9a9a9a'; sub = 'Dead'; } else { color = color0; sub = sub0; }
    x.clearRect(0, 0, W, H);
    x.textAlign = 'center'; x.lineJoin = 'round';
    x.font = 'bold 24px sans-serif'; x.lineWidth = 5; x.strokeStyle = '#000';
    x.strokeText(name, W / 2, 24); x.fillStyle = sel ? '#fff' : color; x.fillText(name, W / 2, 24);
    if (sub) { x.font = '16px sans-serif'; x.lineWidth = 4; x.strokeText(sub, W / 2, 44); x.fillStyle = '#b8e0b0'; x.fillText(sub, W / 2, 44); }
    if (!dead && (frac < 0.995 || sel)) {
      x.fillStyle = '#000'; x.fillRect(48, 52, 160, 16);
      x.fillStyle = frac < 0.35 ? '#d83a2a' : frac < 0.7 ? '#d8b52a' : '#3fbf4a'; x.fillRect(50, 54, 156 * frac, 12);
      if (sel) { x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(47, 51, 162, 18); }
    }
    tex.needsUpdate = true;
  };
  draw(1, false);
  return { sprite: sp, draw };
}

// Monsters of Greenhollow. Each faces +z like the people do.
export const MOBS = {
  slime: { name: 'Bog Slime', hp: 0.8, dmg: 0.7, speed: 2.2 },
  boar: { name: 'Bristle Boar', hp: 1, dmg: 1, speed: 3.6 },
  wolf: { name: 'Hollow Wolf', hp: 0.9, dmg: 1.25, speed: 4.6 },
  tusk: { name: 'Old Tusk', hp: 5, dmg: 2.1, speed: 3.4, elite: true },
};
export function makeMob(kind, opt = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const legs = [];
  if (kind === 'slime') {
    const col = opt.c || 0x5fd06a;
    const b = new THREE.Mesh(S.sph(0.7, 16, 12), new THREE.MeshLambertMaterial({ color: col, emissive: opt.glow || shade(col, 0.15), transparent: true, opacity: 0.82 }));
    b.position.y = 0.48; b.scale.set(1, 0.72, 1); body.add(b);
    body.add(new THREE.Mesh(cached('slimeface', () => [
      [S.sph(0.11, 8, 6), 0xffffff, at(-0.22, 0.66, 0.5)], [S.sph(0.11, 8, 6), 0xffffff, at(0.22, 0.66, 0.5)],
      [S.sph(0.06, 6, 4), 0x141414, at(-0.21, 0.66, 0.6)], [S.sph(0.06, 6, 4), 0x141414, at(0.21, 0.66, 0.6)],
      [S.sph(0.09, 8, 6), 0x2a1a14, at(0, 0.48, 0.62, 0, 0, 0, 1.4, 0.5, 0.6)],
    ]), vmat));
    const hl = new THREE.Mesh(S.sph(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })); hl.position.set(-0.25, 0.82, 0.3); hl.scale.set(1, 0.6, 1); body.add(hl);
  } else {
    const wolf = kind === 'wolf', c = opt.c || (wolf ? 0x7a7f8a : kind === 'tusk' ? 0x4a3226 : 0x8a5a3a), d = opt.d || (wolf ? 0x4f525a : 0x4a2e1e);
    body.add(new THREE.Mesh(cached('mob' + kind + c + d, () => {
      const P = wolf ? [
        [S.sph(0.42, 12, 9), c, at(0, 0.86, 0, 0, 0, 0, 0.8, 0.8, 1.55)],
        [S.sph(0.36, 12, 9), d, at(0, 1.0, 0.42, 0, 0, 0, 1, 1, 0.9)],                 // ruff
        [S.sph(0.27, 12, 9), c, at(0, 1.12, 0.78)],
        [S.sph(0.13, 8, 6), c, at(0, 1.04, 1.04, 0, 0, 0, 1, 0.8, 1.5)], [S.sph(0.05, 6, 4), 0x141414, at(0, 1.06, 1.24)],
        [S.cone(0.09, 0.24), d, at(-0.14, 1.38, 0.72, 0, 0, 0.2)], [S.cone(0.09, 0.24), d, at(0.14, 1.38, 0.72, 0, 0, -0.2)],
        [S.sph(0.035, 6, 4), 0xffd24a, at(-0.11, 1.17, 1.0)], [S.sph(0.035, 6, 4), 0xffd24a, at(0.11, 1.17, 1.0)],
        [S.cone(0.12, 0.7), d, at(0, 0.98, -0.78, -2.1)],
      ] : [
        [S.sph(0.5, 12, 9), c, at(0, 0.82, 0, 0, 0, 0, 0.95, 0.85, 1.45)],
        [S.sph(0.36, 12, 9), c, at(0, 0.8, 0.66)],
        [S.cyl(0.16, 0.2, 0.32, 10), shade(c, 1.2), at(0, 0.72, 0.98, Math.PI / 2)], [S.cyl(0.16, 0.16, 0.02, 10), 0x6a3a3a, at(0, 0.72, 1.14, Math.PI / 2)],
        [S.cone(0.05, 0.3), 0xf2ead2, at(-0.17, 0.72, 1.02, 0.9)], [S.cone(0.05, 0.3), 0xf2ead2, at(0.17, 0.72, 1.02, 0.9)],
        [S.cone(0.1, 0.2), d, at(-0.2, 1.1, 0.6, -0.3, 0, 0.4)], [S.cone(0.1, 0.2), d, at(0.2, 1.1, 0.6, -0.3, 0, -0.4)],
        [S.sph(0.04, 6, 4), 0x141414, at(-0.16, 0.9, 0.92)], [S.sph(0.04, 6, 4), 0x141414, at(0.16, 0.9, 0.92)],
        ...[-0.4, -0.15, 0.1, 0.35, 0.58].map((z, i) => [S.cone(0.09, 0.26), d, at(0, 1.18 + (i === 3 ? 0.02 : 0) - Math.abs(z) * 0.12, z, -0.35)]),   // bristles
        [S.cyl(0.03, 0.02, 0.3, 5), d, at(0, 0.9, -0.74, -0.8)],
      ];
      return P;
    }), vmat));
    const leg = cached('leg' + kind + c + d, () => [[S.cyl(wolf ? 0.08 : 0.1, wolf ? 0.06 : 0.08, 0.5, 7), c, at(0, -0.25, 0)], [S.cyl(0.08, 0.09, 0.08, 7), d, at(0, -0.5, 0)]]);
    for (const [x, z] of [[-0.22, 0.45], [0.22, 0.45], [-0.22, -0.45], [0.22, -0.45]]) {
      const p = new THREE.Group(); p.position.set(x, 0.55, z); p.add(new THREE.Mesh(leg, vmat)); body.add(p); legs.push(p);
    }
  }
  const sh = new THREE.Mesh(G.shadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.scale.setScalar(1.4); g.add(sh);
  if (kind === 'tusk') body.scale.setScalar(1.9);
  if (opt.scale) { body.scale.setScalar(opt.scale); sh.scale.setScalar(1.4 * opt.scale); }
  return { group: g, body, legs, kind, phase: Math.random() * 10 };
}
export function animateMob(f, mode, t) {
  const p = t + f.phase, b = f.body;
  b.rotation.z = 0; b.position.set(0, 0, 0);
  if (mode === 'dead') { b.rotation.z = Math.PI / 2; b.position.y = f.kind === 'slime' ? -0.2 : 0.3; return; }
  if (f.kind === 'slime') { const s = mode === 'idle' ? Math.sin(p * 2) * 0.06 : Math.abs(Math.sin(p * 6)) * 0.3; b.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5); b.position.y = mode === 'idle' ? 0 : s * 0.6; return; }
  const sw = mode === 'walk' ? Math.sin(p * 11) * 0.7 : 0;
  f.legs.forEach((l, i) => { l.rotation.x = (i % 3 === 0 ? sw : -sw); });
  if (mode === 'attack') { const k = (p * 1.4) % 1; b.position.z = k < 0.25 ? k * 2.4 : 0.6 * (1 - (k - 0.25) / 0.75); }
}
