// Water anywhere in the world. A zone calls addWater(scene, spec) and gets a
// body you can wade into (a shallow band along the edge: slower, sunk to the
// knees) and swim in (the deep middle: slow, sunk to the shoulders, no
// casting, monsters will not follow). Bodies marked `fish` can be fished from
// the bank or the shallows, and people from the roster fish at `spots`.
//   circle: { name, x, z, r, wade, fish }
//   rect:   { name, x0, z0, x1, z1, wade, fish }
// `wade` is how wide the shallow band is; set it at least as wide as the body
// for water that is shallow throughout (a ford or a puddle).
import * as THREE from 'three';
import { canvasTex } from './figure.js';

export const WATERS = [];
export const SURFACE = 0.05;              // height of the water surface
export const WADE_SINK = 0.5, SWIM_SINK = 1.22;
export const WADE_SPEED = 0.75, SWIM_SPEED = 0.55;
const calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// How far inside the edge a point is (negative outside).
export function inside(b, x, z) {
  if (b.r) return b.r - Math.hypot(x - b.x, z - b.z);
  return Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
}
// The water at a point: { b, d (yards inside the edge), mode 'wade' or 'swim', sink }, or null on dry land.
export function waterAt(x, z) {
  for (const b of WATERS) {
    const d = inside(b, x, z);
    if (d > 0) return d < b.wade ? { b, d, mode: 'wade', sink: WADE_SINK * Math.min(1, 0.35 + d / b.wade) } : { b, d, mode: 'swim', sink: SWIM_SINK };
  }
  return null;
}
export const swimming = u => { const w = waterAt(u.x, u.z); return !!w && w.mode === 'swim'; };

// Water is a wall to anyone who does not swim (people and monsters): they
// walk round it. Called from world.collide.
export function keepOut(p, r) {
  for (const b of WATERS) {
    const d = inside(b, p.x, p.z) + r;
    if (d <= 0) continue;
    if (b.r) { const dx = p.x - b.x, dz = p.z - b.z, m = Math.hypot(dx, dz) || 1e-4, k = (b.r + r) / m; p.x = b.x + dx * k; p.z = b.z + dz * k; }
    else {
      const e = [p.x - b.x0, b.x1 - p.x, p.z - b.z0, b.z1 - p.z], i = e.indexOf(Math.min(...e));
      if (i === 0) p.x = b.x0 - r; else if (i === 1) p.x = b.x1 + r; else if (i === 2) p.z = b.z0 - r; else p.z = b.z1 + r;
    }
  }
}
// A fishable body you can cast into from here: on the bank within `reach`
// yards of the edge, or standing in the shallows. Returns the body or null.
export function fishable(x, z, reach = 3.5) {
  for (const b of WATERS) { if (!b.fish) continue; const d = inside(b, x, z); if (d > -reach && d < b.wade) return b; }
  return null;
}
// Where a cast from (x, z) towards yaw lands: `far` yards out, pulled toward
// the middle of the body if that is not water at least two yards deep in.
export function castPoint(b, x, z, yaw, far = 7) {
  let px = x + Math.sin(yaw) * far, pz = z + Math.cos(yaw) * far;
  if (inside(b, px, pz) < 2) {
    const cx = b.r ? b.x : (b.x0 + b.x1) / 2, cz = b.r ? b.z : (b.z0 + b.z1) / 2, dx = cx - x, dz = cz - z, m = Math.hypot(dx, dz) || 1;
    const edge = Math.max(0, -inside(b, x, z)); px = x + dx / m * (edge + 4.5); pz = z + dz / m * (edge + 4.5);
  }
  return { x: px, z: pz };
}

// Painted once: a soft surface (light at the edge, deeper blue inside) and
// a sheet of sparkling ripple lines that drifts slowly over it.
let surfTex, glintTex;
function textures() {
  if (surfTex) return;
  surfTex = canvasTex(256, 256, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, '#2a6f9e'); g.addColorStop(0.55, '#3a86b4'); g.addColorStop(0.8, '#5aa8cc'); g.addColorStop(0.95, '#8ac8d8'); g.addColorStop(1, '#a8d0c8');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
  glintTex = canvasTex(256, 256, (x, w) => {
    x.clearRect(0, 0, w, w); x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineCap = 'round';
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const cx = r() * w, cy = r() * w, len = 8 + r() * 22; x.lineWidth = 1 + r() * 2;
      x.beginPath(); x.moveTo(cx - len / 2, cy); x.quadraticCurveTo(cx, cy - 3, cx + len / 2, cy); x.stroke();
      for (const o of [-w, w]) { x.beginPath(); x.moveTo(cx - len / 2 + o, cy); x.quadraticCurveTo(cx + o, cy - 3, cx + len / 2 + o, cy); x.stroke(); }
    }
  });
  glintTex.wrapS = glintTex.wrapT = THREE.RepeatWrapping;
}
const glints = [];
let ripples = [], scene0 = null;
const ringGeo = new THREE.RingGeometry(0.8, 1, 24);

// Adds a body of water to the world: the surface, a bank, its minimap shape,
// and (for fishing bodies) spots on the bank where people sit with rods.
export function addWater(scene, spec, mapShapes) {
  textures(); scene0 = scene;
  const b = { wade: 4, fish: false, ...spec, spots: [] };
  const flat = (geo, mat, y, x, z) => { const o = new THREE.Mesh(geo, mat); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.userData.flat = true; scene.add(o); return o; };
  const glint = new THREE.MeshBasicMaterial({ map: glintTex.clone(), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  glint.map.needsUpdate = true;
  if (b.r) {
    const seg = Math.max(24, Math.round(b.r * 2.4));
    flat(new THREE.RingGeometry(b.r - 0.3, b.r + 1.4, seg), new THREE.MeshLambertMaterial({ color: 0x8a9a5a }), 0.035, b.x, b.z);
    flat(new THREE.CircleGeometry(b.r, seg), new THREE.MeshLambertMaterial({ map: surfTex, emissive: 0x0a2a44 }), SURFACE, b.x, b.z).userData.noShade = true;
    glint.map.repeat.set(b.r / 6, b.r / 6);
    flat(new THREE.CircleGeometry(b.r - 0.4, seg), glint, SURFACE + 0.004, b.x, b.z);
    if (mapShapes) mapShapes.push({ t: 'c', x: b.x, z: b.z, r: b.r, c: '#4f9ac8' });
    if (b.fish) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3; b.spots.push({ x: b.x + Math.sin(a) * (b.r + 0.9), z: b.z + Math.cos(a) * (b.r + 0.9), fx: b.x, fz: b.z }); }
  } else {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    flat(new THREE.PlaneGeometry(w + 2.6, d + 2.6), new THREE.MeshLambertMaterial({ color: 0x8a9a5a }), 0.035, cx, cz);
    flat(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: 0x3a86b4, emissive: 0x0a2a44 }), SURFACE, cx, cz).userData.noShade = true;
    glint.map.repeat.set(w / 12, d / 12);
    flat(new THREE.PlaneGeometry(w, d), glint, SURFACE + 0.004, cx, cz);
    if (mapShapes) mapShapes.push({ t: 'b', x: cx, z: cz, w, d, rot: 0, c: '#4f9ac8' });
    if (b.fish) for (let i = 0; i < 8; i++) { const t = (i + 0.5) / 8; b.spots.push(i % 2 ? { x: b.x0 + w * t, z: b.z0 - 0.9, fx: b.x0 + w * t, fz: cz } : { x: b.x0 + w * t, z: b.z1 + 0.9, fx: b.x0 + w * t, fz: cz }); }
  }
  glints.push(glint);
  WATERS.push(b);
  return b;
}

// A ring that spreads out on the surface and fades: splashes, the float, a catch.
export function ripple(x, z, size = 1, strong = 0.6) {
  if (!scene0 || (calm && size < 1.5)) return;
  let r = ripples.find(r => r.t <= 0);
  if (!r) {
    if (ripples.length > 40) return;
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.userData.looked = true; scene0.add(m); r = { m, t: 0 }; ripples.push(r);
  }
  Object.assign(r, { t: 1, size, strong }); r.m.visible = true; r.m.position.set(x, SURFACE + 0.012, z);
}
export function updateWater(dt, t) {
  if (!calm) for (const g of glints) { g.map.offset.x = t * 0.012; g.map.offset.y = Math.sin(t * 0.3) * 0.02; }
  for (const r of ripples) if (r.t > 0) {
    r.t -= dt * 0.9; const k = 1 - Math.max(0, r.t);
    r.m.scale.setScalar(0.2 + k * r.size * 1.6); r.m.material.opacity = Math.max(0, r.t) * r.strong;
    if (r.t <= 0) r.m.visible = false;
  }
}
